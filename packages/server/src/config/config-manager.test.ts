import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AppConfig } from '@card-news/shared';
import { saveConfig, loadConfig, validateConfig } from './config-manager.js';

function makeValidConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    google: {
      serviceAccountKey: { type: 'service_account', project_id: 'test' },
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
    sizePresets: [
      {
        name: 'U+ IPTV',
        width: 808,
        height: 454,
        templateNodeId: '1:2',
      },
    ],
    server: { port: 3000 },
    ...overrides,
  };
}

describe('saveConfig / loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'config-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('saves and loads a config (round-trip)', async () => {
    const config = makeValidConfig();
    const filePath = join(tmpDir, 'config.json');

    await saveConfig(config, filePath);
    const loaded = await loadConfig(filePath);

    expect(loaded).toEqual(config);
  });

  it('returns null when file does not exist', async () => {
    const result = await loadConfig(join(tmpDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('throws on invalid JSON', async () => {
    const filePath = join(tmpDir, 'bad.json');
    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, 'not-json', 'utf-8');

    await expect(loadConfig(filePath)).rejects.toThrow();
  });

  it('overwrites existing config file', async () => {
    const filePath = join(tmpDir, 'config.json');
    const config1 = makeValidConfig();
    const config2 = makeValidConfig({ server: { port: 4000 } });

    await saveConfig(config1, filePath);
    await saveConfig(config2, filePath);
    const loaded = await loadConfig(filePath);

    expect(loaded).toEqual(config2);
  });
});

describe('validateConfig', () => {
  it('returns valid for a complete config', () => {
    const result = validateConfig(makeValidConfig());
    expect(result.valid).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it('detects missing google.serviceAccountKey (empty object)', () => {
    const config = makeValidConfig();
    config.google.serviceAccountKey = {};
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('google.serviceAccountKey');
  });

  it('detects missing google.spreadsheetId', () => {
    const config = makeValidConfig();
    config.google.spreadsheetId = '';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('google.spreadsheetId');
  });

  it('detects missing figma.accessToken', () => {
    const config = makeValidConfig();
    config.figma.accessToken = '';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('figma.accessToken');
  });

  it('detects missing figma.fileKey', () => {
    const config = makeValidConfig();
    config.figma.fileKey = '';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('figma.fileKey');
  });

  it('detects missing figma.templateNodeId', () => {
    const config = makeValidConfig();
    config.figma.templateNodeId = '';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('figma.templateNodeId');
  });

  it('reports all missing fields at once', () => {
    const config = makeValidConfig();
    config.google.serviceAccountKey = {};
    config.google.spreadsheetId = '';
    config.figma.accessToken = '';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toHaveLength(3);
    expect(result.missingFields).toContain('google.serviceAccountKey');
    expect(result.missingFields).toContain('google.spreadsheetId');
    expect(result.missingFields).toContain('figma.accessToken');
  });

  it('detects whitespace-only strings as invalid', () => {
    const config = makeValidConfig();
    config.google.spreadsheetId = '   ';
    config.figma.fileKey = '\t\n';
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('google.spreadsheetId');
    expect(result.missingFields).toContain('figma.fileKey');
  });
});
