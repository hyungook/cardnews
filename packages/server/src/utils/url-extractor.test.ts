import { describe, it, expect } from 'vitest';
import { extractSpreadsheetId, extractFolderId, extractFigmaFileKey } from './url-extractor.js';

describe('extractSpreadsheetId', () => {
  it('extracts ID from standard spreadsheet URL', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit#gid=0';
    expect(extractSpreadsheetId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
  });

  it('extracts ID from URL without trailing path', () => {
    const url = 'https://docs.google.com/spreadsheets/d/abc123_-XYZ/';
    expect(extractSpreadsheetId(url)).toBe('abc123_-XYZ');
  });

  it('extracts ID from URL with query params', () => {
    const url = 'https://docs.google.com/spreadsheets/d/mySheetId/edit?usp=sharing';
    expect(extractSpreadsheetId(url)).toBe('mySheetId');
  });

  it('returns null for non-spreadsheet URL', () => {
    expect(extractSpreadsheetId('https://google.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractSpreadsheetId('')).toBeNull();
  });

  it('returns null for drive folder URL', () => {
    const url = 'https://drive.google.com/drive/folders/1abc';
    expect(extractSpreadsheetId(url)).toBeNull();
  });
});

describe('extractFolderId', () => {
  it('extracts ID from standard drive folder URL', () => {
    const url = 'https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';
    expect(extractFolderId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms');
  });

  it('extracts ID from URL with query params', () => {
    const url = 'https://drive.google.com/drive/folders/1abc_-XYZ?usp=sharing';
    expect(extractFolderId(url)).toBe('1abc_-XYZ');
  });

  it('extracts ID from URL with resource key', () => {
    const url = 'https://drive.google.com/drive/folders/folderId123?resourcekey=abc';
    expect(extractFolderId(url)).toBe('folderId123');
  });

  it('returns null for non-folder URL', () => {
    expect(extractFolderId('https://drive.google.com/file/d/abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFolderId('')).toBeNull();
  });

  it('returns null for spreadsheet URL', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1abc/edit';
    expect(extractFolderId(url)).toBeNull();
  });
});

describe('extractFigmaFileKey', () => {
  it('extracts key from /file/ URL', () => {
    const url = 'https://www.figma.com/file/AbCdEf123/My-Design?node-id=0%3A1';
    expect(extractFigmaFileKey(url)).toBe('AbCdEf123');
  });

  it('extracts key from /design/ URL', () => {
    const url = 'https://www.figma.com/design/XyZ789_-abc/Project-Name';
    expect(extractFigmaFileKey(url)).toBe('XyZ789_-abc');
  });

  it('extracts key from URL without trailing path', () => {
    const url = 'https://www.figma.com/file/key123/';
    expect(extractFigmaFileKey(url)).toBe('key123');
  });

  it('extracts key from URL without www prefix', () => {
    const url = 'https://figma.com/file/key456/Design';
    expect(extractFigmaFileKey(url)).toBe('key456');
  });

  it('returns null for Figma prototype URL', () => {
    const url = 'https://www.figma.com/proto/abc123/Design';
    expect(extractFigmaFileKey(url)).toBeNull();
  });

  it('returns null for non-Figma URL', () => {
    expect(extractFigmaFileKey('https://google.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractFigmaFileKey('')).toBeNull();
  });
});
