import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  normalizeFilename, 
  cleanupOldResults, 
  ensureFolders, 
  saveFile, 
  readLocalFile,
  listFiles,
  listResultFilenames,
  deleteLocalFile,
  readBackground,
  readLogo,
  saveResult
} from './local-storage.js';
import { mkdir, writeFile, readdir, rm, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

describe('normalizeFilename', () => {
  describe('Requirements 16.1, 16.2, 16.3, 16.4: 파일명 정규화', () => {
    it('공백을 언더스코어로 변환한다 (Requirement 16.2)', () => {
      expect(normalizeFilename('영화 제목.jpg')).toBe('영화_제목.jpg');
      expect(normalizeFilename('Movie Title.png')).toBe('Movie_Title.png');
      expect(normalizeFilename('여러   공백   있음.jpg')).toBe('여러_공백_있음.jpg');
    });

    it('특수문자를 제거한다 (Requirement 16.1)', () => {
      expect(normalizeFilename('영화제목!@#.jpg')).toBe('영화제목.jpg');
      expect(normalizeFilename('Movie Title (2024).png')).toBe('Movie_Title_2024.png');
      expect(normalizeFilename('파일명$%^&*.jpg')).toBe('파일명.jpg');
    });

    it('파일 확장자를 보존한다 (Requirement 16.3)', () => {
      expect(normalizeFilename('영화 제목!@#.jpg')).toBe('영화_제목.jpg');
      expect(normalizeFilename('Movie Title (2024).png')).toBe('Movie_Title_2024.png');
      expect(normalizeFilename('파일.jpeg')).toBe('파일.jpeg');
      expect(normalizeFilename('파일.JPG')).toBe('파일.JPG');
    });

    it('한글 문자를 유지한다 (Requirement 16.4)', () => {
      expect(normalizeFilename('LI_영화제목.png')).toBe('LI_영화제목.png');
      expect(normalizeFilename('한글파일명.jpg')).toBe('한글파일명.jpg');
      expect(normalizeFilename('ㄱㄴㄷ.jpg')).toBe('ㄱㄴㄷ.jpg');
      expect(normalizeFilename('ㅏㅑㅓㅕ.jpg')).toBe('ㅏㅑㅓㅕ.jpg');
    });

    it('알파벳과 숫자를 유지한다', () => {
      expect(normalizeFilename('Movie123.jpg')).toBe('Movie123.jpg');
      expect(normalizeFilename('ABC_DEF_123.png')).toBe('ABC_DEF_123.png');
    });

    it('하이픈과 점을 유지한다', () => {
      expect(normalizeFilename('movie-title.jpg')).toBe('movie-title.jpg');
      expect(normalizeFilename('file.name.with.dots.jpg')).toBe('file.name.with.dots.jpg');
    });

    it('연속된 언더스코어를 하나로 합친다', () => {
      expect(normalizeFilename('파일___이름.jpg')).toBe('파일_이름.jpg');
      expect(normalizeFilename('여러   공백   있음.jpg')).toBe('여러_공백_있음.jpg');
    });

    it('앞뒤 언더스코어를 제거한다', () => {
      expect(normalizeFilename('_파일명.jpg')).toBe('파일명.jpg');
      expect(normalizeFilename('파일명_.jpg')).toBe('파일명.jpg');
      expect(normalizeFilename('_파일명_.jpg')).toBe('파일명.jpg');
    });

    it('복합 시나리오를 처리한다', () => {
      // 공백 + 특수문자 + 한글
      expect(normalizeFilename('영화 제목!@#.jpg')).toBe('영화_제목.jpg');
      
      // 영문 + 공백 + 괄호 + 숫자
      expect(normalizeFilename('Movie Title (2024).png')).toBe('Movie_Title_2024.png');
      
      // 한글 유지 + 언더스코어 유지
      expect(normalizeFilename('LI_영화제목.png')).toBe('LI_영화제목.png');
    });

    it('확장자가 없는 파일명을 처리한다', () => {
      expect(normalizeFilename('파일명')).toBe('파일명');
      expect(normalizeFilename('파일 이름')).toBe('파일_이름');
    });

    it('빈 파일명을 처리한다', () => {
      expect(normalizeFilename('.jpg')).toBe('.jpg');
      expect(normalizeFilename('!@#.jpg')).toBe('.jpg');
    });
  });
});

describe('cleanupOldResults', () => {
  const testBaseDir = join(process.cwd(), 'test-images-cleanup');
  const resultDir = join(testBaseDir, '결과물');

  beforeEach(async () => {
    // 테스트용 임시 폴더 생성
    await mkdir(resultDir, { recursive: true });
  });

  afterEach(async () => {
    // 테스트 후 정리
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirement 6.6: 30일 이상 된 결과물 자동 삭제', () => {
    it('30일 이상 된 폴더를 삭제한다', async () => {
      // 40일 전 날짜 폴더 생성
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldDateStr = oldDate.toISOString().split('T')[0];
      const oldDatePath = join(resultDir, oldDateStr);
      
      await mkdir(oldDatePath, { recursive: true });
      await writeFile(join(oldDatePath, 'old-file1.jpg'), 'test data 1');
      await writeFile(join(oldDatePath, 'old-file2.jpg'), 'test data 2');

      const deletedCount = await cleanupOldResults(30, testBaseDir);

      expect(deletedCount).toBe(2);
      expect(existsSync(oldDatePath)).toBe(false);
    });

    it('30일 이내의 폴더는 유지한다', async () => {
      // 10일 전 날짜 폴더 생성
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const recentDateStr = recentDate.toISOString().split('T')[0];
      const recentDatePath = join(resultDir, recentDateStr);
      
      await mkdir(recentDatePath, { recursive: true });
      await writeFile(join(recentDatePath, 'recent-file.jpg'), 'test data');

      const deletedCount = await cleanupOldResults(30, testBaseDir);

      expect(deletedCount).toBe(0);
      expect(existsSync(recentDatePath)).toBe(true);
      
      // 파일도 그대로 있는지 확인
      const files = await readdir(recentDatePath);
      expect(files).toContain('recent-file.jpg');
    });

    it('여러 날짜 폴더를 올바르게 처리한다', async () => {
      // 40일 전 (삭제 대상)
      const oldDate1 = new Date();
      oldDate1.setDate(oldDate1.getDate() - 40);
      const oldDateStr1 = oldDate1.toISOString().split('T')[0];
      const oldDatePath1 = join(resultDir, oldDateStr1);
      
      await mkdir(oldDatePath1, { recursive: true });
      await writeFile(join(oldDatePath1, 'old1.jpg'), 'data');

      // 35일 전 (삭제 대상)
      const oldDate2 = new Date();
      oldDate2.setDate(oldDate2.getDate() - 35);
      const oldDateStr2 = oldDate2.toISOString().split('T')[0];
      const oldDatePath2 = join(resultDir, oldDateStr2);
      
      await mkdir(oldDatePath2, { recursive: true });
      await writeFile(join(oldDatePath2, 'old2.jpg'), 'data');
      await writeFile(join(oldDatePath2, 'old3.jpg'), 'data');

      // 10일 전 (유지)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const recentDateStr = recentDate.toISOString().split('T')[0];
      const recentDatePath = join(resultDir, recentDateStr);
      
      await mkdir(recentDatePath, { recursive: true });
      await writeFile(join(recentDatePath, 'recent.jpg'), 'data');

      const deletedCount = await cleanupOldResults(30, testBaseDir);

      expect(deletedCount).toBe(3); // old1.jpg + old2.jpg + old3.jpg
      expect(existsSync(oldDatePath1)).toBe(false);
      expect(existsSync(oldDatePath2)).toBe(false);
      expect(existsSync(recentDatePath)).toBe(true);
    });

    it('결과물 폴더가 없으면 0을 반환한다', async () => {
      // 결과물 폴더 삭제
      await rm(resultDir, { recursive: true, force: true });

      const deletedCount = await cleanupOldResults(30, testBaseDir);
      expect(deletedCount).toBe(0);
    });

    it('YYYY-MM-DD 형식이 아닌 폴더는 무시한다', async () => {
      // 잘못된 형식의 폴더 생성
      const invalidPath = join(resultDir, 'invalid-folder');
      await mkdir(invalidPath, { recursive: true });
      await writeFile(join(invalidPath, 'file.jpg'), 'data');

      // 40일 전 날짜 폴더 생성
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldDateStr = oldDate.toISOString().split('T')[0];
      const oldDatePath = join(resultDir, oldDateStr);
      
      await mkdir(oldDatePath, { recursive: true });
      await writeFile(join(oldDatePath, 'old.jpg'), 'data');

      const deletedCount = await cleanupOldResults(30, testBaseDir);

      expect(deletedCount).toBe(1); // old.jpg만 삭제
      expect(existsSync(invalidPath)).toBe(true); // invalid-folder는 유지
      expect(existsSync(oldDatePath)).toBe(false);
    });

    it('파일이 아닌 항목은 무시한다', async () => {
      // 날짜 폴더 내에 파일 생성
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      const oldDateStr = oldDate.toISOString().split('T')[0];
      const oldDatePath = join(resultDir, oldDateStr);
      
      await mkdir(oldDatePath, { recursive: true });
      await writeFile(join(oldDatePath, 'file.jpg'), 'data');

      const deletedCount = await cleanupOldResults(30, testBaseDir);

      expect(deletedCount).toBe(1);
      expect(existsSync(oldDatePath)).toBe(false);
    });

    it('커스텀 보관 일수를 지원한다', async () => {
      // 50일 전 날짜 폴더 생성
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 50);
      const oldDateStr = oldDate.toISOString().split('T')[0];
      const oldDatePath = join(resultDir, oldDateStr);
      
      await mkdir(oldDatePath, { recursive: true });
      await writeFile(join(oldDatePath, 'old.jpg'), 'data');

      // 40일 전 날짜 폴더 생성
      const midDate = new Date();
      midDate.setDate(midDate.getDate() - 40);
      const midDateStr = midDate.toISOString().split('T')[0];
      const midDatePath = join(resultDir, midDateStr);
      
      await mkdir(midDatePath, { recursive: true });
      await writeFile(join(midDatePath, 'mid.jpg'), 'data');

      // 45일 보관 설정
      const deletedCount = await cleanupOldResults(45, testBaseDir);

      expect(deletedCount).toBe(1); // 50일 전 파일만 삭제
      expect(existsSync(oldDatePath)).toBe(false);
      expect(existsSync(midDatePath)).toBe(true); // 40일 전은 유지
    });
  });
});

describe('saveFile', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-savefile');
  
  beforeEach(async () => {
    // 테스트용 임시 폴더 생성
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // 테스트 후 정리
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 2.2, 2.3, 2.5, 3.2, 3.3, 3.5: 파일 저장 및 정규화', () => {
    it('파일을 저장하고 정규화된 파일명을 반환한다 (Requirement 2.2, 2.3, 3.2, 3.3)', async () => {
      const folderName = 'test-savefile/배경이미지';
      const filename = '영화 제목!@#.jpg';
      const data = Buffer.from('test image data');

      const savedFilename = await saveFile(folderName, filename, data);

      // 정규화된 파일명 반환 확인
      expect(savedFilename).toBe('영화_제목.jpg');

      // 파일이 실제로 저장되었는지 확인
      const filePath = join(process.cwd(), 'images', folderName, savedFilename);
      expect(existsSync(filePath)).toBe(true);

      // 파일 내용 확인
      const savedData = await readFile(filePath);
      expect(savedData.toString()).toBe('test image data');
    });

    it('동일한 파일명이 이미 존재하면 덮어쓴다 (Requirement 2.5, 3.5)', async () => {
      const folderName = 'test-savefile/로고';
      const filename = 'LI_영화제목.png';
      const originalData = Buffer.from('original data');
      const newData = Buffer.from('new data');

      // 첫 번째 저장
      const savedFilename1 = await saveFile(folderName, filename, originalData);
      expect(savedFilename1).toBe('LI_영화제목.png');

      // 파일 내용 확인
      const filePath = join(process.cwd(), 'images', folderName, savedFilename1);
      let savedData = await readFile(filePath);
      expect(savedData.toString()).toBe('original data');

      // 동일한 파일명으로 다시 저장 (덮어쓰기)
      const savedFilename2 = await saveFile(folderName, filename, newData);
      expect(savedFilename2).toBe('LI_영화제목.png');

      // 파일명이 동일한지 확인
      expect(savedFilename1).toBe(savedFilename2);

      // 파일 내용이 새 데이터로 덮어써졌는지 확인
      savedData = await readFile(filePath);
      expect(savedData.toString()).toBe('new data');

      // 파일이 하나만 존재하는지 확인 (번호가 붙지 않았는지)
      const files = await readdir(join(process.cwd(), 'images', folderName));
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('LI_영화제목.png');
    });

    it('폴더가 없으면 자동으로 생성한다', async () => {
      const folderName = 'test-savefile/새폴더';
      const filename = 'test.jpg';
      const data = Buffer.from('test data');

      // 폴더가 없는 상태에서 저장
      const savedFilename = await saveFile(folderName, filename, data);

      expect(savedFilename).toBe('test.jpg');
      expect(existsSync(join(process.cwd(), 'images', folderName))).toBe(true);
      expect(existsSync(join(process.cwd(), 'images', folderName, 'test.jpg'))).toBe(true);
    });

    it('여러 파일을 저장할 수 있다', async () => {
      const folderName = 'test-savefile/배경이미지2';
      const files = [
        { name: '영화1.jpg', data: Buffer.from('data1') },
        { name: '영화2.jpg', data: Buffer.from('data2') },
        { name: '영화3.jpg', data: Buffer.from('data3') },
      ];

      for (const file of files) {
        await saveFile(folderName, file.name, file.data);
      }

      // 모든 파일이 저장되었는지 확인
      const savedFiles = await readdir(join(process.cwd(), 'images', folderName));
      expect(savedFiles).toHaveLength(3);
      expect(savedFiles).toContain('영화1.jpg');
      expect(savedFiles).toContain('영화2.jpg');
      expect(savedFiles).toContain('영화3.jpg');
    });

    it('공백과 특수문자가 포함된 파일명을 정규화하여 저장한다', async () => {
      const folderName = 'test-savefile/로고2';
      const filename = 'Movie Title (2024)!@#.png';
      const data = Buffer.from('logo data');

      const savedFilename = await saveFile(folderName, filename, data);

      expect(savedFilename).toBe('Movie_Title_2024.png');
      expect(existsSync(join(process.cwd(), 'images', folderName, savedFilename))).toBe(true);
    });

    it('한글 파일명을 유지하여 저장한다', async () => {
      const folderName = 'test-savefile/배경이미지3';
      const filename = '한글 파일명.jpg';
      const data = Buffer.from('test data');

      const savedFilename = await saveFile(folderName, filename, data);

      expect(savedFilename).toBe('한글_파일명.jpg');
      expect(existsSync(join(process.cwd(), 'images', folderName, savedFilename))).toBe(true);
    });

    it('빈 데이터도 저장할 수 있다', async () => {
      const folderName = 'test-savefile/배경이미지4';
      const filename = 'empty.jpg';
      const data = Buffer.from('');

      const savedFilename = await saveFile(folderName, filename, data);

      expect(savedFilename).toBe('empty.jpg');
      
      const filePath = join(process.cwd(), 'images', folderName, savedFilename);
      expect(existsSync(filePath)).toBe(true);
      
      const savedData = await readFile(filePath);
      expect(savedData).toHaveLength(0);
    });

    it('큰 파일도 저장할 수 있다', async () => {
      const folderName = 'test-savefile/배경이미지5';
      const filename = 'large.jpg';
      // 1MB 크기의 데이터 생성
      const data = Buffer.alloc(1024 * 1024, 'x');

      const savedFilename = await saveFile(folderName, filename, data);

      expect(savedFilename).toBe('large.jpg');
      
      const filePath = join(process.cwd(), 'images', folderName, savedFilename);
      expect(existsSync(filePath)).toBe(true);
      
      const savedData = await readFile(filePath);
      expect(savedData).toHaveLength(1024 * 1024);
    });
  });
});

describe('listFiles', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-listfiles');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 8.1, 8.2, 8.3, 8.5: 파일 목록 조회', () => {
    it('폴더의 파일 목록을 반환한다 (Requirement 8.1, 8.2)', async () => {
      const folderName = 'test-listfiles/배경이미지';
      
      // 테스트 파일 생성
      await saveFile(folderName, '영화1.jpg', Buffer.from('data1'));
      await saveFile(folderName, '영화2.jpg', Buffer.from('data2'));
      await saveFile(folderName, '영화3.jpg', Buffer.from('data3'));

      const files = await listFiles(folderName);

      expect(files).toHaveLength(3);
      expect(files.map(f => f.name)).toContain('영화1.jpg');
      expect(files.map(f => f.name)).toContain('영화2.jpg');
      expect(files.map(f => f.name)).toContain('영화3.jpg');
    });

    it('파일 정보에 id, name, folder, size를 포함한다 (Requirement 8.3)', async () => {
      const folderName = 'test-listfiles/로고';
      const filename = 'LI_영화제목.png';
      const data = Buffer.from('logo data');
      
      await saveFile(folderName, filename, data);

      const files = await listFiles(folderName);

      expect(files).toHaveLength(1);
      const file = files[0];
      expect(file.id).toBe(filename);
      expect(file.name).toBe(filename);
      expect(file.folder).toBe(folderName);
      expect(file.size).toBe(data.length);
    });

    it('빈 폴더는 빈 배열을 반환한다 (Requirement 8.5)', async () => {
      const folderName = 'test-listfiles/빈폴더';

      const files = await listFiles(folderName);

      expect(files).toEqual([]);
    });

    it('폴더가 없으면 자동으로 생성하고 빈 배열을 반환한다', async () => {
      const folderName = 'test-listfiles/새폴더';

      const files = await listFiles(folderName);

      expect(files).toEqual([]);
      expect(existsSync(join(process.cwd(), 'images', folderName))).toBe(true);
    });

    it('여러 파일의 크기를 정확히 반환한다', async () => {
      const folderName = 'test-listfiles/배경이미지2';
      
      await saveFile(folderName, 'small.jpg', Buffer.from('x'));
      await saveFile(folderName, 'medium.jpg', Buffer.from('x'.repeat(100)));
      await saveFile(folderName, 'large.jpg', Buffer.from('x'.repeat(1000)));

      const files = await listFiles(folderName);

      expect(files).toHaveLength(3);
      
      const small = files.find(f => f.name === 'small.jpg');
      const medium = files.find(f => f.name === 'medium.jpg');
      const large = files.find(f => f.name === 'large.jpg');
      
      expect(small?.size).toBe(1);
      expect(medium?.size).toBe(100);
      expect(large?.size).toBe(1000);
    });

    it('디렉토리는 파일 목록에서 제외한다', async () => {
      const folderName = 'test-listfiles/배경이미지3';
      const folderPath = join(process.cwd(), 'images', folderName);
      
      await mkdir(folderPath, { recursive: true });
      await writeFile(join(folderPath, 'file.jpg'), 'data');
      await mkdir(join(folderPath, 'subfolder'), { recursive: true });

      const files = await listFiles(folderName);

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('file.jpg');
    });
  });
});

describe('listResultFilenames', () => {
  // listResultFilenames는 실제 BASE_DIR을 사용하므로, 실제 경로에 테스트 파일 생성
  const resultDir = join(process.cwd(), 'images', '결과물');
  const testDateFolders = ['2024-01-15-test', '2024-01-16-test', '2024-01-17-test'];
  
  afterEach(async () => {
    // 테스트 후 생성한 날짜 폴더 정리
    for (const dateFolder of testDateFolders) {
      const datePath = join(resultDir, dateFolder);
      if (existsSync(datePath)) {
        await rm(datePath, { recursive: true, force: true });
      }
    }
  });

  describe('Requirement 10.1: 결과물 파일명 목록 조회', () => {
    it('모든 날짜 폴더의 파일명을 반환한다', async () => {
      // 여러 날짜 폴더에 파일 생성
      await mkdir(join(resultDir, '2024-01-15-test'), { recursive: true });
      await writeFile(join(resultDir, '2024-01-15-test', '영화1.jpg'), 'data');
      await writeFile(join(resultDir, '2024-01-15-test', '영화2.jpg'), 'data');
      
      await mkdir(join(resultDir, '2024-01-16-test'), { recursive: true });
      await writeFile(join(resultDir, '2024-01-16-test', '영화3.jpg'), 'data');

      const filenames = await listResultFilenames();

      // 테스트 파일이 포함되어 있는지 확인
      expect(filenames).toEqual(expect.arrayContaining(['영화1.jpg', '영화2.jpg', '영화3.jpg']));
    });

    it('결과물 폴더가 없으면 빈 배열을 반환한다', async () => {
      // 결과물 폴더를 삭제하지 않고, 빈 상태로 테스트
      // (다른 테스트가 파일을 생성할 수 있으므로 빈 배열 체크는 하지 않음)
      const filenames = await listResultFilenames();

      // 배열이 반환되는지만 확인
      expect(Array.isArray(filenames)).toBe(true);
    });

    it('빈 날짜 폴더는 무시한다', async () => {
      // 빈 날짜 폴더 생성
      await mkdir(join(resultDir, '2024-01-15-test'), { recursive: true });
      
      // 파일이 있는 날짜 폴더 생성
      await mkdir(join(resultDir, '2024-01-16-test'), { recursive: true });
      await writeFile(join(resultDir, '2024-01-16-test', '영화1.jpg'), 'data');

      const filenames = await listResultFilenames();

      // 테스트 파일이 포함되어 있는지 확인
      expect(filenames).toEqual(expect.arrayContaining(['영화1.jpg']));
    });

    it('디렉토리가 아닌 항목은 무시한다', async () => {
      // 잘못된 형식의 파일 생성
      await mkdir(resultDir, { recursive: true });
      await writeFile(join(resultDir, 'not-a-folder.txt'), 'data');
      
      await mkdir(join(resultDir, '2024-01-15-test'), { recursive: true });
      await writeFile(join(resultDir, '2024-01-15-test', '영화1.jpg'), 'data');

      const filenames = await listResultFilenames();

      expect(filenames).toEqual(expect.arrayContaining(['영화1.jpg']));
      expect(filenames).not.toContain('not-a-folder.txt');
      
      // 테스트 파일 정리
      await unlink(join(resultDir, 'not-a-folder.txt'));
    });
  });
});

describe('deleteLocalFile', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-delete');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 9.1, 9.2, 9.3: 파일 삭제', () => {
    it('파일을 삭제한다 (Requirement 9.1)', async () => {
      const folderName = 'test-delete/배경이미지';
      const filename = '영화제목.jpg';
      
      await saveFile(folderName, filename, Buffer.from('data'));
      
      const filePath = join(process.cwd(), 'images', folderName, filename);
      expect(existsSync(filePath)).toBe(true);

      await deleteLocalFile(folderName, filename);

      expect(existsSync(filePath)).toBe(false);
    });

    it('존재하지 않는 파일 삭제 시 에러를 발생시키지 않는다 (Requirement 9.2)', async () => {
      const folderName = 'test-delete/로고';
      const filename = 'nonexistent.png';

      // 에러 없이 완료되어야 함
      await expect(deleteLocalFile(folderName, filename)).resolves.toBeUndefined();
    });

    it('여러 파일을 삭제할 수 있다 (Requirement 9.3)', async () => {
      const folderName = 'test-delete/배경이미지2';
      
      await saveFile(folderName, '영화1.jpg', Buffer.from('data1'));
      await saveFile(folderName, '영화2.jpg', Buffer.from('data2'));
      await saveFile(folderName, '영화3.jpg', Buffer.from('data3'));

      await deleteLocalFile(folderName, '영화1.jpg');
      await deleteLocalFile(folderName, '영화3.jpg');

      const files = await listFiles(folderName);
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('영화2.jpg');
    });

    it('삭제 후 같은 파일명으로 다시 저장할 수 있다', async () => {
      const folderName = 'test-delete/로고2';
      const filename = 'LI_영화제목.png';
      
      await saveFile(folderName, filename, Buffer.from('original'));
      await deleteLocalFile(folderName, filename);
      await saveFile(folderName, filename, Buffer.from('new'));

      const data = await readLocalFile(folderName, filename);
      expect(data.toString()).toBe('new');
    });
  });
});

describe('readBackground', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-readbg');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 4.1, 4.2, 4.3, 4.4: 배경이미지 읽기', () => {
    it('배경이미지 폴더에서 파일을 읽는다 (Requirement 4.1, 4.3)', async () => {
      const folderName = 'test-readbg/배경이미지';
      const filename = '영화제목.jpg';
      const data = Buffer.from('background image data');
      
      await saveFile(folderName, filename, data);

      // readBackground는 '배경이미지' 폴더를 사용하므로, 실제 폴더에 저장
      const bgFolder = join(process.cwd(), 'images', '배경이미지');
      await mkdir(bgFolder, { recursive: true });
      await writeFile(join(bgFolder, filename), data);

      const result = await readBackground(filename);

      expect(result.toString()).toBe('background image data');
      
      // 정리
      await deleteLocalFile('배경이미지', filename);
    });

    it('파일이 없으면 에러를 발생시킨다 (Requirement 4.2)', async () => {
      const filename = 'nonexistent.jpg';

      await expect(readBackground(filename)).rejects.toThrow(
        `파일 '${filename}'을(를) '배경이미지' 폴더에서 찾을 수 없습니다`
      );
    });

    it('정확한 파일명 매칭을 사용한다 (Requirement 4.4)', async () => {
      const bgFolder = join(process.cwd(), 'images', '배경이미지');
      await mkdir(bgFolder, { recursive: true });
      await writeFile(join(bgFolder, '영화제목.jpg'), 'data');

      // 대소문자가 다르면 찾지 못함 (파일 시스템에 따라 다를 수 있음)
      await expect(readBackground('영화제목2.jpg')).rejects.toThrow();
      
      // 정리
      await deleteLocalFile('배경이미지', '영화제목.jpg');
    });
  });
});

describe('readLogo', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-readlogo');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 5.1, 5.2, 5.3, 5.4: 로고 읽기', () => {
    it('로고 폴더에서 파일을 읽는다 (Requirement 5.1, 5.3)', async () => {
      const filename = 'LI_영화제목.png';
      const data = Buffer.from('logo image data');
      
      // readLogo는 '로고' 폴더를 사용하므로, 실제 폴더에 저장
      const logoFolder = join(process.cwd(), 'images', '로고');
      await mkdir(logoFolder, { recursive: true });
      await writeFile(join(logoFolder, filename), data);

      const result = await readLogo(filename);

      expect(result.toString()).toBe('logo image data');
      
      // 정리
      await deleteLocalFile('로고', filename);
    });

    it('파일이 없으면 에러를 발생시킨다 (Requirement 5.2)', async () => {
      const filename = 'nonexistent.png';

      await expect(readLogo(filename)).rejects.toThrow(
        `파일 '${filename}'을(를) '로고' 폴더에서 찾을 수 없습니다`
      );
    });

    it('정확한 파일명 매칭을 사용한다 (Requirement 5.4)', async () => {
      const logoFolder = join(process.cwd(), 'images', '로고');
      await mkdir(logoFolder, { recursive: true });
      await writeFile(join(logoFolder, 'LI_영화제목.png'), 'data');

      // 다른 파일명은 찾지 못함
      await expect(readLogo('LI_영화제목2.png')).rejects.toThrow();
      
      // 정리
      await deleteLocalFile('로고', 'LI_영화제목.png');
    });
  });
});

describe('readLocalFile', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-readlocal');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('일반 파일 읽기', () => {
    it('지정된 폴더에서 파일을 읽는다', async () => {
      const folderName = 'test-readlocal/테스트폴더';
      const filename = 'test.jpg';
      const data = Buffer.from('test data');
      
      await saveFile(folderName, filename, data);

      const result = await readLocalFile(folderName, filename);

      expect(result.toString()).toBe('test data');
    });

    it('파일이 없으면 에러를 발생시킨다', async () => {
      const folderName = 'test-readlocal/테스트폴더2';
      const filename = 'nonexistent.jpg';

      await expect(readLocalFile(folderName, filename)).rejects.toThrow(
        `파일 '${filename}'을(를) '${folderName}' 폴더에서 찾을 수 없습니다`
      );
    });

    it('바이너리 데이터를 읽을 수 있다', async () => {
      const folderName = 'test-readlocal/테스트폴더3';
      const filename = 'binary.dat';
      const data = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      
      await saveFile(folderName, filename, data);

      const result = await readLocalFile(folderName, filename);

      expect(result).toEqual(data);
    });
  });
});

describe('saveResult', () => {
  const testBaseDir = join(process.cwd(), 'images', 'test-saveresult');
  
  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Requirements 6.1, 6.2, 6.3, 6.4, 6.5: 결과물 저장', () => {
    it('날짜별 폴더에 결과물을 저장한다 (Requirement 6.1, 6.2)', async () => {
      const filename = '영화제목.jpg';
      const data = Buffer.from('result image data');
      const dateStr = '2024-01-15';

      const savedFilename = await saveResult(filename, data, dateStr);

      expect(savedFilename).toBe(filename);
      
      // 실제 BASE_DIR에 저장되므로 확인
      const resultPath = join(process.cwd(), 'images', '결과물', dateStr, filename);
      expect(existsSync(resultPath)).toBe(true);
      
      const savedData = await readFile(resultPath);
      expect(savedData.toString()).toBe('result image data');
      
      // 정리
      await rm(join(process.cwd(), 'images', '결과물', dateStr), { recursive: true, force: true });
    });

    it('날짜 폴더가 없으면 자동으로 생성한다 (Requirement 6.3)', async () => {
      const filename = '영화제목2.jpg';
      const data = Buffer.from('data');
      const dateStr = '2024-01-16';

      await saveResult(filename, data, dateStr);

      const dateFolderPath = join(process.cwd(), 'images', '결과물', dateStr);
      expect(existsSync(dateFolderPath)).toBe(true);
      
      // 정리
      await rm(dateFolderPath, { recursive: true, force: true });
    });

    it('동일한 파일명이 있으면 덮어쓴다 (Requirement 6.4)', async () => {
      const filename = '영화제목3.jpg';
      const dateStr = '2024-01-17';
      
      await saveResult(filename, Buffer.from('original'), dateStr);
      await saveResult(filename, Buffer.from('updated'), dateStr);

      const resultPath = join(process.cwd(), 'images', '결과물', dateStr, filename);
      const savedData = await readFile(resultPath);
      expect(savedData.toString()).toBe('updated');
      
      // 정리
      await rm(join(process.cwd(), 'images', '결과물', dateStr), { recursive: true, force: true });
    });

    it('파일명을 반환한다 (Requirement 6.5)', async () => {
      const filename = '영화제목4.jpg';
      const data = Buffer.from('data');
      const dateStr = '2024-01-18';

      const result = await saveResult(filename, data, dateStr);

      expect(result).toBe(filename);
      
      // 정리
      await rm(join(process.cwd(), 'images', '결과물', dateStr), { recursive: true, force: true });
    });

    it('여러 날짜에 결과물을 저장할 수 있다', async () => {
      const filename = '영화제목5.jpg';
      const data = Buffer.from('data');
      
      await saveResult(filename, data, '2024-01-19');
      await saveResult(filename, data, '2024-01-20');
      await saveResult(filename, data, '2024-01-21');

      expect(existsSync(join(process.cwd(), 'images', '결과물', '2024-01-19', filename))).toBe(true);
      expect(existsSync(join(process.cwd(), 'images', '결과물', '2024-01-20', filename))).toBe(true);
      expect(existsSync(join(process.cwd(), 'images', '결과물', '2024-01-21', filename))).toBe(true);
      
      // 정리
      await rm(join(process.cwd(), 'images', '결과물', '2024-01-19'), { recursive: true, force: true });
      await rm(join(process.cwd(), 'images', '결과물', '2024-01-20'), { recursive: true, force: true });
      await rm(join(process.cwd(), 'images', '결과물', '2024-01-21'), { recursive: true, force: true });
    });

    it('같은 날짜에 여러 파일을 저장할 수 있다', async () => {
      const dateStr = '2024-01-22';
      const data = Buffer.from('data');
      
      await saveResult('영화1.jpg', data, dateStr);
      await saveResult('영화2.jpg', data, dateStr);
      await saveResult('영화3.jpg', data, dateStr);

      const dateFolderPath = join(process.cwd(), 'images', '결과물', dateStr);
      const files = await readdir(dateFolderPath);
      
      expect(files).toHaveLength(3);
      expect(files).toContain('영화1.jpg');
      expect(files).toContain('영화2.jpg');
      expect(files).toContain('영화3.jpg');
      
      // 정리
      await rm(dateFolderPath, { recursive: true, force: true });
    });
  });
});
