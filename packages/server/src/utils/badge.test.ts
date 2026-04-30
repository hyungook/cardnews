import { describe, it, expect } from 'vitest';
import { normalizeBadgeName, determineBadgeVariant } from './badge.js';

describe('normalizeBadgeName', () => {
  it('returns canonical name for exact match', () => {
    expect(normalizeBadgeName('무료')).toBe('무료');
    expect(normalizeBadgeName('UHD')).toBe('UHD');
    expect(normalizeBadgeName('Dolby ATMOS')).toBe('Dolby ATMOS');
  });

  it('matches case-insensitively', () => {
    expect(normalizeBadgeName('uhd')).toBe('UHD');
    expect(normalizeBadgeName('dolby vision')).toBe('Dolby VISION');
    expect(normalizeBadgeName('DOLBY ATMOS')).toBe('Dolby ATMOS');
    expect(normalizeBadgeName('ai 보이스')).toBe('AI 보이스');
    expect(normalizeBadgeName('u+독점')).toBe('U+독점');
    expect(normalizeBadgeName('u+stage')).toBe('U+STAGE');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeBadgeName('  무료  ')).toBe('무료');
    expect(normalizeBadgeName('\tUHD\n')).toBe('UHD');
    expect(normalizeBadgeName('  Dolby VISION  ')).toBe('Dolby VISION');
  });

  it('returns null for invalid badge names', () => {
    expect(normalizeBadgeName('없는뱃지')).toBeNull();
    expect(normalizeBadgeName('FREE')).toBeNull();
    expect(normalizeBadgeName('random')).toBeNull();
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeBadgeName('')).toBeNull();
    expect(normalizeBadgeName('   ')).toBeNull();
    expect(normalizeBadgeName('\t')).toBeNull();
  });

  it('handles all 20 valid badges', () => {
    const allBadges = [
      '무료', 'UHD', 'AI 보이스', '사전예약', '할인',
      '프리미엄무료', '가격인하', '소장', 'HD', '우리말',
      '예고편', '가치봄-자막+수어', 'Dolby ATMOS', 'Dolby VISION',
      'Dolby VISION-ATMOS', '이벤트', 'U+독점', 'U+오리지널',
      'U+STAGE', '유플레이',
    ];
    for (const badge of allBadges) {
      expect(normalizeBadgeName(badge)).toBe(badge);
    }
  });
});

describe('determineBadgeVariant', () => {
  it('returns count=0 with empty badges array', () => {
    const result = determineBadgeVariant([]);
    expect(result.count).toBe(0);
    expect(result.badges).toEqual([]);
    expect(result.invalidBadges).toEqual([]);
  });

  it('returns count=0 when all badges are empty strings', () => {
    const result = determineBadgeVariant(['', '', '', '']);
    expect(result.count).toBe(0);
    expect(result.badges).toEqual([]);
    expect(result.invalidBadges).toEqual([]);
  });

  it('returns correct count and badges for valid inputs', () => {
    const result = determineBadgeVariant(['무료', 'UHD', '', '']);
    expect(result.count).toBe(2);
    expect(result.badges).toEqual([
      { name: '무료', position: 1 },
      { name: 'UHD', position: 2 },
    ]);
    expect(result.invalidBadges).toEqual([]);
  });

  it('normalizes badge names in the result', () => {
    const result = determineBadgeVariant(['  uhd  ', 'dolby vision']);
    expect(result.count).toBe(2);
    expect(result.badges[0].name).toBe('UHD');
    expect(result.badges[1].name).toBe('Dolby VISION');
  });

  it('collects invalid badges separately', () => {
    const result = determineBadgeVariant(['무료', '없는뱃지', 'UHD', 'FAKE']);
    expect(result.count).toBe(2);
    expect(result.badges).toEqual([
      { name: '무료', position: 1 },
      { name: 'UHD', position: 2 },
    ]);
    expect(result.invalidBadges).toEqual(['없는뱃지', 'FAKE']);
  });

  it('assigns sequential positions starting from 1', () => {
    const result = determineBadgeVariant(['', '무료', '', 'HD']);
    expect(result.badges).toEqual([
      { name: '무료', position: 1 },
      { name: 'HD', position: 2 },
    ]);
  });

  it('handles all 4 valid badges', () => {
    const result = determineBadgeVariant(['무료', 'UHD', 'HD', '소장']);
    expect(result.count).toBe(4);
    expect(result.badges).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(result.badges[i].position).toBe(i + 1);
    }
  });
});
