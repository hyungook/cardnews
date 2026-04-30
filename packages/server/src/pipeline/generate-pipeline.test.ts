import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneratePipeline, PipelineError, delay } from './generate-pipeline.js';
import type { PipelineDeps } from './generate-pipeline.js';
import type { AppConfig, CardNewsRow, OverflowResult, ExportResult } from '@card-news/shared';

// Mock LocalStorage functions
vi.mock('../local/local-storage.js', () => ({
  readBackground: vi.fn().mockResolvedValue(Buffer.from('bg-data')),
  readLogo: vi.fn().mockResolvedValue(Buffer.from('logo-data')),
  listResultFilenames: vi.fn().mockResolvedValue([]),
}));

/** Helper to create a valid CardNewsRow */
function makeRow(overrides: Partial<CardNewsRow> = {}): CardNewsRow {
  return {
    rowIndex: 2,
    movieTitle: '테스트영화',
    mainText: '첫 번째 줄',
    subText: '추가문구',
    badge1: '무료',
    badge2: '',
    badge3: '',
    badge4: '',
    copyright: '© 2024',
    ...overrides,
  };
}

const mockConfig: AppConfig = {
  google: {
    serviceAccountKey: { type: 'service_account' },
    spreadsheetId: 'sheet-id',
  },
  figma: {
    accessToken: 'token',
    fileKey: 'file-key',
    templateNodeId: 'template-node',
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

function createMockDeps(rows: CardNewsRow[] = [makeRow()]): PipelineDeps {
  const noOverflow: OverflowResult = {
    isOverflowing: false,
    textBounds: { x: 10, y: 10, width: 100, height: 50 },
    parentBounds: { x: 0, y: 0, width: 200, height: 200 },
    overflowX: 0,
    overflowY: 0,
  };

  const exportResult: ExportResult = {
    success: true,
    filename: '카드뉴스_(테스트영화).jpg',
    quality: 80,
    fileSize: 400_000,
    sizeWarning: false,
  };

  return {
    sheetsReader: {
      readAllRows: vi.fn().mockResolvedValue(rows),
      updateCell: vi.fn().mockResolvedValue(undefined),
      appendHistory: vi.fn().mockResolvedValue(undefined),
      readHistory: vi.fn().mockResolvedValue([]),
    } as any,
    orchestrator: {
      cacheTemplateSpec: vi.fn().mockResolvedValue({ templateNodeId: 'template-node', layers: {}, cachedAt: Date.now() }),
      cloneFrame: vi.fn().mockResolvedValue('cloned-frame-1'),
      setTextLayer: vi.fn().mockResolvedValue(undefined),
      hideLayer: vi.fn().mockResolvedValue(undefined),
      replaceImage: vi.fn().mockResolvedValue(undefined),
      switchBadgeVariant: vi.fn().mockResolvedValue(undefined),
      checkOverflow: vi.fn().mockResolvedValue(noOverflow),
      deleteFrames: vi.fn().mockResolvedValue(undefined),
      exportImage: vi.fn().mockResolvedValue(Buffer.from('image-data')),
    } as any,
    exportManager: {
      exportWithQualityAdjustment: vi.fn().mockResolvedValue(exportResult),
    } as any,
  };
}

describe('GeneratePipeline', () => {
  it('should process a single valid row successfully', async () => {
    const row = makeRow();
    const deps = createMockDeps([row]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.status).toBe('completed');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe('success');
    expect(result.results[0].rowIndex).toBe(2);
    expect(deps.sheetsReader.appendHistory).toHaveBeenCalledOnce();
  });

  it('should skip rows with invalid badges and continue', async () => {
    const goodRow = makeRow({ rowIndex: 2 });
    const badRow = makeRow({ rowIndex: 3, badge1: '존재하지않는뱃지' });
    const deps = createMockDeps([goodRow, badRow]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2, 3]);

    expect(result.status).toBe('completed');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('error');
    expect(result.results[1].error).toContain('유효하지 않습니다');
  });

  it('should skip rows exceeding line limit', async () => {
    const row = makeRow({ mainText: '줄1\n줄2\n줄3\n줄4' });
    const deps = createMockDeps([row]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.status).toBe('completed');
    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toContain('3줄');
  });

  it('should skip rows with text overflow', async () => {
    const row = makeRow();
    const deps = createMockDeps([row]);
    (deps.orchestrator.checkOverflow as any).mockResolvedValue({
      isOverflowing: true,
      textBounds: { x: 0, y: 0, width: 300, height: 300 },
      parentBounds: { x: 0, y: 0, width: 200, height: 200 },
      overflowX: 100,
      overflowY: 100,
    });
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toContain('초과');
  });

  it('should hide subText and copyright layers when empty', async () => {
    const row = makeRow({ subText: '', copyright: '' });
    const deps = createMockDeps([row]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    await pipeline.run([2]);

    expect(deps.orchestrator.hideLayer).toHaveBeenCalledWith('cloned-frame-1', 'sub_text');
    expect(deps.orchestrator.hideLayer).toHaveBeenCalledWith('cloned-frame-1', 'copyright');
  });

  it('should hide badge_container when no badges', async () => {
    const row = makeRow({ badge1: '', badge2: '', badge3: '', badge4: '' });
    const deps = createMockDeps([row]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    await pipeline.run([2]);

    expect(deps.orchestrator.hideLayer).toHaveBeenCalledWith('cloned-frame-1', 'badge_container');
  });

  it('should handle file not found errors gracefully', async () => {
    const { readBackground } = await import('../local/local-storage.js');
    const row = makeRow();
    const deps = createMockDeps([row]);
    (readBackground as any).mockRejectedValueOnce(new Error('파일을 찾을 수 없습니다'));
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toContain('배경 이미지');
  });

  it('should emit progress events', async () => {
    const row = makeRow();
    const deps = createMockDeps([row]);
    const pipeline = new GeneratePipeline(deps, mockConfig);
    const progressEvents: any[] = [];
    pipeline.on('progress', (p) => progressEvents.push(p));

    await pipeline.run([2]);

    expect(progressEvents.length).toBeGreaterThan(0);
    const last = progressEvents[progressEvents.length - 1];
    expect(last.status).toBe('completed');
  });

  it('should return completed with empty results when no matching rows', async () => {
    const deps = createMockDeps([makeRow({ rowIndex: 5 })]);
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([99]);

    expect(result.status).toBe('completed');
    expect(result.results).toHaveLength(0);
  });

  it('should record sizeWarning in results', async () => {
    const row = makeRow();
    const deps = createMockDeps([row]);
    (deps.exportManager.exportWithQualityAdjustment as any).mockResolvedValue({
      success: true,
      filename: '카드뉴스_(테스트영화).jpg',
      quality: 70,
      fileSize: 600_000,
      sizeWarning: true,
    });
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.results[0].status).toBe('warning');
    expect(result.results[0].sizeWarning).toBe(true);
  });

  it('should retry on rate limit errors with backoff', async () => {
    const row = makeRow();
    const deps = createMockDeps([row]);
    let callCount = 0;
    (deps.orchestrator.cloneFrame as any).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('429 Rate Limit');
      return 'cloned-frame-1';
    });
    const pipeline = new GeneratePipeline(deps, mockConfig);

    const result = await pipeline.run([2]);

    expect(result.status).toBe('completed');
    expect(callCount).toBe(2);
  }, 10000); // 10초 타임아웃
});

describe('PipelineError', () => {
  it('should carry errorType', () => {
    const err = new PipelineError('BADGE_INVALID', 'test');
    expect(err.errorType).toBe('BADGE_INVALID');
    expect(err.message).toBe('test');
  });
});

describe('delay', () => {
  it('should resolve after specified ms', async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});
