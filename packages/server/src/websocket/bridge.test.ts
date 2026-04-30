import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { WebSocket } from 'ws';
import { WebSocketBridge, COMMAND_TIMEOUT_MS } from './bridge.js';
import type { ServerToPluginMessage } from './bridge.js';

function getPort(server: HttpServer): number {
  const addr = server.address();
  if (addr && typeof addr === 'object') return addr.port;
  throw new Error('Server not listening');
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
}

describe('WebSocketBridge', () => {
  let httpServer: HttpServer;
  let bridge: WebSocketBridge;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    bridge = new WebSocketBridge(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });
    port = getPort(httpServer);
  });

  afterEach(async () => {
    bridge.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('starts disconnected', () => {
    expect(bridge.connected).toBe(false);
  });

  it('becomes connected when a client connects', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);

    // Give bridge a tick to process the connection
    await new Promise((r) => setTimeout(r, 50));
    expect(bridge.connected).toBe(true);

    client.close();
  });

  it('rejects sendCommand when no client is connected', async () => {
    await expect(bridge.sendCommand('test')).rejects.toThrow('Plugin is not connected');
  });

  it('sends command and resolves with plugin result', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    // Plugin echoes back a result for any command
    client.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: msg.id, result: { frameId: '123' } }));
    });

    const result = await bridge.sendCommand('clone-frame', { templateNodeId: '1:2' });
    expect(result).toEqual({ frameId: '123' });

    client.close();
  });

  it('rejects with error when plugin sends error response', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    client.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      client.send(JSON.stringify({ id: msg.id, error: 'Node not found' }));
    });

    await expect(bridge.sendCommand('set-text', { frameId: '1', text: 'hi' }))
      .rejects.toThrow('Node not found');

    client.close();
  });

  it('handles multiple concurrent commands', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    client.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      // Respond with the command name as result
      client.send(JSON.stringify({ id: msg.id, result: msg.command }));
    });

    const [r1, r2, r3] = await Promise.all([
      bridge.sendCommand('cmd-a'),
      bridge.sendCommand('cmd-b'),
      bridge.sendCommand('cmd-c'),
    ]);

    expect(r1).toBe('cmd-a');
    expect(r2).toBe('cmd-b');
    expect(r3).toBe('cmd-c');

    client.close();
  });

  it('rejects pending commands when plugin disconnects', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    // Don't respond — just disconnect
    const promise = bridge.sendCommand('slow-command');
    client.close();

    await expect(promise).rejects.toThrow('Plugin disconnected');
  });

  it('becomes disconnected when client closes', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));
    expect(bridge.connected).toBe(true);

    client.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(bridge.connected).toBe(false);
  });

  it('replaces old client when a new one connects', async () => {
    const client1 = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client1);
    await new Promise((r) => setTimeout(r, 50));

    const client2 = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client2);
    await new Promise((r) => setTimeout(r, 50));

    // Bridge should still be connected (to client2)
    expect(bridge.connected).toBe(true);

    // New client should work
    client2.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      client2.send(JSON.stringify({ id: msg.id, result: 'from-client2' }));
    });

    const result = await bridge.sendCommand('test');
    expect(result).toBe('from-client2');

    client1.close();
    client2.close();
  });

  it('ignores malformed messages', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    client.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      // Send malformed first, then valid response
      client.send('not-json');
      client.send(JSON.stringify({ id: msg.id, result: 'ok' }));
    });

    const result = await bridge.sendCommand('test');
    expect(result).toBe('ok');

    client.close();
  });

  it('ignores responses with unknown request IDs', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    client.on('message', (data) => {
      const msg: ServerToPluginMessage = JSON.parse(data.toString());
      // Send response with wrong ID first, then correct one
      client.send(JSON.stringify({ id: 'unknown-id', result: 'wrong' }));
      client.send(JSON.stringify({ id: msg.id, result: 'correct' }));
    });

    const result = await bridge.sendCommand('test');
    expect(result).toBe('correct');

    client.close();
  });

  it('close() rejects all pending requests', async () => {
    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    // Don't respond
    const promise = bridge.sendCommand('pending-cmd');
    bridge.close();

    await expect(promise).rejects.toThrow('WebSocket bridge is closing');

    client.close();
  });
});
