import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';

/** Message sent from server to plugin */
export interface ServerToPluginMessage {
  id: string;
  command: string;
  params: Record<string, unknown>;
}

/** Message sent from plugin to server */
export interface PluginToServerMessage {
  id: string;
  result?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export const COMMAND_TIMEOUT_MS = 30_000;

export class WebSocketBridge {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  constructor(server: HttpServer, path = '/ws') {
    this.wss = new WebSocketServer({ server, path });
    console.log(`[WebSocket] 서버 시작됨: ${path}`);

    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] 🔌 플러그인 연결 시도');
      
      // Only allow one plugin connection at a time
      if (this.client) {
        console.log('[WebSocket] 기존 연결 종료 중...');
        const oldClient = this.client;
        // Remove listeners before closing to avoid triggering handleDisconnect for the old client
        oldClient.removeAllListeners();
        oldClient.close();
      }

      this.client = ws;
      this._connected = true;
      console.log('[WebSocket] ✅ 플러그인 연결 성공!');

      ws.on('message', (data) => {
        this.handleMessage(data);
      });

      ws.on('close', () => {
        console.log('[WebSocket] ❌ 플러그인 연결 끊김');
        // Only handle disconnect if this ws is still the active client
        if (this.client === ws) {
          this.handleDisconnect();
        }
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] 오류:', err);
        if (this.client === ws) {
          this.handleDisconnect();
        }
      });
    });
  }

  /**
   * Send a command to the connected Figma plugin and wait for a response.
   * Returns a Promise that resolves with the plugin's result or rejects on error/timeout.
   */
  sendCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this._connected) {
        reject(new Error('Plugin is not connected'));
        return;
      }

      const id = randomUUID();

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Command "${command}" timed out after ${COMMAND_TIMEOUT_MS}ms`));
      }, COMMAND_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const message: ServerToPluginMessage = { id, command, params };
      this.client.send(JSON.stringify(message));
    });
  }

  /** Close the WebSocket server and clean up all resources */
  close(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('WebSocket bridge is closing'));
      this.pendingRequests.delete(id);
    }

    if (this.client) {
      this.client.close();
      this.client = null;
    }

    this._connected = false;
    this.wss.close();
  }

  private handleMessage(data: WebSocket.RawData): void {
    let msg: PluginToServerMessage;
    try {
      msg = JSON.parse(data.toString()) as PluginToServerMessage;
    } catch {
      return; // ignore malformed messages
    }

    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.id);

    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }

  private handleDisconnect(): void {
    this.client = null;
    this._connected = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Plugin disconnected'));
      this.pendingRequests.delete(id);
    }
  }
}
