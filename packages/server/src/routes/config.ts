import { Router } from 'express';
import type { AppConfig } from '@card-news/shared';
import { saveConfig, loadConfig, validateConfig } from '../config/config-manager.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const configRouter = Router();

/**
 * POST /api/config/setup-partial
 * 유효성 검증 없이 설정을 저장한다. (시트 생성 등 부분 설정 시 사용)
 */
configRouter.post('/setup-partial', async (req, res) => {
  try {
    log.info('부분 설정 저장 요청');
    const config = req.body;
    await saveConfig(config);
    log.info('부분 설정 저장 성공');
    sendSuccess(res, { message: '설정이 저장되었습니다' });
  } catch (error) {
    log.error('부분 설정 저장 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 저장 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/config/setup
 * AppConfig를 받아 유효성 검증 후 파일에 저장한다.
 */
configRouter.post('/setup', async (req, res) => {
  try {
    log.info('설정 저장 요청');
    const config = req.body as AppConfig;
    const validation = validateConfig(config);

    if (!validation.valid) {
      log.warn('설정 유효성 검증 실패', { missingFields: validation.missingFields });
      sendErrorAuto(res, ErrorCode.MISSING_FIELDS, '설정 유효성 검증 실패', {
        missingFields: validation.missingFields,
      });
      return;
    }

    await saveConfig(config);
    log.info('설정 저장 성공');
    sendSuccess(res, { message: '설정이 저장되었습니다' });
  } catch (error) {
    log.error('설정 저장 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 저장 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/config/test-connection
 * Google Sheets, Figma API 연결을 테스트한다.
 * templateNodeId는 검증하지 않는다 (연결 테스트 시점에는 선택되지 않았을 수 있음).
 */
configRouter.post('/test-connection', async (req, res) => {
  try {
    log.info('API 연결 테스트 요청');
    const config = await loadConfig();

    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다. 먼저 설정을 완료해주세요.');
      return;
    }

    // 연결 테스트를 위한 부분 검증 (templateNodeId 제외)
    const missingFields: string[] = [];
    
    if (!config.google?.serviceAccountKey || Object.keys(config.google.serviceAccountKey).length === 0) {
      missingFields.push('google.serviceAccountKey');
    }
    if (!config.google?.spreadsheetId || config.google.spreadsheetId.trim() === '') {
      missingFields.push('google.spreadsheetId');
    }
    if (!config.figma?.accessToken || config.figma.accessToken.trim() === '') {
      missingFields.push('figma.accessToken');
    }
    if (!config.figma?.fileKey || config.figma.fileKey.trim() === '') {
      missingFields.push('figma.fileKey');
    }

    if (missingFields.length > 0) {
      log.warn('연결 테스트를 위한 필수 설정이 누락됨', { missingFields });
      sendErrorAuto(res, ErrorCode.CONFIG_INVALID, '연결 테스트를 위한 필수 설정이 누락되었습니다.', {
        missingFields,
      });
      return;
    }

    // TODO: 실제 Google Sheets, Figma API 연결 테스트 구현
    log.info('API 연결 테스트 성공 (mock)');
    sendSuccess(res, {
      results: {
        googleSheets: { connected: true },
        figma: { connected: true },
      },
    });
  } catch (error) {
    log.error('API 연결 테스트 실패', error);
    sendErrorAuto(res, ErrorCode.API_CONNECTION_FAILED, 'API 연결 테스트 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/config/status
 * 저장된 설정을 로드하고 유효성을 검증하여 상태를 반환한다.
 * templateNodeId가 없어도 부분 설정으로 간주하여 configured: true를 반환한다.
 */
configRouter.get('/status', async (_req, res) => {
  try {
    log.debug('설정 상태 조회');
    const config = await loadConfig();

    if (!config) {
      sendSuccess(res, {
        configured: false,
        valid: false,
        missingFields: [],
      });
      return;
    }

    // 부분 설정 검증 (templateNodeId 제외)
    const missingFields: string[] = [];
    
    if (!config.google?.serviceAccountKey || Object.keys(config.google.serviceAccountKey).length === 0) {
      missingFields.push('google.serviceAccountKey');
    }
    if (!config.google?.spreadsheetId || config.google.spreadsheetId.trim() === '') {
      missingFields.push('google.spreadsheetId');
    }
    if (!config.figma?.accessToken || config.figma.accessToken.trim() === '') {
      missingFields.push('figma.accessToken');
    }
    if (!config.figma?.fileKey || config.figma.fileKey.trim() === '') {
      missingFields.push('figma.fileKey');
    }

    // templateNodeId는 선택적 필드로 처리
    const isPartiallyConfigured = missingFields.length === 0;
    const validation = validateConfig(config);

    sendSuccess(res, {
      configured: isPartiallyConfigured, // 부분 설정도 configured: true
      valid: validation.valid, // 전체 유효성은 별도로 반환
      missingFields: validation.missingFields,
    });
  } catch (error) {
    log.error('설정 상태 조회 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 상태 조회 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/config/load
 * 저장된 설정을 로드하여 반환한다. (민감 정보 포함)
 */
configRouter.get('/load', async (_req, res) => {
  try {
    log.debug('설정 로드');
    const config = await loadConfig();

    if (!config) {
      sendSuccess(res, {
        configured: false,
      });
      return;
    }

    sendSuccess(res, {
      configured: true,
      config,
    });
  } catch (error) {
    log.error('설정 로드 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 로드 중 오류가 발생했습니다');
  }
});

/**
 * GET /api/config/plugin-status
 * Figma 플러그인 WebSocket 연결 상태를 반환한다.
 */
configRouter.get('/plugin-status', (_req, res) => {
  // Dynamic import to avoid circular dependency
  import('../index.js').then(({ getWebSocketBridge }) => {
    const bridge = getWebSocketBridge();
    sendSuccess(res, {
      pluginConnected: bridge?.connected ?? false,
    });
  }).catch((error) => {
    log.error('플러그인 상태 조회 실패', error);
    sendSuccess(res, { pluginConnected: false });
  });
});

/**
 * POST /api/config/backup
 * 현재 설정을 구글 드라이브에 백업한다.
 */
configRouter.post('/backup', async (_req, res) => {
  try {
    log.info('설정 백업 요청');
    const config = await loadConfig();
    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다.');
      return;
    }

    const { saveResult } = await import('../local/local-storage.js');

    const configJson = JSON.stringify(config, null, 2);
    const buffer = Buffer.from(configJson, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `config_backup_${timestamp}.json`;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    await saveResult(filename, buffer, today);

    log.info('설정 백업 성공', { filename });
    sendSuccess(res, { filename }, HttpStatus.CREATED);
  } catch (error) {
    log.error('설정 백업 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 백업 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/config/restore
 * 구글 드라이브에서 설정을 복원한다.
 * Body: { fileId: string }
 */
configRouter.post('/restore', async (req, res) => {
  try {
    log.info('설정 복원 요청');
    const { filename, date } = req.body as { filename?: string; date?: string };
    if (!filename || !date) {
      log.warn('filename 또는 date 누락');
      sendErrorAuto(res, ErrorCode.MISSING_FIELDS, 'filename과 date가 필요합니다');
      return;
    }

    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const { env } = await import('../config/env.js');
    
    const filePath = join(env.BASE_DIR, '결과물', date, filename);
    
    const fileData = await readFile(filePath);
    const restoredConfig = JSON.parse(fileData.toString('utf-8'));

    await saveConfig(restoredConfig);

    log.info('설정 복원 성공', { filename, date });
    sendSuccess(res, { message: '설정이 복원되었습니다' });
  } catch (error) {
    log.error('설정 복원 실패', error);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, '설정 복원 중 오류가 발생했습니다');
  }
});
