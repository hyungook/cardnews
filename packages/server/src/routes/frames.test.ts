import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { framesRouter } from './frames.js';
import { frameRegistry } from '../pipeline/frame-registry.js';

// Mock config-manager
vi.mock('../config/config-manager.js', () => ({
  loadConfig: vi.fn(),
}));

// Mock index.js getWebSocketBridge
vi.mock('../index.js', () => ({
  getWebSocketBridge: vi.fn(),
}));

// Mock FigmaOrchestrator
vi.mock('../figma/figma-orchestrator.js', () => ({
  FigmaOrchestrator: vi.fn(),
}));

import { loadConfig } from '../config/config-manager.js';
import { getWebSocketBridge } from '../index.js';
import { FigmaOrchestrator } from '../figma/figma-orchestrator.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockGetBridge = vi.mocked(getWebSocketBridge);
const MockOrchestrator = vi.mocked(FigmaOrchestrator);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/frames', framesRouter);
  return app;
}

describe('Frames Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    frameRegistry.clear();
  });

  describe('GET /api/frames/batches', () => {
    it('should return empty list when no batches exist', async () => {
      const app = createApp();
      const res = await request(app).get('/api/frames/batches');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batches).toEqual([]);
    });

    it('should return batches with frame counts', async () => {
      frameRegistry.registerBatch('batch-1');
      frameRegistry.addFrame('batch-1', 'frame-a');
      frameRegistry.addFrame('batch-1', 'frame-b');
      frameRegistry.registerBatch('batch-2');
      frameRegistry.addFrame('batch-2', 'frame-c');

      const app = createApp();
      const res = await request(app).get('/api/frames/batches');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batches).toHaveLength(2);
      expect(res.body.data.batches[0].batchId).toBe('batch-1');
      expect(res.body.data.batches[0].frameCount).toBe(2);
      expect(res.body.data.batches[0].createdAt).toBeTruthy();
      expect(res.body.data.batches[1].batchId).toBe('batch-2');
      expect(res.body.data.batches[1].frameCount).toBe(1);
    });
  });

  describe('DELETE /api/frames/:batchId', () => {
    it('should return 404 when batch does not exist', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/frames/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('nonexistent');
    });

    it('should handle empty batch (no frames)', async () => {
      frameRegistry.registerBatch('batch-empty');

      const app = createApp();
      const res = await request(app).delete('/api/frames/batch-empty');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedCount).toBe(0);
      expect(frameRegistry.getBatch('batch-empty')).toBeUndefined();
    });

    it('should return 500 when config is missing', async () => {
      frameRegistry.registerBatch('batch-1');
      frameRegistry.addFrame('batch-1', 'frame-a');
      mockLoadConfig.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).delete('/api/frames/batch-1');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should return 503 when plugin is not connected', async () => {
      frameRegistry.registerBatch('batch-1');
      frameRegistry.addFrame('batch-1', 'frame-a');
      mockLoadConfig.mockResolvedValue({ figma: { accessToken: 'tok', fileKey: 'fk' } } as any);
      mockGetBridge.mockReturnValue(null);

      const app = createApp();
      const res = await request(app).delete('/api/frames/batch-1');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('플러그인');
    });

    it('should delete frames and remove batch from registry', async () => {
      frameRegistry.registerBatch('batch-1');
      frameRegistry.addFrame('batch-1', 'frame-a');
      frameRegistry.addFrame('batch-1', 'frame-b');

      mockLoadConfig.mockResolvedValue({
        figma: { accessToken: 'tok', fileKey: 'fk' },
      } as any);

      const mockDeleteFrames = vi.fn().mockResolvedValue(undefined);
      MockOrchestrator.mockImplementation(() => ({
        deleteFrames: mockDeleteFrames,
      }) as any);

      const mockBridge = { connected: true } as any;
      mockGetBridge.mockReturnValue(mockBridge);

      const app = createApp();
      const res = await request(app).delete('/api/frames/batch-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedCount).toBe(2);
      expect(mockDeleteFrames).toHaveBeenCalledWith(['frame-a', 'frame-b']);
      expect(frameRegistry.getBatch('batch-1')).toBeUndefined();
    });

    it('should return 500 when deleteFrames throws', async () => {
      frameRegistry.registerBatch('batch-1');
      frameRegistry.addFrame('batch-1', 'frame-a');

      mockLoadConfig.mockResolvedValue({
        figma: { accessToken: 'tok', fileKey: 'fk' },
      } as any);

      const mockDeleteFrames = vi.fn().mockRejectedValue(new Error('Plugin 오류'));
      MockOrchestrator.mockImplementation(() => ({
        deleteFrames: mockDeleteFrames,
      }) as any);

      const mockBridge = { connected: true } as any;
      mockGetBridge.mockReturnValue(mockBridge);

      const app = createApp();
      const res = await request(app).delete('/api/frames/batch-1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FIGMA_CONNECTION_FAILED');
      // Batch should still exist since deletion failed
      expect(frameRegistry.getBatch('batch-1')).toBeDefined();
    });
  });
});
