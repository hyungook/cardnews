import { describe, it, expect } from 'vitest';
import { calculateFileHash } from './file-hash.js';

describe('file-hash', () => {
  describe('calculateFileHash', () => {
    it('동일한 데이터는 동일한 해시를 생성해야 함', () => {
      const data = Buffer.from('test data');
      const hash1 = calculateFileHash(data);
      const hash2 = calculateFileHash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('다른 데이터는 다른 해시를 생성해야 함', () => {
      const data1 = Buffer.from('test data 1');
      const data2 = Buffer.from('test data 2');
      
      const hash1 = calculateFileHash(data1);
      const hash2 = calculateFileHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('SHA-256 해시는 64자 hex 문자열이어야 함', () => {
      const data = Buffer.from('test data');
      const hash = calculateFileHash(data);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('빈 데이터도 해시를 생성해야 함', () => {
      const data = Buffer.from('');
      const hash = calculateFileHash(data);
      
      expect(hash).toHaveLength(64);
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('큰 데이터도 해시를 생성해야 함', () => {
      const data = Buffer.alloc(1024 * 1024, 'a'); // 1MB
      const hash = calculateFileHash(data);
      
      expect(hash).toHaveLength(64);
    });
  });
});
