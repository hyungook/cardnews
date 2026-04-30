import { Router } from 'express';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { loadConfig } from '../config/config-manager.js';
import { sendSuccess, sendErrorAuto } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const migrateRouter = Router();

/**
 * POST /api/migrate/columns
 * 구글 시트의 컬럼 순서를 변경한다.
 * 기존: 영화제목, 기본문구, 추가문구, 뱃지1-4, 카피라이트, 배경, 로고
 * 신규: 영화제목, 배경, 로고, 기본문구, 추가문구, 뱃지1-4, 카피라이트
 */
migrateRouter.post('/columns', async (_req, res) => {
  try {
    log.info('컬럼 순서 마이그레이션 시작');
    const config = await loadConfig();
    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다.');
      return;
    }

    const auth = new GoogleAuth({
      credentials: config.google.serviceAccountKey as object,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.google.spreadsheetId;

    // 1. 기존 데이터 읽기 (헤더 포함)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:J',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      log.warn('데이터가 없음');
      sendSuccess(res, { message: '마이그레이션할 데이터가 없습니다' });
      return;
    }

    // 2. 데이터 재배치
    // 기존 순서: [0]영화제목, [1]기본문구, [2]추가문구, [3]뱃지1, [4]뱃지2, [5]뱃지3, [6]뱃지4, [7]카피라이트, [8]배경, [9]로고
    // 신규 순서: [0]영화제목, [1]배경, [2]로고, [3]기본문구, [4]추가문구, [5]뱃지1, [6]뱃지2, [7]뱃지3, [8]뱃지4, [9]카피라이트
    const migratedRows = rows.map((row) => {
      const cells = [...row];
      // 빈 셀 채우기 (10개 컬럼 보장)
      while (cells.length < 10) {
        cells.push('');
      }
      
      return [
        cells[0],  // 영화제목
        cells[8],  // 배경 (기존 8번 → 신규 1번)
        cells[9],  // 로고 (기존 9번 → 신규 2번)
        cells[1],  // 기본문구 (기존 1번 → 신규 3번)
        cells[2],  // 추가문구 (기존 2번 → 신규 4번)
        cells[3],  // 뱃지1 (기존 3번 → 신규 5번)
        cells[4],  // 뱃지2 (기존 4번 → 신규 6번)
        cells[5],  // 뱃지3 (기존 5번 → 신규 7번)
        cells[6],  // 뱃지4 (기존 6번 → 신규 8번)
        cells[7],  // 카피라이트 (기존 7번 → 신규 9번)
      ];
    });

    // 3. 헤더 업데이트
    migratedRows[0] = ['영화제목', '배경이미지', '로고', '기본문구', '추가문구', '뱃지1', '뱃지2', '뱃지3', '뱃지4', '카피라이트'];

    // 4. 전체 데이터 덮어쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:J',
      valueInputOption: 'RAW',
      requestBody: {
        values: migratedRows,
      },
    });

    log.info('컬럼 순서 마이그레이션 완료', { rowCount: migratedRows.length });
    sendSuccess(res, {
      message: '컬럼 순서가 성공적으로 변경되었습니다',
      rowCount: migratedRows.length - 1, // 헤더 제외
    });
  } catch (error) {
    log.error('컬럼 순서 마이그레이션 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '마이그레이션 중 오류가 발생했습니다');
  }
});
