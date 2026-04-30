import { Router } from 'express';
import { loadConfig } from '../config/config-manager.js';
import { SpreadsheetReader } from '../google/sheets-reader.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const historyRouter = Router();

/**
 * 설정을 로드하고 SpreadsheetReader 인스턴스를 생성하는 헬퍼.
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
 * GET /api/history
 * 히스토리_탭의 모든 생성 이력을 목록으로 반환한다.
 */
historyRouter.get('/', async (_req, res) => {
  try {
    log.debug('히스토리 목록 조회');
    const reader = await createReader();
    const records = await reader.readHistory();
    log.info('히스토리 목록 조회 성공', { recordCount: records.length });
    sendSuccess(res, { records });
  } catch (error) {
    log.error('히스토리 목록 조회 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '히스토리 조회 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/history/:id
 * 특정 히스토리 기록의 상세 정보를 반환한다.
 */
historyRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    log.debug('히스토리 상세 조회', { id });
    const reader = await createReader();
    const records = await reader.readHistory();
    const record = records.find((r) => r.id === id);

    if (!record) {
      log.warn('히스토리 기록을 찾을 수 없음', { id });
      sendErrorAuto(res, ErrorCode.NOT_FOUND, `히스토리 기록을 찾을 수 없습니다: ${id}`);
      return;
    }

    log.info('히스토리 상세 조회 성공', { id });
    sendSuccess(res, { record });
  } catch (error) {
    log.error('히스토리 상세 조회 실패', error);
    sendErrorAuto(res, ErrorCode.SHEETS_CONNECTION_FAILED, '히스토리 조회 중 오류가 발생했습니다');
  }
});
