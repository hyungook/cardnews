import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

// Mock config-manager
vi.mock('../config/config-manager.js', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  validateConfig: vi.fn(),
}));

// Mock sheets-reader
vi.mock('../google/sheets-reader.js', () => ({
  SpreadsheetReader: vi.fn(),
}));

import { loadConfig } from '../config/config-manager.js';
import { SpreadsheetReader } from '../google/sheets-reader.js';

const mockLoadConfig = vi.mocked(loadConfig);
const MockSpreadsheetReader = vi.mocked(SpreadsheetReader);

const testConfig = {
  google: {
    serviceAccountKey: { type: 'service_account' },
    spreadsheetId: 'test-id',
  },
  figma: {
    accessToken: 'token',
    fileKey: 'key',
    templateNodeId: 'node',
  },
  template: {
    layerNames: {
      background: 'bg_image',
      logo: 'logo',
      mainText: 'main_text',
      subText: 'sub_text',
      copyright: 'copyright',
      badgeContainer: 'badge_container',
    },
  },
  fileNaming: {
    backgroundPattern: '{title}.jpg',
    logoPattern: 'LI_{title}.png',
  },
  sizePresets: [{ name: 'U+ IPTV', width: 808, height: 454, templateNodeId: '1:2' }],
  server: { port: 3000 },
};

describe('sheets router', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sheets/data', () => {
    it('설정이 없으면 500을 반환한다', async () => {
      mockLoadConfig.mockResolvedValue(null);

      const res = await request(app).get('/api/sheets/data');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('행 데이터를 반환한다', async () => {
      mockLoadConfig.mockResolvedValue(testConfig);
      const mockRows = [{ rowIndex: 2, movieTitle: '영화A' }];
      MockSpreadsheetReader.mockImplementation(() => ({
        readAllRows: vi.fn().mockResolvedValue(mockRows),
        updateCell: vi.fn(),
        appendHistory: vi.fn(),
        readHistory: vi.fn(),
      }) as unknown as SpreadsheetReader);

      const res = await request(app).get('/api/sheets/data');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows).toEqual(mockRows);
    });
  });

  describe('PUT /api/sheets/cell', () => {
    it('잘못된 요청 바디에 400을 반환한다', async () => {
      mockLoadConfig.mockResolvedValue(testConfig);
      MockSpreadsheetReader.mockImplementation(() => ({
        readAllRows: vi.fn(),
        updateCell: vi.fn(),
        appendHistory: vi.fn(),
        readHistory: vi.fn(),
      }) as unknown as SpreadsheetReader);

      const res = await request(app)
        .put('/api/sheets/cell')
        .send({ row: 'not-a-number', col: 0, value: 'test' });
      expect(res.status).toBe(400);
    });

    it('올바른 요청으로 셀을 업데이트한다', async () => {
      mockLoadConfig.mockResolvedValue(testConfig);
      const mockUpdateCell = vi.fn().mockResolvedValue(undefined);
      MockSpreadsheetReader.mockImplementation(() => ({
        readAllRows: vi.fn(),
        updateCell: mockUpdateCell,
        appendHistory: vi.fn(),
        readHistory: vi.fn(),
      }) as unknown as SpreadsheetReader);

      const res = await request(app)
        .put('/api/sheets/cell')
        .send({ row: 2, col: 0, value: '새 값' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('셀이 업데이트되었습니다');
    });
  });

  describe('POST /api/sheets/refresh', () => {
    it('최신 데이터를 반환한다', async () => {
      mockLoadConfig.mockResolvedValue(testConfig);
      const mockRows = [{ rowIndex: 2, movieTitle: '영화B' }];
      MockSpreadsheetReader.mockImplementation(() => ({
        readAllRows: vi.fn().mockResolvedValue(mockRows),
        updateCell: vi.fn(),
        appendHistory: vi.fn(),
        readHistory: vi.fn(),
      }) as unknown as SpreadsheetReader);

      const res = await request(app).post('/api/sheets/refresh');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows).toEqual(mockRows);
    });
  });
});
