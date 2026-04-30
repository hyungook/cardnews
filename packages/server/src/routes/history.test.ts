import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { historyRouter } from './history.js';
import type { HistoryRecord } from '@card-news/shared';

// Mock config-manager
vi.mock('../config/config-manager.js', () => ({
  loadConfig: vi.fn(),
}));

// Mock sheets-reader
vi.mock('../google/sheets-reader.js', () => ({
  SpreadsheetReader: vi.fn(),
}));

import { loadConfig } from '../config/config-manager.js';
import { SpreadsheetReader } from '../google/sheets-reader.js';

const mockLoadConfig = vi.mocked(loadConfig);
const MockSpreadsheetReader = vi.mocked(SpreadsheetReader);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/history', historyRouter);
  return app;
}

const sampleRecords: HistoryRecord[] = [
  {
    id: 'abc-123',
    createdAt: '2024-01-15T10:30:00Z',
    totalCount: 5,
    successCount: 4,
    errorCount: 1,
    files: [
      { filename: '카드뉴스_(영화A).jpg', movieTitle: '영화A', rowIndex: 2 },
    ],
    errors: [
      { rowIndex: 3, movieTitle: '영화B', errorType: 'BADGE_INVALID', message: '유효하지 않은 뱃지' },
    ],
  },
  {
    id: 'def-456',
    createdAt: '2024-01-16T14:00:00Z',
    totalCount: 3,
    successCount: 3,
    errorCount: 0,
    files: [],
    errors: [],
  },
];

describe('History Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/history', () => {
    it('should return all history records', async () => {
      mockLoadConfig.mockResolvedValue({} as any);
      const mockReadHistory = vi.fn().mockResolvedValue(sampleRecords);
      MockSpreadsheetReader.mockImplementation(() => ({ readHistory: mockReadHistory } as any));

      const app = createApp();
      const res = await request(app).get('/api/history');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records).toHaveLength(2);
      expect(res.body.data.records[0].id).toBe('abc-123');
    });

    it('should return empty list when no history exists', async () => {
      mockLoadConfig.mockResolvedValue({} as any);
      const mockReadHistory = vi.fn().mockResolvedValue([]);
      MockSpreadsheetReader.mockImplementation(() => ({ readHistory: mockReadHistory } as any));

      const app = createApp();
      const res = await request(app).get('/api/history');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records).toHaveLength(0);
    });

    it('should return 500 when config is missing', async () => {
      mockLoadConfig.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/history');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SHEETS_CONNECTION_FAILED');
    });

    it('should return 500 when readHistory throws', async () => {
      mockLoadConfig.mockResolvedValue({} as any);
      const mockReadHistory = vi.fn().mockRejectedValue(new Error('API 오류'));
      MockSpreadsheetReader.mockImplementation(() => ({ readHistory: mockReadHistory } as any));

      const app = createApp();
      const res = await request(app).get('/api/history');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SHEETS_CONNECTION_FAILED');
    });
  });

  describe('GET /api/history/:id', () => {
    it('should return a specific history record by id', async () => {
      mockLoadConfig.mockResolvedValue({} as any);
      const mockReadHistory = vi.fn().mockResolvedValue(sampleRecords);
      MockSpreadsheetReader.mockImplementation(() => ({ readHistory: mockReadHistory } as any));

      const app = createApp();
      const res = await request(app).get('/api/history/abc-123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.record.id).toBe('abc-123');
      expect(res.body.data.record.totalCount).toBe(5);
      expect(res.body.data.record.files).toHaveLength(1);
      expect(res.body.data.record.errors).toHaveLength(1);
    });

    it('should return 404 when record is not found', async () => {
      mockLoadConfig.mockResolvedValue({} as any);
      const mockReadHistory = vi.fn().mockResolvedValue(sampleRecords);
      MockSpreadsheetReader.mockImplementation(() => ({ readHistory: mockReadHistory } as any));

      const app = createApp();
      const res = await request(app).get('/api/history/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('nonexistent-id');
    });

    it('should return 500 when config is missing', async () => {
      mockLoadConfig.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get('/api/history/abc-123');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
