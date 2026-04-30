import { existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { env } from '../config/env.js';
import { log } from './logger.js';

/**
 * 파일명 충돌 처리 유틸리티
 * 
 * 같은 이름의 파일이 이미 존재할 경우 자동으로 번호를 붙여 새로운 파일명을 생성한다.
 * 예: test.jpg -> test_1.jpg -> test_2.jpg
 */

/**
 * 파일명 충돌 해결 결과
 */
export interface FilenameConflictResult {
  /** 원본 파일명 */
  originalFilename: string;
  /** 해결된 파일명 */
  resolvedFilename: string;
  /** 충돌이 발생했는지 여부 */
  hasConflict: boolean;
  /** 시도한 번호 (충돌이 없으면 0) */
  attemptNumber: number;
}

/**
 * 파일명 충돌을 해결한다.
 * 
 * 같은 이름의 파일이 이미 존재하면 "_1", "_2" 등의 번호를 붙여 새로운 파일명을 생성한다.
 * 
 * @param folderName 폴더명 ('배경이미지' | '로고' | '결과물')
 * @param filename 원본 파일명
 * @param maxAttempts 최대 시도 횟수 (기본값: 1000)
 * @returns 충돌 해결 결과
 */
export function resolveFilenameConflict(
  folderName: string,
  filename: string,
  maxAttempts = 1000
): FilenameConflictResult {
  const BASE_DIR = join(process.cwd(), env.BASE_DIR);
  const folderPath = join(BASE_DIR, folderName);
  const filePath = join(folderPath, filename);
  
  // 충돌이 없으면 원본 파일명 반환
  if (!existsSync(filePath)) {
    log.debug('파일명 충돌 없음', { folder: folderName, filename });
    return {
      originalFilename: filename,
      resolvedFilename: filename,
      hasConflict: false,
      attemptNumber: 0,
    };
  }
  
  // 충돌 발생 - 번호를 붙여 새로운 파일명 생성
  const ext = extname(filename);
  const nameWithoutExt = basename(filename, ext);
  
  for (let i = 1; i <= maxAttempts; i++) {
    const newFilename = `${nameWithoutExt}_${i}${ext}`;
    const newFilePath = join(folderPath, newFilename);
    
    if (!existsSync(newFilePath)) {
      log.info('파일명 충돌 해결', { 
        folder: folderName,
        originalFilename: filename,
        resolvedFilename: newFilename,
        attemptNumber: i 
      });
      
      return {
        originalFilename: filename,
        resolvedFilename: newFilename,
        hasConflict: true,
        attemptNumber: i,
      };
    }
  }
  
  // 최대 시도 횟수 초과
  log.error('파일명 충돌 해결 실패', { 
    folder: folderName,
    filename,
    maxAttempts 
  });
  
  throw new Error(`파일명 충돌을 해결할 수 없습니다. 최대 시도 횟수(${maxAttempts})를 초과했습니다.`);
}

/**
 * 파일명이 이미 존재하는지 확인한다.
 * 
 * @param folderName 폴더명
 * @param filename 파일명
 * @returns 파일이 존재하면 true
 */
export function fileExists(folderName: string, filename: string): boolean {
  const BASE_DIR = join(process.cwd(), env.BASE_DIR);
  const filePath = join(BASE_DIR, folderName, filename);
  return existsSync(filePath);
}

/**
 * 여러 파일명의 충돌을 일괄 해결한다.
 * 
 * @param folderName 폴더명
 * @param filenames 파일명 배열
 * @returns 충돌 해결 결과 배열
 */
export function resolveMultipleConflicts(
  folderName: string,
  filenames: string[]
): FilenameConflictResult[] {
  const results: FilenameConflictResult[] = [];
  const usedFilenames = new Set<string>();
  
  for (const filename of filenames) {
    let result = resolveFilenameConflict(folderName, filename);
    
    // 이미 사용된 파일명이면 다시 해결
    while (usedFilenames.has(result.resolvedFilename)) {
      const ext = extname(filename);
      const nameWithoutExt = basename(filename, ext);
      const nextNumber = result.attemptNumber + 1;
      const newFilename = `${nameWithoutExt}_${nextNumber}${ext}`;
      
      result = {
        originalFilename: filename,
        resolvedFilename: newFilename,
        hasConflict: true,
        attemptNumber: nextNumber,
      };
    }
    
    usedFilenames.add(result.resolvedFilename);
    results.push(result);
  }
  
  return results;
}

/**
 * 타임스탬프를 포함한 고유 파일명을 생성한다.
 * 
 * @param filename 원본 파일명
 * @returns 타임스탬프가 포함된 파일명
 */
export function generateUniqueFilename(filename: string): string {
  const ext = extname(filename);
  const nameWithoutExt = basename(filename, ext);
  const timestamp = Date.now();
  
  return `${nameWithoutExt}_${timestamp}${ext}`;
}
