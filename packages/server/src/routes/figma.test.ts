import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { figmaRouter } from './figma.js';

vi.mock('../config/config-manager.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../figma/figma-api-client.js', () => ({
  getTopLevelFrames: vi.fn(),
  getTopLevelFramesDebug: vi.fn(),
  getFrameChildrenNames: vi.fn(),
}));

vi.mock('../utils/template-validation.js', () => ({
  validateTemplateLayerNames: vi.fn(),
}));

import { loadConfig } from '../config/config-manager.js';
import { getTopLevelFrames, getTopLevelFramesDebug, getFrameChildrenNames } from '../figma/figma-api-client.js';
import { validateTemplateLayerNames } from '../utils/template-validation.js';

const mockedLoadConfig = vi.mocked(loadConfig);
const mockedGetTopLevelFrames = vi.mocked(getTopLevelFrames);
const mockedGetTopLevelFramesDebug = vi.mocked(getTopLevelFramesDebug);
const mockedGetFrameChildrenNames = vi.mocked(getFrameChildrenNames);
const mockedValidateTemplateLayerNames = vi.mocked(validateTemplateLayerNames);

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/figma', figmaRouter);
  return app;
}

const mockConfig = {
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

describe('GET /api/figma/frames', () => {
  beforeEach(() => vi.clearAllMocks());

  it('설정이 없으면 400을 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(null);

    const app = createTestApp();
    const res = await request(app).get('/api/figma/frames');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFIG_NOT_FOUND');
  });

  it('프레임 목록을 성공적으로 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(mockConfig as any);
    mockedGetTopLevelFramesDebug.mockResolvedValue({
      frames: [
        { name: 'Template Frame', nodeId: '1:2' },
        { name: 'Another Frame', nodeId: '3:4' },
      ],
      debug: {},
    });

    const app = createTestApp();
    const res = await request(app).get('/api/figma/frames');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.frames).toHaveLength(2);
    expect(res.body.data.frames[0].name).toBe('Template Frame');
    expect(mockedGetTopLevelFramesDebug).toHaveBeenCalledWith('abc123', 'figd_token');
  });
});

describe('POST /api/figma/validate-template', () => {
  beforeEach(() => vi.clearAllMocks());

  it('frameNodeId가 없으면 400을 반환한다', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/figma/validate-template').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_FIELDS');
  });

  it('모든 레이어가 존재하면 valid: true를 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(mockConfig as any);
    mockedGetFrameChildrenNames.mockResolvedValue([
      'bg_image', 'logo', 'main_text', 'sub_text', 'copyright', 'badge_container',
    ]);
    mockedValidateTemplateLayerNames.mockReturnValue({
      valid: true,
      missingLayers: [],
    });

    const app = createTestApp();
    const res = await request(app)
      .post('/api/figma/validate-template')
      .send({ frameNodeId: '1:2' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.missingLayers).toHaveLength(0);
  });

  it('레이어가 누락되면 missingLayers를 반환한다', async () => {
    mockedLoadConfig.mockResolvedValue(mockConfig as any);
    mockedGetFrameChildrenNames.mockResolvedValue(['bg_image', 'logo']);
    mockedValidateTemplateLayerNames.mockReturnValue({
      valid: false,
      missingLayers: ['main_text', 'sub_text', 'copyright', 'badge_container'],
    });

    const app = createTestApp();
    const res = await request(app)
      .post('/api/figma/validate-template')
      .send({ frameNodeId: '1:2' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.missingLayers).toContain('main_text');
  });
});
