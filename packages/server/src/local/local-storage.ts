import { readFile, writeFile, mkdir, readdir, unlink, stat, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * 로컬 파일 저장소
 * 구글 드라이브 대신 서버 로컬 폴더에 이미지를 저장/조회한다.
 *
 * 폴더 구조 (서버 실행 디렉토리 기준):
 *   images/
 *     배경이미지/
 *     로고/
 *     결과물/
 *       YYYY-MM-DD/
 */

const BASE_DIR = join(process.cwd(), env.BASE_DIR);

/**
 * 파일명을 정규화한다.
 * - 공백을 언더스코어로 변환
 * - 파일 시스템에 안전하지 않은 특수문자 제거
 * - 한글 문자는 유지
 * - 파일 확장자는 보존
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */
export function normalizeFilename(filename: string): string {
  const ext = extname(filename);
  const nameWithoutExt = ext.length > 0 ? filename.slice(0, -ext.length) : filename;
  
  // 공백을 언더스코어로 변환
  let normalized = nameWithoutExt.replace(/\s+/g, '_');
  
  // 파일 시스템에 안전하지 않은 특수문자 제거
  // 허용: 알파벳, 숫자, 한글(가-힣, ㄱ-ㅎ, ㅏ-ㅣ), 언더스코어, 하이픈, 점
  // u 플래그 추가로 유니코드 제대로 처리
  normalized = normalized.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]/gu, '');
  
  // 연속된 언더스코어를 하나로
  normalized = normalized.replace(/_+/g, '_');
  
  // 앞뒤 언더스코어 제거
  normalized = normalized.replace(/^_+|_+$/g, '');
  
  return normalized + ext;
}

export interface LocalFile {
  id: string;   // 파일명을 ID로 사용
  name: string;
  folder: string;
  size: number;
}

/** 필요한 폴더를 모두 생성한다. */
export async function ensureFolders(): Promise<void> {
  for (const folder of ['배경이미지', '로고', '결과물']) {
    await mkdir(join(BASE_DIR, folder), { recursive: true });
  }
}

/**
 * 30일 이상 된 결과물 파일을 삭제한다.
 * 날짜 폴더(YYYY-MM-DD)를 순회하며 오래된 폴더를 삭제한다.
 * 
 * Requirements: 6.6
 * @param daysToKeep 보관할 일수 (기본값: 30일)
 * @param baseDir 베이스 디렉토리 (테스트용, 기본값: BASE_DIR)
 * @returns 삭제된 파일 수
 */
export async function cleanupOldResults(daysToKeep: number = 30, baseDir: string = BASE_DIR): Promise<number> {
  const resultDir = join(baseDir, '결과물');
  
  // 결과물 폴더가 없으면 0 반환
  if (!existsSync(resultDir)) {
    return 0;
  }
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - daysToKeep * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;
  
  try {
    const dateFolders = await readdir(resultDir);
    
    for (const dateFolder of dateFolders) {
      const datePath = join(resultDir, dateFolder);
      
      try {
        const info = await stat(datePath);
        
        // 디렉토리가 아니면 건너뛰기
        if (!info.isDirectory()) {
          continue;
        }
        
        // YYYY-MM-DD 형식인지 확인
        const dateMatch = dateFolder.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
          continue;
        }
        
        // 날짜 파싱
        const folderDate = new Date(dateFolder);
        
        // cutoffDate보다 오래된 폴더 삭제
        if (folderDate < cutoffDate) {
          // 폴더 내 파일 수 세기
          const files = await readdir(datePath);
          const fileCount = files.length;
          
          // 폴더 내 모든 파일 삭제
          for (const file of files) {
            await unlink(join(datePath, file));
          }
          
          // 빈 폴더 삭제
          await rmdir(datePath);
          
          deletedCount += fileCount;
          log.info('오래된 폴더 삭제', { dateFolder, fileCount });
        }
      } catch (err) {
        log.error('폴더 처리 실패', err, { dateFolder });
      }
    }
  } catch (err) {
    log.error('결과물 정리 실패', err);
  }
  
  return deletedCount;
}

/** 
 * 지정된 서브폴더에 파일을 저장한다 (파일명 자동 정규화).
 * 동일한 파일명이 이미 존재하면 덮어쓴다.
 * 
 * Requirements: 2.2, 2.3, 2.5, 3.2, 3.3, 3.5
 */
export async function saveFile(folderName: string, filename: string, data: Buffer): Promise<string> {
  await mkdir(join(BASE_DIR, folderName), { recursive: true });
  
  // 파일명 정규화
  const normalizedFilename = normalizeFilename(filename);
  
  const filePath = join(BASE_DIR, folderName, normalizedFilename);
  
  // 파일이 이미 존재하는지 확인
  const fileExists = existsSync(filePath);
  
  // 파일 저장 (덮어쓰기)
  await writeFile(filePath, data);
  
  if (fileExists) {
    log.info('기존 파일 덮어쓰기', {
      folder: folderName,
      originalFilename: filename,
      normalizedFilename,
    });
  } else {
    log.info('새 파일 저장', {
      folder: folderName,
      originalFilename: filename,
      normalizedFilename,
    });
  }
  
  return normalizedFilename; // 정규화된 파일명 반환
}

/** 지정된 서브폴더에서 파일을 읽는다. */
export async function readLocalFile(folderName: string, filename: string): Promise<Buffer> {
  const filePath = join(BASE_DIR, folderName, filename);
  if (!existsSync(filePath)) {
    throw new Error(`파일 '${filename}'을(를) '${folderName}' 폴더에서 찾을 수 없습니다.`);
  }
  return readFile(filePath);
}

/** 결과물 폴더 내 날짜별 서브폴더에 파일을 저장한다. */
export async function saveResult(filename: string, data: Buffer, dateStr: string): Promise<string> {
  const dateFolder = join(BASE_DIR, '결과물', dateStr);
  await mkdir(dateFolder, { recursive: true });
  await writeFile(join(dateFolder, filename), data);
  return filename;
}

/** 지정된 서브폴더의 파일 목록을 반환한다. */
export async function listFiles(folderName: string): Promise<LocalFile[]> {
  const folderPath = join(BASE_DIR, folderName);
  await mkdir(folderPath, { recursive: true });

  const entries = await readdir(folderPath).catch(() => [] as string[]);
  const files: LocalFile[] = [];

  for (const name of entries) {
    const filePath = join(folderPath, name);
    try {
      const info = await stat(filePath);
      if (info.isFile()) {
        files.push({ id: name, name, folder: folderName, size: info.size });
      }
    } catch {
      // 파일 정보 조회 실패 시 건너뜀
    }
  }

  return files;
}

/** 결과물 폴더의 파일명 목록을 반환한다 (중복 방지용). */
export async function listResultFilenames(): Promise<string[]> {
  const resultDir = join(BASE_DIR, '결과물');
  await mkdir(resultDir, { recursive: true });

  const names: string[] = [];
  const dateFolders = await readdir(resultDir).catch(() => [] as string[]);

  for (const dateFolder of dateFolders) {
    const datePath = join(resultDir, dateFolder);
    try {
      const info = await stat(datePath);
      if (info.isDirectory()) {
        const files = await readdir(datePath).catch(() => [] as string[]);
        names.push(...files);
      }
    } catch {
      // 건너뜀
    }
  }

  return names;
}

/** 파일을 삭제한다. */
export async function deleteLocalFile(folderName: string, filename: string): Promise<void> {
  const filePath = join(BASE_DIR, folderName, filename);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/** 배경이미지 폴더에서 파일을 읽는다. */
export async function readBackground(filename: string): Promise<Buffer> {
  return readLocalFile('배경이미지', filename);
}

/** 로고 폴더에서 파일을 읽는다. */
export async function readLogo(filename: string): Promise<Buffer> {
  return readLocalFile('로고', filename);
}
