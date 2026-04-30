import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppConfig, HistoryRecord } from '@card-news/shared';
import { SpreadsheetReader } from './sheets-reader.js';

// Mock googleapis
vi.mock('googleapis', () => {
  const mockGet = vi.fn();
  const mockUpdate = vi.fn();
  const mockAppend = vi.fn();

  return {
    google: {
      sheets: () => ({
        spreadsheets: {
          values: {
            get: mockGet,
            update: mockUpdate,
            append: mockAppend,
          },
        },
      }),
    },
    __mockGet: mockGet,
    __mockUpdate: mockUpdate,
    __mockAppend: mockAppend,
  };
});

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn(),
}));

async function getMocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocked = vi.mocked(await import('googleapis')) as any;
  return {
    mockGet: mocked.__mockGet as ReturnType<typeof vi.fn>,
    mockUpdate: mocked.__mockUpdate as ReturnType<typeof vi.fn>,
    mockAppend: mocked.__mockAppend as ReturnType<typeof vi.fn>,
  };
}

const testConfig: AppConfig = {
  google: {
    serviceAccountKey: { type: 'service_account', project_id: 'test' },
    spreadsheetId: 'test-spreadsheet-id',
  },
  figma: {
    accessToken: 'test-token',
    fileKey: 'test-file-key',
    templateNodeId: 'test-node-id',
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

describe('SpreadsheetReader', () => {
  let reader: SpreadsheetReader;

  beforeEach(() => {
    vi.clearAllMocks();
    reader = new SpreadsheetReader(testConfig);
  });

  describe('readAllRows', () => {
    it('빈 스프레드시트에서 빈 배열을 반환한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({ data: { values: [] } });

      const rows = await reader.readAllRows();
      expect(rows).toEqual([]);
    });

    it('행 데이터를 CardNewsRow로 파싱한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({
        data: {
          values: [
            ['영화A', '기본문구', '추가문구', '무료', 'UHD', '', '', '© 2024'],
          ],
        },
      });

      const rows = await reader.readAllRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        rowIndex: 2,
        movieTitle: '영화A',
        mainText: '기본문구',
        subText: '추가문구',
        badge1: '무료',
        badge2: 'UHD',
        badge3: '',
        badge4: '',
        copyright: '© 2024',
        backgroundFilenameOverride: '',
        logoFilenameOverride: '',
      });
    });

    it('여러 행을 올바른 rowIndex로 파싱한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({
        data: {
          values: [
            ['영화A', '', '', '', '', '', '', ''],
            ['영화B', '', '', '', '', '', '', ''],
          ],
        },
      });

      const rows = await reader.readAllRows();
      expect(rows).toHaveLength(2);
      expect(rows[0].rowIndex).toBe(2);
      expect(rows[1].rowIndex).toBe(3);
    });

    it('values가 undefined이면 빈 배열을 반환한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({ data: {} });

      const rows = await reader.readAllRows();
      expect(rows).toEqual([]);
    });
  });

  describe('updateCell', () => {
    it('올바른 범위와 값으로 API를 호출한다', async () => {
      const { mockUpdate } = await getMocks();
      mockUpdate.mockResolvedValue({});

      await reader.updateCell(3, 0, '새 값');

      expect(mockUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'A3',
        valueInputOption: 'RAW',
        requestBody: { values: [['새 값']] },
      });
    });

    it('열 번호를 올바른 문자로 변환한다', async () => {
      const { mockUpdate } = await getMocks();
      mockUpdate.mockResolvedValue({});

      await reader.updateCell(5, 9, '카피라이트');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ range: 'J5' }),
      );
    });
  });

  describe('appendHistory', () => {
    it('히스토리 레코드를 올바른 형식으로 추가한다', async () => {
      const { mockAppend } = await getMocks();
      mockAppend.mockResolvedValue({});

      const record: HistoryRecord = {
        id: 'test-uuid',
        createdAt: '2024-01-01T00:00:00Z',
        totalCount: 5,
        successCount: 4,
        errorCount: 1,
        files: [{ filename: 'test.jpg', movieTitle: '영화A', rowIndex: 2 }],
        errors: [{ rowIndex: 3, movieTitle: '영화B', errorType: 'BADGE_INVALID', message: '오류' }],
      };

      await reader.appendHistory(record);

      expect(mockAppend).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: '히스토리!A:G',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'test-uuid',
            '2024-01-01T00:00:00Z',
            5,
            4,
            1,
            JSON.stringify(record.files),
            JSON.stringify(record.errors),
          ]],
        },
      });
    });
  });

  describe('readHistory', () => {
    it('히스토리 데이터를 HistoryRecord로 파싱한다', async () => {
      const { mockGet } = await getMocks();
      const files = [{ filename: 'test.jpg', driveFileId: 'f1', movieTitle: '영화A', rowIndex: 2 }];
      const errors = [{ rowIndex: 3, movieTitle: '영화B', errorType: 'BADGE_INVALID', message: '오류' }];

      mockGet.mockResolvedValue({
        data: {
          values: [
            ['uuid-1', '2024-01-01T00:00:00Z', '5', '4', '1', JSON.stringify(files), JSON.stringify(errors)],
          ],
        },
      });

      const history = await reader.readHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        id: 'uuid-1',
        createdAt: '2024-01-01T00:00:00Z',
        totalCount: 5,
        successCount: 4,
        errorCount: 1,
        files,
        errors,
      });
    });

    it('빈 히스토리에서 빈 배열을 반환한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({ data: { values: [] } });

      const history = await reader.readHistory();
      expect(history).toEqual([]);
    });

    it('잘못된 JSON은 빈 배열로 폴백한다', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockResolvedValue({
        data: {
          values: [
            ['uuid-1', '2024-01-01T00:00:00Z', '5', '4', '1', 'invalid-json', ''],
          ],
        },
      });

      const history = await reader.readHistory();
      expect(history[0].files).toEqual([]);
      expect(history[0].errors).toEqual([]);
    });
  });
});
