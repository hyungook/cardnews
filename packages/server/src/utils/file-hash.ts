import crypto from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { env } from '../config/env.js';
import { log } from './logger.js';

/**
 * 파일 해시 유틸리티
 * 파일의 SHA-256 해시를 계산하여 중복 파일을 감지한다.
 */

/**
 * Buffer 데이터의 SHA-256 해시를 계산한다.
 * @param data 해시를 계산할 데이터
 * @returns SHA-256 해시 (hex 문자열)
 */
export function calculateFileHash(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 파일 경로에서 파일을 읽어 해시를 계산한다.
 * @param folderName 폴더명 ('배경이미지' | '로고')
 * @param filename 파일명
 * @returns SHA-256 해시 (hex 문자열)
 */
export async function calculateFileHashFromPath(
  folderName: string,
  filename: string
): Promise<string> {
  const BASE_DIR = join(process.cwd(), env.BASE_DIR);
  const filePath = join(BASE_DIR, folderName, filename);
  const data = await readFile(filePath);
  return calculateFileHash(data);
}

/**
 * 파일 해시 정보
 */
export interface FileHashInfo {
  filename: string;
  folder: string;
  hash: string;
}

/**
 * 특정 폴더의 모든 파일 해시를 계산한다.
 * @param folderName 폴더명 ('배경이미지' | '로고')
 * @returns 파일 해시 정보 배열
 */
export async function calculateFolderHashes(folderName: string): Promise<FileHashInfo[]> {
  const { listFiles } = await import('../local/local-storage.js');
  const files = await listFiles(folderName);
  
  const hashInfos: FileHashInfo[] = [];
  
  for (const file of files) {
    try {
      const hash = await calculateFileHashFromPath(folderName, file.name);
      hashInfos.push({
        filename: file.name,
        folder: folderName,
        hash,
      });
    } catch (error) {
      log.warn('파일 해시 계산 실패', { folder: folderName, filename: file.name, error });
    }
  }
  
  return hashInfos;
}

/**
 * 업로드하려는 파일이 이미 존재하는지 확인한다.
 * @param data 업로드할 파일 데이터
 * @param folderName 대상 폴더명 ('배경이미지' | '로고')
 * @returns 중복 파일 정보 (없으면 null)
 */
export async function isDuplicateFile(
  data: Buffer,
  folderName: string
): Promise<FileHashInfo | null> {
  const uploadHash = calculateFileHash(data);
  log.debug('업로드 파일 해시 계산', { hash: uploadHash, folder: folderName });
  
  const existingHashes = await calculateFolderHashes(folderName);
  
  const duplicate = existingHashes.find((info) => info.hash === uploadHash);
  
  if (duplicate) {
    log.info('중복 파일 발견', { 
      uploadHash, 
      existingFile: duplicate.filename,
      folder: folderName 
    });
    return duplicate;
  }
  
  return null;
}

/**
 * 여러 폴더에서 중복 파일을 확인한다.
 * @param data 업로드할 파일 데이터
 * @param folders 확인할 폴더 목록
 * @returns 중복 파일 정보 배열
 */
export async function findDuplicatesInFolders(
  data: Buffer,
  folders: string[]
): Promise<FileHashInfo[]> {
  const uploadHash = calculateFileHash(data);
  const duplicates: FileHashInfo[] = [];
  
  for (const folder of folders) {
    const existingHashes = await calculateFolderHashes(folder);
    const folderDuplicates = existingHashes.filter((info) => info.hash === uploadHash);
    duplicates.push(...folderDuplicates);
  }
  
  return duplicates;
}
