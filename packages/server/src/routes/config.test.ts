import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { configRouter } from './config.js';
import type { AppConfig } from '@card-news/shared';

vi.mock('../config/config-manager.js', () => ({
  saveConfig: vi.fn(),
  loadConfig: vi.fn(),
  validateConfig: vi.fn(),
}));

import { saveConfig, loadConfig, validateConfig } from '../config/config-manager.js';

const mockedSaveConfig = vi.mocked(saveConfig);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedValidateConfig = vi.mocked(validateConfig);

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/config', configRouter);
  return app;
}

const validConfig: AppConfig = {
  google: {
    serviceAccountKey: { type: 'service_account' },
    spreadsheetId: 'sheet-123',
  },
  figma: {
    accessToken: 'figd_token',
    fileKey: 'abc123',
    templateNodeId: '1:2',
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

describe('POST /api/config/setup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('유효한 설정을 저장하고 성공을 반환한다', async () => {
    mockedValidateConfig.mockReturnValue({ valid: true, missingFields: [] });
    mockedSaveConfig.mockResolvedValue(undefined);

    const app = createTestApp();
    const res = await request(app).post('/api/config/setup').send(validConfig);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('설정이 저장되었습니다');
    expect(mockedSaveConfig).toHaveBeenCalledWith(validConfig);
  });

  it('유효하지 않은 설정이면 400을 반환한다', async () => {
    mockedValidateConfig.mockReturnValue({
      valid: false,
      missingFields: ['figma.accessToken'],
    });

    const app = createTestApp();
    const res = await request(app).post('/api/config/setup').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_FIELDS');
  });
});

describe('POST /api/config/test-connection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('설정이 유효하면 연결 테스트 성공을 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(validConfig);
    mockedValidateConfig.mockReturnValue({ valid: true, missingFields: [] });

    const app = createTestApp();
    const res = await request(app).post('/api/config/test-connection');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.googleSheets.connected).toBe(true);
  });

  it('설정 파일이 없으면 404를 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app).post('/api/config/test-connection');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFIG_NOT_FOUND');
  });
});

describe('GET /api/config/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('설정이 없으면 configured: false를 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app).get('/api/config/status');

    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(false);
  });

  it('설정이 유효하면 configured: true, valid: true를 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(validConfig);
    mockedValidateConfig.mockReturnValue({ valid: true, missingFields: [] });

    const app = createTestApp();
    const res = await request(app).get('/api/config/status');

    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
    expect(res.body.data.valid).toBe(true);
  });
});
