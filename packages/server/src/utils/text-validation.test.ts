import { describe, it, expect } from 'vitest';
import { detectOverflow, validateLineCount } from './text-validation.js';
import type { BoundingBox } from '@card-news/shared';

describe('detectOverflow', () => {
  it('returns isOverflowing=false when text is fully inside parent', () => {
    const parent: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const text: BoundingBox = { x: 10, y: 10, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(false);
    expect(result.overflowX).toBe(0);
    expect(result.overflowY).toBe(0);
  });

  it('returns isOverflowing=false when text exactly matches parent', () => {
    const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const result = detectOverflow(bounds, bounds);
    expect(result.isOverflowing).toBe(false);
    expect(result.overflowX).toBe(0);
    expect(result.overflowY).toBe(0);
  });

  it('detects overflow on the right side', () => {
    const parent: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const text: BoundingBox = { x: 60, y: 0, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(true);
    expect(result.overflowX).toBe(10);
    expect(result.overflowY).toBe(0);
  });

  it('detects overflow on the left side', () => {
    const parent: BoundingBox = { x: 10, y: 0, width: 100, height: 100 };
    const text: BoundingBox = { x: 5, y: 10, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(true);
    expect(result.overflowX).toBe(5);
    expect(result.overflowY).toBe(0);
  });

  it('detects overflow on the bottom', () => {
    const parent: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const text: BoundingBox = { x: 0, y: 70, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(true);
    expect(result.overflowX).toBe(0);
    expect(result.overflowY).toBe(20);
  });

  it('detects overflow on the top', () => {
    const parent: BoundingBox = { x: 0, y: 20, width: 100, height: 100 };
    const text: BoundingBox = { x: 0, y: 10, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(true);
    expect(result.overflowX).toBe(0);
    expect(result.overflowY).toBe(10);
  });

  it('detects overflow on both axes', () => {
    const parent: BoundingBox = { x: 10, y: 10, width: 50, height: 50 };
    const text: BoundingBox = { x: 5, y: 5, width: 80, height: 80 };
    const result = detectOverflow(text, parent);
    expect(result.isOverflowing).toBe(true);
    expect(result.overflowX).toBeGreaterThan(0);
    expect(result.overflowY).toBeGreaterThan(0);
  });

  it('preserves textBounds and parentBounds in result', () => {
    const parent: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const text: BoundingBox = { x: 10, y: 10, width: 50, height: 50 };
    const result = detectOverflow(text, parent);
    expect(result.textBounds).toEqual(text);
    expect(result.parentBounds).toEqual(parent);
  });
});

describe('validateLineCount', () => {
  it('returns valid=true for single line', () => {
    const result = validateLineCount('hello');
    expect(result.valid).toBe(true);
    expect(result.lineCount).toBe(1);
  });

  it('returns valid=true for 3 lines', () => {
    const result = validateLineCount('line1\nline2\nline3');
    expect(result.valid).toBe(true);
    expect(result.lineCount).toBe(3);
  });

  it('returns valid=false for 4 lines', () => {
    const result = validateLineCount('a\nb\nc\nd');
    expect(result.valid).toBe(false);
    expect(result.lineCount).toBe(4);
  });

  it('returns valid=true for empty string (1 line)', () => {
    const result = validateLineCount('');
    expect(result.valid).toBe(true);
    expect(result.lineCount).toBe(1);
  });

  it('returns valid=false for many lines', () => {
    const result = validateLineCount('1\n2\n3\n4\n5\n6');
    expect(result.valid).toBe(false);
    expect(result.lineCount).toBe(6);
  });
});
