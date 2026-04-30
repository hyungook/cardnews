import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportManager, convertToJpg } from './export-manager.js';

// Mock LocalStorage functions
vi.mock('../local/local-storage.js', () => ({
  saveResult: vi.fn().mockResolvedValue('result-file-id'),
  listResultFilenames: vi.fn().mockResolvedValue([]),
}));

// Mock sharp
vi.mock('sharp', () => {
  return {
    default: vi.fn(),
  };
});

import sharp from 'sharp';

/** Helper: create a mock orchestrator */
function createMockOrchestrator() {
  return {
    exportImage: vi.fn(),
    cacheTemplateSpec: vi.fn(),
    cloneFrame: vi.fn(),
    setTextLayer: vi.fn(),
    hideLayer: vi.fn(),
    replaceImage: vi.fn(),
    switchBadgeVariant: vi.fn(),
    checkOverflow: vi.fn(),
    deleteFrames: vi.fn(),
    clearCache: vi.fn(),
  };
}

/** Helper: set up sharp mock to return buffer of given size */
function setupSharpMock(sizeOrSizes: number | number[]) {
  const sizes = Array.isArray(sizeOrSizes) ? sizeOrSizes : [sizeOrSizes];
  let callIndex = 0;

  const mockSharp = sharp as unknown as ReturnType<typeof vi.fn>;
  mockSharp.mockImplementation(() => ({
    jpeg: vi.fn().mockReturnValue({
      toBuffer: vi.fn().mockImplementation(() => {
        const size = sizes[Math.min(callIndex++, sizes.length - 1)];
        return Promise.resolve(Buffer.alloc(size));
      }),
    }),
  }));
}

describe('ExportManager', () => {
  let orchestrator: ReturnType<typeof createMockOrchestrator>;
  let manager: ExportManager;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = createMockOrchestrator();
    manager = new ExportManager(
      orchestrator as any,
    );

    // Default: exportImage returns a fake PNG buffer
    orchestrator.exportImage.mockResolvedValue(Buffer.from('fake-png'));
  });

  describe('exportWithQualityAdjustment', () => {
    it('should use 80% quality when file size is within limit', async () => {
      setupSharpMock(400_000); // 400KB < 500KB

      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '어벤져스',
        [],
      );

      expect(result.success).toBe(true);
      expect(result.quality).toBe(80);
      expect(result.sizeWarning).toBe(false);
      expect(result.filename).toBe('카드뉴스_(어벤져스).jpg');
    });

    it('should reduce quality to 75% when 80% exceeds 500KB', async () => {
      // 80% → 600KB (too big), 75% → 450KB (ok)
      setupSharpMock([600_000, 450_000]);

      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '인터스텔라',
        [],
      );

      expect(result.quality).toBe(75);
      expect(result.fileSize).toBe(450_000);
      expect(result.sizeWarning).toBe(false);
    });

    it('should reduce quality to 70% when 75% still exceeds 500KB', async () => {
      // 80% → 600KB, 75% → 550KB, 70% → 480KB
      setupSharpMock([600_000, 550_000, 480_000]);

      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '기생충',
        [],
      );

      expect(result.quality).toBe(70);
      expect(result.fileSize).toBe(480_000);
      expect(result.sizeWarning).toBe(false);
    });

    it('should set sizeWarning when 70% still exceeds 500KB', async () => {
      // All qualities exceed 500KB
      setupSharpMock([700_000, 650_000, 600_000]);

      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '올드보이',
        [],
      );

      expect(result.quality).toBe(70);
      expect(result.fileSize).toBe(600_000);
      expect(result.sizeWarning).toBe(true);
    });

    it('should export as PNG from Figma (not JPG)', async () => {
      setupSharpMock(300_000);

      await manager.exportWithQualityAdjustment('node-42', '매트릭스', []);

      expect(orchestrator.exportImage).toHaveBeenCalledWith('node-42', 1, 'png');
    });

    it('should generate unique filename with duplicate handling', async () => {
      setupSharpMock(300_000);

      const existingFiles = ['카드뉴스_(매트릭스).jpg'];
      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '매트릭스',
        existingFiles,
      );

      expect(result.filename).toBe('카드뉴스_(매트릭스)_02.jpg');
    });

    it('should upload to local storage and return file ID', async () => {
      const { saveResult } = await import('../local/local-storage.js');
      setupSharpMock(300_000);
      (saveResult as any).mockResolvedValueOnce('result-file-id');

      const result = await manager.exportWithQualityAdjustment(
        'node-1',
        '부산행',
        [],
      );

      expect(saveResult).toHaveBeenCalledWith(
        '카드뉴스_(부산행).jpg',
        expect.any(Buffer),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });
  });
});
