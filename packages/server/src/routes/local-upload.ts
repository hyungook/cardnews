import { Router } from 'express';
import multer from 'multer';
import { saveFile, listFiles, deleteLocalFile } from '../local/local-storage.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import {
  validateFilename,
  validateBackgroundImage,
  validateLogoImage,
  validateFileSize,
  validateFolder,
  FileValidationError,
} from '../utils/file-validator.js';
import { uploadLimiter, getUploadStatus } from '../middleware/upload-limiter.js';
import { isDuplicateFile } from '../utils/file-hash.js';
import { resolveFilenameConflict } from '../utils/filename-conflict.js';

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: env.MAX_FILE_SIZE },
  // 파일명 인코딩 문제 해결
  fileFilter: (_req, file, cb) => {
    // originalname을 UTF-8로 재인코딩
    try {
      // Latin1로 인코딩된 파일명을 Buffer로 변환 후 UTF-8로 디코딩
      const buffer = Buffer.from(file.originalname, 'latin1');
      file.originalname = buffer.toString('utf8');
    } catch (error) {
      // 인코딩 실패 시 원본 유지
      log.warn('파일명 인코딩 변환 실패', { originalname: file.originalname });
    }
    cb(null, true);
  }
});

export const localUploadRouter = Router();

/**
 * POST /api/local/upload
 * 이미지 파일을 로컬 폴더에 업로드한다.
 * Form data: file (binary), folder ('background' | 'logo'), skipDuplicateCheck (optional)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.3, 3.5, 3.6, 12.1, 12.2, 12.5
 */
localUploadRouter.post('/upload', uploadLimiter(false), upload.single('file'), async (req, res) => {
  try {
    log.info('파일 업로드 요청 시작');
    
    // 파일 존재 확인
    if (!req.file) {
      log.warn('파일이 제공되지 않음');
      sendErrorAuto(res, ErrorCode.NO_FILE_PROVIDED);
      return;
    }

    log.debug('파일 정보', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    // 폴더 파라미터 검증
    const folder = req.body.folder as string;
    const skipDuplicateCheck = req.body.skipDuplicateCheck === 'true';
    
    if (folder !== 'background' && folder !== 'logo') {
      log.warn('잘못된 폴더 파라미터', { folder });
      sendErrorAuto(res, ErrorCode.INVALID_FOLDER, "folder는 'background' 또는 'logo'여야 합니다");
      return;
    }

    const folderName = folder === 'background' ? '배경이미지' : '로고';

    // 파일명 검증
    validateFilename(req.file.originalname);

    // 파일 크기 검증
    validateFileSize(req.file.size, env.MAX_FILE_SIZE);

    // 파일 형식 검증
    if (folder === 'background') {
      validateBackgroundImage(req.file.originalname);
    } else {
      validateLogoImage(req.file.originalname);
    }

    // 중복 파일 체크 (skipDuplicateCheck가 false일 때만)
    if (!skipDuplicateCheck) {
      const duplicate = await isDuplicateFile(req.file.buffer, folderName);
      if (duplicate) {
        log.warn('중복 파일 감지', { 
          uploadFilename: req.file.originalname,
          existingFilename: duplicate.filename,
          folder: folderName 
        });
        sendErrorAuto(res, ErrorCode.FILE_DUPLICATE, 
          `동일한 파일이 이미 존재합니다: ${duplicate.filename}`, {
            existingFile: duplicate.filename,
            folder: duplicate.folder,
          }
        );
        return;
      }
    }

    log.info('파일 저장 시작', { folder: folderName, filename: req.file.originalname });
    
    // 파일 저장 (파일명 자동 정규화 및 충돌 처리)
    const normalizedFilename = await saveFile(folderName, req.file.originalname, req.file.buffer);
    
    log.info('파일 업로드 성공', { folder: folderName, filename: normalizedFilename });

    sendSuccess(res, {
      filename: normalizedFilename,
      folder: folderName,
    }, HttpStatus.CREATED);
  } catch (error) {
    if (error instanceof FileValidationError) {
      log.warn('파일 검증 실패', { error: error.message, code: error.code });
      sendErrorAuto(res, error.code, error.message, error.details);
      return;
    }

    log.error('파일 업로드 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '파일 업로드 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/local/files
 * 배경이미지 + 로고 폴더의 파일 목록을 조회한다.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.3, 12.6
 */
localUploadRouter.get('/files', async (_req, res) => {
  try {
    log.debug('파일 목록 조회 시작');

    const [backgroundFiles, logoFiles] = await Promise.all([
      listFiles('배경이미지'),
      listFiles('로고'),
    ]);

    const files = [
      ...backgroundFiles.map((f) => ({ ...f, folder: '배경이미지' })),
      ...logoFiles.map((f) => ({ ...f, folder: '로고' })),
    ];

    log.info('파일 목록 조회 성공', { count: files.length });
    sendSuccess(res, { files });
  } catch (error) {
    log.error('파일 목록 조회 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '파일 목록 조회 중 오류가 발생했습니다');
  }
});

/**
 * DELETE /api/local/files/:filename
 * 로컬 폴더에서 파일을 삭제한다.
 * Query parameter: folder ('배경이미지' | '로고')
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 12.4
 */
localUploadRouter.delete('/files/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const folder = req.query.folder as string;

    log.info('파일 삭제 요청', { filename, folder });

    // 폴더 검증
    if (!folder) {
      log.warn('폴더 파라미터 누락');
      sendErrorAuto(res, ErrorCode.INVALID_FOLDER, 'folder 쿼리 파라미터가 필요합니다');
      return;
    }

    validateFolder(folder);

    // 파일명 검증 (숨김 파일 제외 - 삭제 시에는 허용)
    // 빈 파일명만 체크
    if (!filename || filename.trim().length === 0) {
      log.warn('파일명이 비어있음');
      sendErrorAuto(res, ErrorCode.INVALID_FILENAME, '파일명이 비어있습니다');
      return;
    }

    // 위험한 패턴만 체크 (디렉토리 트래버설 방지)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      log.warn('위험한 파일명 패턴', { filename });
      sendErrorAuto(res, ErrorCode.INVALID_FILENAME, '파일명에 허용되지 않는 문자가 포함되어 있습니다');
      return;
    }

    await deleteLocalFile(folder, filename);

    log.info('파일 삭제 성공', { filename, folder });
    sendSuccess(res, { message: '파일이 삭제되었습니다' });
  } catch (error) {
    if (error instanceof FileValidationError) {
      log.warn('파일 검증 실패', { error: error.message, code: error.code });
      sendErrorAuto(res, error.code, error.message, error.details);
      return;
    }

    log.error('파일 삭제 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '파일 삭제 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/local/check-duplicate
 * 업로드 전 중복 파일을 확인한다.
 * Form data: file (binary), folder ('background' | 'logo')
 * 
 * Requirements: 2.4.1
 */
localUploadRouter.post('/check-duplicate', upload.single('file'), async (req, res) => {
  try {
    log.info('중복 파일 체크 요청');
    
    if (!req.file) {
      log.warn('파일이 제공되지 않음');
      sendErrorAuto(res, ErrorCode.NO_FILE_PROVIDED);
      return;
    }

    const folder = req.body.folder as string;
    if (folder !== 'background' && folder !== 'logo') {
      log.warn('잘못된 폴더 파라미터', { folder });
      sendErrorAuto(res, ErrorCode.INVALID_FOLDER, "folder는 'background' 또는 'logo'여야 합니다");
      return;
    }

    const folderName = folder === 'background' ? '배경이미지' : '로고';

    // 중복 파일 체크
    const duplicate = await isDuplicateFile(req.file.buffer, folderName);
    
    if (duplicate) {
      log.info('중복 파일 발견', { 
        uploadFilename: req.file.originalname,
        existingFilename: duplicate.filename 
      });
      
      sendSuccess(res, {
        isDuplicate: true,
        existingFile: {
          filename: duplicate.filename,
          folder: duplicate.folder,
        },
      });
    } else {
      log.info('중복 파일 없음');
      sendSuccess(res, {
        isDuplicate: false,
      });
    }
  } catch (error) {
    log.error('중복 파일 체크 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '중복 파일 체크 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/local/rename
 * 파일명을 수정한다.
 * Body: { folder: string, oldFilename: string, newFilename: string }
 * 
 * Requirements: 2.5.1, 2.5.2
 */
localUploadRouter.post('/rename', async (req, res) => {
  try {
    const { folder, oldFilename, newFilename } = req.body as {
      folder?: string;
      oldFilename?: string;
      newFilename?: string;
    };

    log.info('파일명 수정 요청', { folder, oldFilename, newFilename });

    // 파라미터 검증
    if (!folder || !oldFilename || !newFilename) {
      log.warn('필수 파라미터 누락');
      sendErrorAuto(res, ErrorCode.MISSING_FIELDS, 'folder, oldFilename, newFilename이 필요합니다');
      return;
    }

    validateFolder(folder);
    validateFilename(oldFilename);
    validateFilename(newFilename);

    // 파일 형식 검증
    if (folder === '배경이미지') {
      validateBackgroundImage(newFilename);
    } else if (folder === '로고') {
      validateLogoImage(newFilename);
    }

    // 파일 이름 변경
    const { rename } = await import('fs/promises');
    const { join } = await import('path');
    const BASE_DIR = join(process.cwd(), env.BASE_DIR);
    
    const oldPath = join(BASE_DIR, folder, oldFilename);
    const newPath = join(BASE_DIR, folder, newFilename);

    // 기존 파일 존재 확인
    const { existsSync } = await import('fs');
    if (!existsSync(oldPath)) {
      log.warn('파일을 찾을 수 없음', { folder, oldFilename });
      sendErrorAuto(res, ErrorCode.FILE_NOT_FOUND, `파일을 찾을 수 없습니다: ${oldFilename}`);
      return;
    }

    // 새 파일명이 이미 존재하는지 확인
    if (existsSync(newPath)) {
      log.warn('새 파일명이 이미 존재함', { folder, newFilename });
      sendErrorAuto(res, ErrorCode.FILE_ALREADY_EXISTS, `같은 이름의 파일이 이미 존재합니다: ${newFilename}`);
      return;
    }

    await rename(oldPath, newPath);

    log.info('파일명 수정 성공', { folder, oldFilename, newFilename });
    sendSuccess(res, { 
      message: '파일명이 수정되었습니다',
      oldFilename,
      newFilename,
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      log.warn('파일 검증 실패', { error: error.message, code: error.code });
      sendErrorAuto(res, error.code, error.message, error.details);
      return;
    }

    log.error('파일명 수정 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '파일명 수정 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/local/files/:filename
 * 파일을 직접 제공한다 (이미지 미리보기용).
 * Query parameter: folder ('배경이미지' | '로고')
 */
localUploadRouter.get('/files/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const folder = req.query.folder as string;

    log.debug('파일 제공 요청', { filename, folder });

    // 폴더 검증
    if (!folder) {
      res.status(400).send('folder 쿼리 파라미터가 필요합니다');
      return;
    }

    validateFolder(folder);

    // 파일 경로 생성
    const { join } = await import('path');
    const BASE_DIR = join(process.cwd(), env.BASE_DIR);
    const filePath = join(BASE_DIR, folder, filename);

    // 파일 존재 확인
    const { existsSync } = await import('fs');
    if (!existsSync(filePath)) {
      log.warn('파일을 찾을 수 없음', { folder, filename });
      res.status(404).send('파일을 찾을 수 없습니다');
      return;
    }

    // 파일 제공
    res.sendFile(filePath);
  } catch (error) {
    log.error('파일 제공 실패', error);
    res.status(500).send('파일 제공 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/local/upload-status
 * 현재 업로드 상태를 조회한다.
 * 
 * Requirements: 2.2.5
 */
localUploadRouter.get('/upload-status', (_req, res) => {
  const status = getUploadStatus();
  log.debug('업로드 상태 조회', status);
  sendSuccess(res, status);
});
