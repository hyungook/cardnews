import { describe, it, expect } from 'vitest';
import {
  validateFilename,
  validateImageExtension,
  validateBackgroundImage,
  validateLogoImage,
  validateFileSize,
  sanitizeFilename,
  validateFolder,
  validateFilePath,
  FileValidationError,
} from './file-validator.js';
import { ErrorCode } from '@card-news/shared';

describe('file-validator', () => {
  describe('validateFilename', () => {
    it('정상적인 파일명을 허용해야 함', () => {
      expect(() => validateFilename('test.jpg')).not.toThrow();
      expect(() => validateFilename('한글파일명.png')).not.toThrow();
      expect(() => validateFilename('file-name_123.jpeg')).not.toThrow();
    });

    it('빈 파일명을 거부해야 함', () => {
      expect(() => validateFilename('')).toThrow(FileValidationError);
      expect(() => validateFilename('   ')).toThrow(FileValidationError);
    });

    it('너무 긴 파일명을 거부해야 함', () => {
      const longName = 'a'.repeat(256) + '.jpg';
      expect(() => validateFilename(longName)).toThrow(FileValidationError);
    });

    it('상위 디렉토리 접근을 거부해야 함', () => {
      expect(() => validateFilename('../test.jpg')).toThrow(FileValidationError);
      expect(() => validateFilename('../../etc/passwd')).toThrow(FileValidationError);
    });

    it('절대 경로를 거부해야 함', () => {
      expect(() => validateFilename('/etc/passwd')).toThrow(FileValidationError);
      expect(() => validateFilename('C:\\Windows\\System32')).toThrow(FileValidationError);
    });

    it('Null 바이트를 거부해야 함', () => {
      expect(() => validateFilename('test\0.jpg')).toThrow(FileValidationError);
    });

    it('Windows 예약 문자를 거부해야 함', () => {
      expect(() => validateFilename('test<file>.jpg')).toThrow(FileValidationError);
      expect(() => validateFilename('test|file.jpg')).toThrow(FileValidationError);
      expect(() => validateFilename('test:file.jpg')).toThrow(FileValidationError);
    });

    it('Windows 예약 파일명을 거부해야 함', () => {
      expect(() => validateFilename('CON.jpg')).toThrow(FileValidationError);
      expect(() => validateFilename('PRN.png')).toThrow(FileValidationError);
      expect(() => validateFilename('AUX.txt')).toThrow(FileValidationError);
    });

    it('숨김 파일을 거부해야 함', () => {
      expect(() => validateFilename('.hidden')).toThrow(FileValidationError);
      expect(() => validateFilename('.htaccess')).toThrow(FileValidationError);
    });
  });

  describe('validateImageExtension', () => {
    it('허용된 이미지 확장자를 허용해야 함', () => {
      expect(() => validateImageExtension('test.jpg')).not.toThrow();
      expect(() => validateImageExtension('test.jpeg')).not.toThrow();
      expect(() => validateImageExtension('test.png')).not.toThrow();
      expect(() => validateImageExtension('test.gif')).not.toThrow();
      expect(() => validateImageExtension('test.webp')).not.toThrow();
    });

    it('대소문자를 구분하지 않아야 함', () => {
      expect(() => validateImageExtension('test.JPG')).not.toThrow();
      expect(() => validateImageExtension('test.PNG')).not.toThrow();
    });

    it('확장자가 없는 파일을 거부해야 함', () => {
      expect(() => validateImageExtension('test')).toThrow(FileValidationError);
    });

    it('허용되지 않은 확장자를 거부해야 함', () => {
      expect(() => validateImageExtension('test.txt')).toThrow(FileValidationError);
      expect(() => validateImageExtension('test.pdf')).toThrow(FileValidationError);
      expect(() => validateImageExtension('test.exe')).toThrow(FileValidationError);
    });
  });

  describe('validateBackgroundImage', () => {
    it('JPG와 PNG를 허용해야 함', () => {
      expect(() => validateBackgroundImage('test.jpg')).not.toThrow();
      expect(() => validateBackgroundImage('test.jpeg')).not.toThrow();
      expect(() => validateBackgroundImage('test.png')).not.toThrow();
    });

    it('다른 형식을 거부해야 함', () => {
      expect(() => validateBackgroundImage('test.gif')).toThrow(FileValidationError);
      expect(() => validateBackgroundImage('test.webp')).toThrow(FileValidationError);
    });
  });

  describe('validateLogoImage', () => {
    it('PNG만 허용해야 함', () => {
      expect(() => validateLogoImage('test.png')).not.toThrow();
    });

    it('다른 형식을 거부해야 함', () => {
      expect(() => validateLogoImage('test.jpg')).toThrow(FileValidationError);
      expect(() => validateLogoImage('test.jpeg')).toThrow(FileValidationError);
      expect(() => validateLogoImage('test.gif')).toThrow(FileValidationError);
    });
  });

  describe('validateFileSize', () => {
    it('허용된 크기를 허용해야 함', () => {
      expect(() => validateFileSize(1024, 2048)).not.toThrow();
      expect(() => validateFileSize(2048, 2048)).not.toThrow();
    });

    it('초과된 크기를 거부해야 함', () => {
      expect(() => validateFileSize(3000, 2048)).toThrow(FileValidationError);
    });
  });

  describe('sanitizeFilename', () => {
    it('공백을 언더스코어로 변환해야 함', () => {
      expect(sanitizeFilename('test file.jpg')).toBe('test_file.jpg');
      expect(sanitizeFilename('multiple   spaces.png')).toBe('multiple_spaces.png');
    });

    it('특수문자를 제거해야 함', () => {
      expect(sanitizeFilename('test@file#.jpg')).toBe('testfile.jpg');
      expect(sanitizeFilename('file!@#$%^&*().png')).toBe('file.png');
    });

    it('한글을 유지해야 함', () => {
      expect(sanitizeFilename('한글 파일명.jpg')).toBe('한글_파일명.jpg');
      expect(sanitizeFilename('테스트@파일#.png')).toBe('테스트파일.png');
    });

    it('연속된 언더스코어를 하나로 축약해야 함', () => {
      expect(sanitizeFilename('test___file.jpg')).toBe('test_file.jpg');
    });

    it('앞뒤 언더스코어를 제거해야 함', () => {
      expect(sanitizeFilename('_test_file_.jpg')).toBe('test_file.jpg');
    });

    it('확장자를 소문자로 변환해야 함', () => {
      expect(sanitizeFilename('test.JPG')).toBe('test.jpg');
      expect(sanitizeFilename('test.PNG')).toBe('test.png');
    });

    it('빈 파일명에 기본값을 사용해야 함', () => {
      expect(sanitizeFilename('   .jpg')).toBe('unnamed.jpg');
      expect(sanitizeFilename('@#$.png')).toBe('unnamed.png');
    });
  });

  describe('validateFolder', () => {
    it('허용된 폴더를 허용해야 함', () => {
      expect(() => validateFolder('배경이미지')).not.toThrow();
      expect(() => validateFolder('로고')).not.toThrow();
      expect(() => validateFolder('결과물')).not.toThrow();
    });

    it('허용되지 않은 폴더를 거부해야 함', () => {
      expect(() => validateFolder('invalid')).toThrow(FileValidationError);
      expect(() => validateFolder('../etc')).toThrow(FileValidationError);
    });
  });

  describe('validateFilePath', () => {
    it('기본 경로 내의 파일을 허용해야 함', () => {
      expect(() => validateFilePath('/base', 'file.jpg')).not.toThrow();
      expect(() => validateFilePath('/base', 'folder/file.jpg')).not.toThrow();
    });

    it('기본 경로 밖의 파일을 거부해야 함', () => {
      expect(() => validateFilePath('/base', '../outside.jpg')).toThrow(FileValidationError);
      expect(() => validateFilePath('/base', '../../etc/passwd')).toThrow(FileValidationError);
    });
  });

  describe('FileValidationError', () => {
    it('에러 코드와 메시지를 포함해야 함', () => {
      const error = new FileValidationError(
        'Test error',
        ErrorCode.INVALID_FILENAME,
        { detail: 'test' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.INVALID_FILENAME);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('FileValidationError');
    });
  });
});
