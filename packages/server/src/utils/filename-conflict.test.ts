import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = 'test-temp';
const TEST_FOLDER = '배경이미지';

// env 모킹 - 다른 모듈보다 먼저 실행되어야 함
vi.mock('../config/env.js', () => ({
  env: {
    BASE_DIR: 'test-temp',
  },
  isDevelopment: false,
}));

import { 
  resolveFilenameConflict, 
  fileExists, 
  resolveMultipleConflicts,
  generateUniqueFilename 
} from './filename-conflict.js';

describe('filename-conflict', () => {
  beforeEach(async () => {
    // 테스트 디렉토리 생성
    await mkdir(join(process.cwd(), TEST_DIR, TEST_FOLDER), { recursive: true });
  });

  afterEach(async () => {
    // 테스트 디렉토리 삭제
    await rm(join(process.cwd(), TEST_DIR), { recursive: true, force: true });
  });

  describe('resolveFilenameConflict', () => {
    it('충돌이 없으면 원본 파일명을 반환해야 함', () => {
      const result = resolveFilenameConflict(TEST_FOLDER, 'test.jpg');
      
      expect(result.originalFilename).toBe('test.jpg');
      expect(result.resolvedFilename).toBe('test.jpg');
      expect(result.hasConflict).toBe(false);
      expect(result.attemptNumber).toBe(0);
    });

    it('충돌이 있으면 번호를 붙인 파일명을 반환해야 함', async () => {
      // 기존 파일 생성
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test.jpg'), 'test');
      
      const result = resolveFilenameConflict(TEST_FOLDER, 'test.jpg');
      
      expect(result.originalFilename).toBe('test.jpg');
      expect(result.resolvedFilename).toBe('test_1.jpg');
      expect(result.hasConflict).toBe(true);
      expect(result.attemptNumber).toBe(1);
    });

    it('여러 충돌이 있으면 다음 번호를 찾아야 함', async () => {
      // 기존 파일들 생성
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test.jpg'), 'test');
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test_1.jpg'), 'test');
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test_2.jpg'), 'test');
      
      const result = resolveFilenameConflict(TEST_FOLDER, 'test.jpg');
      
      expect(result.resolvedFilename).toBe('test_3.jpg');
      expect(result.attemptNumber).toBe(3);
    });

    it('확장자가 여러 개인 파일명도 처리해야 함', async () => {
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test.tar.gz'), 'test');
      
      const result = resolveFilenameConflict(TEST_FOLDER, 'test.tar.gz');
      
      expect(result.resolvedFilename).toBe('test.tar_1.gz');
    });
  });

  describe('fileExists', () => {
    it('파일이 존재하면 true를 반환해야 함', async () => {
      await writeFile(join(process.cwd(), TEST_DIR, TEST_FOLDER, 'test.jpg'), 'test');
      
      expect(fileExists(TEST_FOLDER, 'test.jpg')).toBe(true);
    });

    it('파일이 존재하지 않으면 false를 반환해야 함', () => {
      expect(fileExists(TEST_FOLDER, 'nonexistent.jpg')).toBe(false);
    });
  });

  describe('resolveMultipleConflicts', () => {
    it('여러 파일명의 충돌을 일괄 해결해야 함', async () => {
      await writeFile(join(TEST_DIR, TEST_FOLDER, 'test.jpg'), 'test');
      
      const results = resolveMultipleConflicts(TEST_FOLDER, [
        'test.jpg',
        'test.jpg',
        'new.jpg',
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[0].resolvedFilename).toBe('test_1.jpg');
      expect(results[1].resolvedFilename).toBe('test_2.jpg');
      expect(results[2].resolvedFilename).toBe('new.jpg');
    });
  });

  describe('generateUniqueFilename', () => {
    it('타임스탬프를 포함한 파일명을 생성해야 함', () => {
      const result = generateUniqueFilename('test.jpg');
      
      expect(result).toMatch(/^test_\d+\.jpg$/);
    });

    it('확장자를 보존해야 함', () => {
      const result = generateUniqueFilename('test.png');
      
      expect(result).toMatch(/\.png$/);
    });

    it('연속 호출 시 다른 파일명을 생성해야 함', async () => {
      const result1 = generateUniqueFilename('test.jpg');
      // 1ms 대기하여 다른 타임스탬프 보장
      await new Promise(resolve => setTimeout(resolve, 1));
      const result2 = generateUniqueFilename('test.jpg');
      
      expect(result1).not.toBe(result2);
    });
  });
});
