import { describe, it, expect } from 'vitest';
import { resolvePattern, getBackgroundFilename, getLogoFilename } from './file-naming.js';
import type { CardNewsRow, FileNamingPattern } from '@card-news/shared';

describe('resolvePattern', () => {
  it('replaces {title} with the movie title', () => {
    expect(resolvePattern('{title}.jpg', '인사이드아웃')).toBe('인사이드아웃.jpg');
  });

  it('replaces multiple {title} occurrences', () => {
    expect(resolvePattern('{title}_{title}.jpg', 'A')).toBe('A_A.jpg');
  });

  it('handles prefix pattern', () => {
    expect(resolvePattern('LI_{title}.png', '범죄도시4')).toBe('LI_범죄도시4.png');
  });

  it('returns pattern as-is if no {title} placeholder', () => {
    expect(resolvePattern('fixed.jpg', '영화')).toBe('fixed.jpg');
  });
});

function makeRow(overrides: Partial<CardNewsRow> = {}): CardNewsRow {
  return {
    rowIndex: 2,
    movieTitle: '테스트영화',
    mainText: '문구',
    subText: '',
    badge1: '', badge2: '', badge3: '', badge4: '',
    copyright: '',
    ...overrides,
  };
}

const defaultNaming: FileNamingPattern = {
  backgroundPattern: '{title}.jpg',
  logoPattern: 'LI_{title}.png',
};

describe('getBackgroundFilename', () => {
  it('generates filename from pattern when no override', () => {
    const row = makeRow({ movieTitle: '가나다' });
    expect(getBackgroundFilename(row, defaultNaming)).toBe('가나다.jpg');
  });

  it('uses override when provided', () => {
    const row = makeRow({ movieTitle: '가나다', backgroundFilenameOverride: 'custom_bg.jpg' });
    expect(getBackgroundFilename(row, defaultNaming)).toBe('custom_bg.jpg');
  });

  it('ignores empty override', () => {
    const row = makeRow({ movieTitle: '가나다', backgroundFilenameOverride: '  ' });
    expect(getBackgroundFilename(row, defaultNaming)).toBe('가나다.jpg');
  });

  it('uses custom pattern', () => {
    const row = makeRow({ movieTitle: '가나다' });
    const custom: FileNamingPattern = { backgroundPattern: 'BG_{title}.png', logoPattern: '' };
    expect(getBackgroundFilename(row, custom)).toBe('BG_가나다.png');
  });
});

describe('getLogoFilename', () => {
  it('generates filename from pattern when no override', () => {
    const row = makeRow({ movieTitle: '가나다' });
    expect(getLogoFilename(row, defaultNaming)).toBe('LI_가나다.png');
  });

  it('uses override when provided', () => {
    const row = makeRow({ movieTitle: '가나다', logoFilenameOverride: 'my_logo.png' });
    expect(getLogoFilename(row, defaultNaming)).toBe('my_logo.png');
  });

  it('ignores empty override', () => {
    const row = makeRow({ movieTitle: '가나다', logoFilenameOverride: '' });
    expect(getLogoFilename(row, defaultNaming)).toBe('LI_가나다.png');
  });
});
