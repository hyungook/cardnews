import { describe, it, expect } from 'vitest';
import { parseRow, serializeRow } from './spreadsheet-row.js';

describe('parseRow', () => {
  it('should parse a full cell array into CardNewsRow', () => {
    const cells = [
      '범죄도시4', '올 여름\n최고의 액션', '제62회 대종상 수상',
      '무료', 'UHD', '', '', '© 2024 ABO',
    ];
    const row = parseRow(cells, 3);

    expect(row).toEqual({
      rowIndex: 3,
      movieTitle: '범죄도시4',
      mainText: '올 여름\n최고의 액션',
      subText: '제62회 대종상 수상',
      badge1: '무료',
      badge2: 'UHD',
      badge3: '',
      badge4: '',
      copyright: '© 2024 ABO',
      backgroundFilenameOverride: '',
      logoFilenameOverride: '',
    });
  });

  it('should preserve empty values as empty strings', () => {
    const cells = ['제목', '문구', '', '', '', '', '', ''];
    const row = parseRow(cells, 1);

    expect(row.subText).toBe('');
    expect(row.badge1).toBe('');
    expect(row.copyright).toBe('');
  });

  it('should handle cells array shorter than expected', () => {
    const cells = ['제목', '문구'];
    const row = parseRow(cells, 5);

    expect(row.movieTitle).toBe('제목');
    expect(row.mainText).toBe('문구');
    expect(row.badge1).toBe('');
    expect(row.copyright).toBe('');
  });

  it('should preserve line breaks in mainText', () => {
    const cells = ['제목', '첫째줄\n둘째줄\n셋째줄', '', '', '', '', '', ''];
    const row = parseRow(cells, 2);

    expect(row.mainText).toBe('첫째줄\n둘째줄\n셋째줄');
  });

  it('should parse override filenames from columns I and J', () => {
    const cells = ['제목', '문구', '', '', '', '', '', '', 'custom_bg.jpg', 'custom_logo.png'];
    const row = parseRow(cells, 2);

    expect(row.backgroundFilenameOverride).toBe('custom_bg.jpg');
    expect(row.logoFilenameOverride).toBe('custom_logo.png');
  });
});

describe('serializeRow', () => {
  it('should serialize CardNewsRow to cell array in correct column order', () => {
    const row = {
      rowIndex: 3,
      movieTitle: '범죄도시4',
      mainText: '올 여름\n최고의 액션',
      subText: '제62회 대종상 수상',
      badge1: '무료',
      badge2: 'UHD',
      badge3: '',
      badge4: '',
      copyright: '© 2024 ABO',
      backgroundFilenameOverride: '',
      logoFilenameOverride: '',
    };
    const cells = serializeRow(row);

    expect(cells).toEqual([
      '범죄도시4', '올 여름\n최고의 액션', '제62회 대종상 수상',
      '무료', 'UHD', '', '', '© 2024 ABO', '', '',
    ]);
  });

  it('should not include rowIndex in the output', () => {
    const row = {
      rowIndex: 99,
      movieTitle: 'A',
      mainText: 'D',
      subText: '',
      badge1: '', badge2: '', badge3: '', badge4: '',
      copyright: '',
    };
    const cells = serializeRow(row);

    expect(cells).toHaveLength(10);
    expect(cells).not.toContain(99);
  });
});

describe('parseRow → serializeRow roundtrip', () => {
  it('should produce the same cell array after parse then serialize', () => {
    const original = [
      '영화제목', '기본\n문구', '추가문구',
      '무료', 'UHD', '', 'HD', '© test', '', '',
    ];
    const row = parseRow(original, 1);
    const result = serializeRow(row);

    expect(result).toEqual(original);
  });
});
