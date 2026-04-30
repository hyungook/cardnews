import { describe, it, expect } from 'vitest';
import { determineLayerAction, determineOptionalFieldActions } from './layer-action.js';
import type { CardNewsRow } from '@card-news/shared';

describe('determineLayerAction', () => {
  it('returns hide action for empty string', () => {
    expect(determineLayerAction('')).toEqual({ action: 'hide' });
  });

  it('returns setText action for non-empty string', () => {
    expect(determineLayerAction('hello')).toEqual({ action: 'setText', text: 'hello' });
  });

  it('returns setText for whitespace-only string (not empty)', () => {
    expect(determineLayerAction('  ')).toEqual({ action: 'setText', text: '  ' });
  });

  it('returns setText for string with newlines', () => {
    const text = '첫째 줄\n둘째 줄';
    expect(determineLayerAction(text)).toEqual({ action: 'setText', text });
  });

  it('returns setText for Korean text', () => {
    expect(determineLayerAction('© 2024 영화사')).toEqual({
      action: 'setText',
      text: '© 2024 영화사',
    });
  });
});

describe('determineOptionalFieldActions', () => {
  const baseRow: CardNewsRow = {
    rowIndex: 1,
    movieTitle: '테스트 영화',
    mainText: '기본 문구',
    subText: '',
    badge1: '',
    badge2: '',
    badge3: '',
    badge4: '',
    copyright: '',
  };

  it('returns hide for both when subText and copyright are empty', () => {
    const result = determineOptionalFieldActions(baseRow);
    expect(result.subText).toEqual({ action: 'hide' });
    expect(result.copyright).toEqual({ action: 'hide' });
  });

  it('returns setText for subText when non-empty, hide for copyright when empty', () => {
    const row = { ...baseRow, subText: '추가 문구' };
    const result = determineOptionalFieldActions(row);
    expect(result.subText).toEqual({ action: 'setText', text: '추가 문구' });
    expect(result.copyright).toEqual({ action: 'hide' });
  });

  it('returns hide for subText when empty, setText for copyright when non-empty', () => {
    const row = { ...baseRow, copyright: '© 2024' };
    const result = determineOptionalFieldActions(row);
    expect(result.subText).toEqual({ action: 'hide' });
    expect(result.copyright).toEqual({ action: 'setText', text: '© 2024' });
  });

  it('returns setText for both when both are non-empty', () => {
    const row = { ...baseRow, subText: '수상 내역', copyright: '© Studio' };
    const result = determineOptionalFieldActions(row);
    expect(result.subText).toEqual({ action: 'setText', text: '수상 내역' });
    expect(result.copyright).toEqual({ action: 'setText', text: '© Studio' });
  });
});
