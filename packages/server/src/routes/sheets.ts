import { Router } from 'express';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { loadConfig } from '../config/config-manager.js';
import { SpreadsheetReader } from '../google/sheets-reader.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const sheetsRouter = Router();

/**
 * 설정을 로드하고 SpreadsheetReader 인스턴스를 생성하는 헬퍼.
 * 설정이 없으면 에러를 throw한다.
 */
async function createReader(): Promise<SpreadsheetReader> {
  const config = await loadConfig();
  if (!config) {
    log.warn('설정 파일이 존재하지 않음');
    throw new Error('설정 파일이 존재하지 않습니다. 먼저 설정을 완료해주세요.');
  }
  return new SpreadsheetReader(config);
}

/**
 * POST /api/sheets/create-template
 * 카드뉴스용 템플릿 스프레드시트를 자동 생성한다.
 * 헤더 행과 히스토리 탭이 미리 설정된다.
 */
sheetsRouter.post('/create-template', async (_req, res) => {
  try {
    log.info('스프레드시트 템플릿 생성 요청');
    const config = await loadConfig();
    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다. JSON 키 파일을 먼저 업로드해주세요.');
      return;
    }

    const auth = new GoogleAuth({
      credentials: config.google.serviceAccountKey as object,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Create a new spreadsheet with two sheets
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: '카드뉴스 자동화 데이터',
        },
        sheets: [
          {
            properties: {
              title: '데이터',
              index: 0,
            },
          },
          {
            properties: {
              title: '히스토리',
              index: 1,
            },
          },
        ],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId!;
    const spreadsheetUrl = createResponse.data.spreadsheetUrl!;

    // 2. Set header row for data sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '데이터!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['영화제목', '배경이미지', '로고', '기본문구', '추가문구', '뱃지1', '뱃지2', '뱃지3', '뱃지4', '카피라이트']],
      },
    });

    // 3. Set header row for history sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '히스토리!A1:G1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['ID', '생성일시', '총 건수', '성공', '오류', '파일목록', '오류목록']],
      },
    });

    // 4. Add sample data row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '데이터!A2:J2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['(예시) 영화제목', '', '', '올 여름\n최고의 영화', '제00회 영화제 수상', '무료', 'UHD', '', '', '© 2024 배급사']],
      },
    });

    // 5. Make the spreadsheet accessible to the owner's Google account
    // (Service account created it, so we need to share it)
    const drive = google.drive({ version: 'v3', auth });
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    });

    log.info('스프레드시트 템플릿 생성 성공', { spreadsheetId });
    sendSuccess(res, {
      spreadsheetUrl,
      spreadsheetId,
    }, HttpStatus.CREATED);
  } catch (error) {
    log.error('스프레드시트 템플릿 생성 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '스프레드시트 생성 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/sheets/data
 * 스프레드시트의 모든 행 데이터를 읽어 반환한다.
 */
sheetsRouter.get('/data', async (_req, res) => {
  try {
    log.debug('스프레드시트 데이터 조회');
    const reader = await createReader();
    const rows = await reader.readAllRows();
    log.info('스프레드시트 데이터 조회 성공', { rowCount: rows.length });
    sendSuccess(res, { rows });
  } catch (error) {
    log.error('스프레드시트 데이터 조회 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '스프레드시트 데이터 조회 중 오류가 발생했습니다');
  }
});

/**
 * PUT /api/sheets/cell
 * 특정 셀의 값을 업데이트한다.
 * Body: { row: number, col: number, value: string }
 */
sheetsRouter.put('/cell', async (req, res) => {
  try {
    const { row, col, value } = req.body as {
      row: number;
      col: number;
      value: string;
    };

    if (typeof row !== 'number' || typeof col !== 'number' || typeof value !== 'string') {
      log.warn('셀 업데이트 요청 파라미터 오류', { row, col, value });
      sendErrorAuto(res, ErrorCode.MISSING_FIELDS, 'row(number), col(number), value(string) 필드가 필요합니다.');
      return;
    }

    log.info('셀 업데이트 요청', { row, col });
    const reader = await createReader();
    await reader.updateCell(row, col, value);
    log.info('셀 업데이트 성공', { row, col });
    sendSuccess(res, { message: '셀이 업데이트되었습니다' });
  } catch (error) {
    log.error('셀 업데이트 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '셀 업데이트 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/sheets/refresh
 * 스프레드시트에서 최신 데이터를 다시 읽어 반환한다.
 */
sheetsRouter.post('/refresh', async (_req, res) => {
  try {
    log.info('스프레드시트 새로고침 요청');
    const reader = await createReader();
    const rows = await reader.readAllRows();
    log.info('스프레드시트 새로고침 성공', { rowCount: rows.length });
    sendSuccess(res, { rows });
  } catch (error) {
    log.error('스프레드시트 새로고침 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '스프레드시트 새로고침 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/sheets/validate
 * 스프레드시트 데이터의 유효성을 사전 검증한다.
 * 뱃지 오타, 줄 수 초과, 파일 존재 여부 등을 확인한다.
 */
sheetsRouter.post('/validate', async (_req, res) => {
  try {
    log.info('스프레드시트 데이터 검증 요청');
    const config = await loadConfig();
    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다.');
      return;
    }

    const reader = new SpreadsheetReader(config);
    const rows = await reader.readAllRows();

    const { determineBadgeVariant } = await import('../utils/badge.js');
    const { validateLineCount } = await import('../utils/text-validation.js');

    const validationResults = [];

    for (const row of rows) {
      const issues: string[] = [];
      let status: 'ok' | 'warning' | 'error' = 'ok';

      // Check required field
      if (!row.movieTitle.trim()) {
        issues.push('영화제목이 비어있습니다');
        status = 'error';
      }

      if (!row.mainText.trim()) {
        issues.push('기본문구가 비어있습니다');
        status = 'error';
      }

      // Check line count
      const lineResult = validateLineCount(row.mainText);
      if (!lineResult.valid) {
        issues.push(`기본문구 ${lineResult.lineCount}줄 (최대 3줄)`);
        status = 'error';
      }

      // Check badges
      const badgeResult = determineBadgeVariant([row.badge1, row.badge2, row.badge3, row.badge4]);
      if (badgeResult.invalidBadges.length > 0) {
        issues.push(`유효하지 않은 뱃지: ${badgeResult.invalidBadges.join(', ')}`);
        status = 'error';
      }

      // Check optional fields (warnings)
      if (!row.subText.trim() && status === 'ok') {
        // Not an error, just info
      }

      if (issues.length === 0 && status === 'ok') {
        status = 'ok';
      }

      validationResults.push({
        rowIndex: row.rowIndex,
        movieTitle: row.movieTitle,
        status,
        issues,
      });
    }

    log.info('스프레드시트 데이터 검증 완료', { 
      totalRows: validationResults.length,
      errorCount: validationResults.filter(r => r.status === 'error').length,
      okCount: validationResults.filter(r => r.status === 'ok').length,
    });
    sendSuccess(res, { results: validationResults });
  } catch (error) {
    log.error('스프레드시트 데이터 검증 실패', error);
    sendErrorAuto(res, ErrorCode.VALIDATION_ERROR, '데이터 검증 중 오류가 발생했습니다');
  }
});
