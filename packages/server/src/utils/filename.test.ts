import { describe, it, expect } from 'vitest';
import { generateFilename } from './filename.js';

describe('generateFilename', () => {
  it('returns base filename when no duplicates exist', () => {
    expect(generateFilename('인사이드 아웃', [])).toBe('카드뉴스_(인사이드 아웃).jpg');
  });

  it('returns base filename when existing files have different titles', () => {
    const existing = ['카드뉴스_(다른영화).jpg'];
    expect(generateFilename('인사이드 아웃', existing)).toBe('카드뉴스_(인사이드 아웃).jpg');
  });

  it('adds _02 suffix when base filename already exists', () => {
    const existing = ['카드뉴스_(인사이드 아웃).jpg'];
    expect(generateFilename('인사이드 아웃', existing)).toBe('카드뉴스_(인사이드 아웃)_02.jpg');
  });

  it('adds _03 suffix when _02 also exists', () => {
    const existing = [
      '카드뉴스_(인사이드 아웃).jpg',
      '카드뉴스_(인사이드 아웃)_02.jpg',
    ];
    expect(generateFilename('인사이드 아웃', existing)).toBe('카드뉴스_(인사이드 아웃)_03.jpg');
  });

  it('increments suffix correctly for many duplicates', () => {
    const existing = [
      '카드뉴스_(테스트).jpg',
      '카드뉴스_(테스트)_02.jpg',
      '카드뉴스_(테스트)_03.jpg',
      '카드뉴스_(테스트)_04.jpg',
    ];
    expect(generateFilename('테스트', existing)).toBe('카드뉴스_(테스트)_05.jpg');
  });

  it('handles empty movie title', () => {
    expect(generateFilename('', [])).toBe('카드뉴스_().jpg');
  });

  it('handles movie title with special characters', () => {
    expect(generateFilename('범죄도시 4: 리턴', [])).toBe('카드뉴스_(범죄도시 4: 리턴).jpg');
  });

  it('first file never has a suffix', () => {
    const result = generateFilename('영화', []);
    expect(result).not.toMatch(/_\d{2}\.jpg$/);
    expect(result).toBe('카드뉴스_(영화).jpg');
  });

  it('fills gaps in numbering sequence', () => {
    // If _02 is missing but base and _03 exist, it should return _02
    const existing = [
      '카드뉴스_(영화).jpg',
      '카드뉴스_(영화)_03.jpg',
    ];
    expect(generateFilename('영화', existing)).toBe('카드뉴스_(영화)_02.jpg');
  });

  it('pads single-digit suffix with leading zero', () => {
    const existing = ['카드뉴스_(영화).jpg'];
    const result = generateFilename('영화', existing);
    expect(result).toBe('카드뉴스_(영화)_02.jpg');
    expect(result).toMatch(/_02\.jpg$/);
  });
});
