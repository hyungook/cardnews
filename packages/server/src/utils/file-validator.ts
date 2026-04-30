import path from 'path';
import { ErrorCode } from '@card-news/shared';

/**
 * 파일명 검증 에러
 */
export class FileValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * 위험한 패턴 목록
 */
const DANGEROUS_PATTERNS = [
  /\.\./,           // 상위 디렉토리 접근
  /^\/+/,           // 절대 경로
  /^[A-Za-z]:\\/,   // Windows 절대 경로
  /\0/,             // Null 바이트
  /[<>:"|?*]/,      // Windows 예약 문자
];

/**
 * 예약된 파일명 (Windows)
 */
const RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

/**
 * 허용된 이미지 확장자
 */
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * 파일명이 안전한지 검증
 * @param filename 검증할 파일명
 * @throws FileValidationError 검증 실패 시
 */
export function validateFilename(filename: string): void {
  // 빈 파일명
  if (!filename || filename.trim().length === 0) {
    throw new FileValidationError(
      '파일명이 비어있습니다',
      ErrorCode.INVALID_FILENAME
    );
  }

  // 파일명 길이 제한 (255자)
  if (filename.length > 255) {
    throw new FileValidationError(
      '파일명이 너무 깁니다 (최대 255자)',
      ErrorCode.INVALID_FILENAME,
      { maxLength: 255, actualLength: filename.length }
    );
  }

  // 위험한 패턴 검사
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filename)) {
      throw new FileValidationError(
        '파일명에 허용되지 않는 문자가 포함되어 있습니다',
        ErrorCode.INVALID_FILENAME,
        { pattern: pattern.toString() }
      );
    }
  }

  // 예약된 파일명 검사 (Windows)
  const basename = path.basename(filename, path.extname(filename)).toUpperCase();
  if (RESERVED_NAMES.includes(basename)) {
    throw new FileValidationError(
      '예약된 파일명입니다',
      ErrorCode.INVALID_FILENAME,
      { reservedName: basename }
    );
  }

  // 파일명이 점으로 시작하는지 검사 (숨김 파일)
  if (filename.startsWith('.')) {
    throw new FileValidationError(
      '숨김 파일은 업로드할 수 없습니다',
      ErrorCode.INVALID_FILENAME
    );
  }

  // 파일명이 공백으로만 구성되어 있는지 검사
  if (filename.trim().length === 0) {
    throw new FileValidationError(
      '파일명이 공백으로만 구성되어 있습니다',
      ErrorCode.INVALID_FILENAME
    );
  }
}

/**
 * 이미지 파일 확장자 검증
 * @param filename 검증할 파일명
 * @throws FileValidationError 검증 실패 시
 */
export function validateImageExtension(filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  
  if (!ext) {
    throw new FileValidationError(
      '파일 확장자가 없습니다',
      ErrorCode.INVALID_FILE_TYPE
    );
  }

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new FileValidationError(
      '지원하지 않는 이미지 형식입니다',
      ErrorCode.INVALID_FILE_TYPE,
      { 
        extension: ext,
        allowedExtensions: ALLOWED_IMAGE_EXTENSIONS 
      }
    );
  }
}

/**
 * 배경이미지 파일 형식 검증 (JPG, PNG만 허용)
 * @param filename 검증할 파일명
 * @throws FileValidationError 검증 실패 시
 */
export function validateBackgroundImage(filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
    throw new FileValidationError(
      '배경이미지는 JPG 또는 PNG 형식만 지원합니다',
      ErrorCode.INVALID_FILE_TYPE,
      { extension: ext, allowedExtensions: ['.jpg', '.jpeg', '.png'] }
    );
  }
}

/**
 * 로고 파일 형식 검증 (PNG만 허용)
 * @param filename 검증할 파일명
 * @throws FileValidationError 검증 실패 시
 */
export function validateLogoImage(filename: string): void {
  const ext = path.extname(filename).toLowerCase();
  
  if (ext !== '.png') {
    throw new FileValidationError(
      '로고는 PNG 형식만 지원합니다',
      ErrorCode.INVALID_FILE_TYPE,
      { extension: ext, allowedExtensions: ['.png'] }
    );
  }
}

/**
 * 파일 크기 검증
 * @param size 파일 크기 (바이트)
 * @param maxSize 최대 크기 (바이트)
 * @throws FileValidationError 검증 실패 시
 */
export function validateFileSize(size: number, maxSize: number): void {
  if (size > maxSize) {
    throw new FileValidationError(
      '파일 크기가 너무 큽니다',
      ErrorCode.FILE_TOO_LARGE,
      { 
        size: `${(size / 1024 / 1024).toFixed(2)}MB`,
        maxSize: `${(maxSize / 1024 / 1024).toFixed(2)}MB`
      }
    );
  }
}

/**
 * 파일명 정규화 (안전한 파일명으로 변환)
 * - 공백을 언더스코어로 변환
 * - 특수문자 제거 (한글, 영문, 숫자, 언더스코어, 하이픈, 점만 허용)
 * - 연속된 언더스코어를 하나로 축약
 * - 앞뒤 공백 및 언더스코어 제거
 * 
 * @param filename 원본 파일명
 * @returns 정규화된 파일명
 */
export function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);

  // 1. 공백을 언더스코어로 변환
  let sanitized = basename.replace(/\s+/g, '_');

  // 2. 특수문자 제거 (한글, 영문, 숫자, 언더스코어, 하이픈만 허용)
  sanitized = sanitized.replace(/[^\w가-힣-]/g, '');

  // 3. 연속된 언더스코어를 하나로 축약
  sanitized = sanitized.replace(/_+/g, '_');

  // 4. 앞뒤 언더스코어 제거
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  // 5. 빈 문자열이면 기본값 사용
  if (sanitized.length === 0) {
    sanitized = 'unnamed';
  }

  return sanitized + ext.toLowerCase();
}

/**
 * 폴더명 검증
 * @param folder 폴더명
 * @throws FileValidationError 검증 실패 시
 */
export function validateFolder(folder: string): void {
  const allowedFolders = ['배경이미지', '로고', '결과물'];
  
  if (!allowedFolders.includes(folder)) {
    throw new FileValidationError(
      '유효하지 않은 폴더입니다',
      ErrorCode.INVALID_FOLDER,
      { folder, allowedFolders }
    );
  }
}

/**
 * 파일 경로 검증 (디렉토리 트래버설 방지)
 * @param basePath 기본 경로
 * @param filePath 검증할 파일 경로
 * @throws FileValidationError 검증 실패 시
 */
export function validateFilePath(basePath: string, filePath: string): void {
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, filePath);

  // 파일 경로가 기본 경로 내에 있는지 확인
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new FileValidationError(
      '허용되지 않은 경로입니다',
      ErrorCode.INVALID_FILENAME,
      { basePath: resolvedBase, filePath: resolvedPath }
    );
  }
}
