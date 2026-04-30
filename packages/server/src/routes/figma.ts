import { Router } from 'express';
import { loadConfig } from '../config/config-manager.js';
import { getTopLevelFrames, getTopLevelFramesDebug, getFrameChildrenNames } from '../figma/figma-api-client.js';
import { validateTemplateLayerNames } from '../utils/template-validation.js';
import { getWebSocketBridge } from '../index.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const figmaRouter = Router();

/**
 * GET /api/figma/plugin-status
 * Figma 플러그인의 WebSocket 연결 상태를 확인한다.
 */
figmaRouter.get('/plugin-status', (_req, res) => {
  const bridge = getWebSocketBridge();
  const connected = bridge?.connected ?? false;
  
  log.debug('Figma 플러그인 상태 조회', { connected });
  sendSuccess(res, {
    connected,
    message: connected ? '플러그인이 연결되었습니다' : '플러그인이 연결되지 않았습니다',
  });
});

/**
 * GET /api/figma/frames
 * 설정에 저장된 Figma 파일의 최상위 프레임 목록을 조회한다.
 */
figmaRouter.get('/frames', async (_req, res) => {
  try {
    log.info('Figma 프레임 목록 조회 시작');
    const config = await loadConfig();

    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다. 먼저 설정을 완료해주세요.');
      return;
    }

    const { fileKey, accessToken } = config.figma;
    log.debug('Figma 설정 확인', { 
      fileKey: fileKey ? `${fileKey.substring(0, 10)}...` : 'null',
      hasAccessToken: !!accessToken 
    });

    if (!fileKey || !accessToken) {
      log.warn('Figma fileKey 또는 accessToken 누락');
      sendErrorAuto(res, ErrorCode.CONFIG_INVALID, 'Figma fileKey 또는 accessToken이 설정되지 않았습니다.');
      return;
    }

    log.debug('Figma API 호출 중');
    const { frames } = await getTopLevelFramesDebug(fileKey, accessToken);
    log.info('Figma 프레임 조회 성공', { frameCount: frames.length });
    sendSuccess(res, { frames });
  } catch (error) {
    log.error('Figma 프레임 조회 실패', error);
    sendErrorAuto(res, ErrorCode.FIGMA_CONNECTION_FAILED, 'Figma 프레임 조회 중 오류가 발생했습니다');
  }
});

/**
 * POST /api/figma/validate-template
 * 선택된 프레임의 레이어 이름이 규칙에 맞는지 검증한다.
 * Body: { frameNodeId: string }
 */
figmaRouter.post('/validate-template', async (req, res) => {
  try {
    const { frameNodeId } = req.body as { frameNodeId: string };

    if (!frameNodeId) {
      log.warn('frameNodeId 누락');
      sendErrorAuto(res, ErrorCode.MISSING_FIELDS, 'frameNodeId가 필요합니다.');
      return;
    }

    log.info('Figma 템플릿 검증 요청', { frameNodeId });
    const config = await loadConfig();

    if (!config) {
      log.warn('설정 파일이 존재하지 않음');
      sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일이 존재하지 않습니다. 먼저 설정을 완료해주세요.');
      return;
    }

    const { fileKey, accessToken } = config.figma;

    if (!fileKey || !accessToken) {
      log.warn('Figma fileKey 또는 accessToken 누락');
      sendErrorAuto(res, ErrorCode.CONFIG_INVALID, 'Figma fileKey 또는 accessToken이 설정되지 않았습니다.');
      return;
    }

    const layerNames = await getFrameChildrenNames(fileKey, frameNodeId, accessToken);
    const layerNamesConfig = config.template?.layerNames;
    const validation = validateTemplateLayerNames(layerNames, layerNamesConfig);

    log.info('Figma 템플릿 검증 완료', { 
      valid: validation.valid, 
      missingLayersCount: validation.missingLayers.length 
    });
    sendSuccess(res, {
      valid: validation.valid,
      missingLayers: validation.missingLayers,
      foundLayers: layerNames,
    });
  } catch (error) {
    log.error('Figma 템플릿 검증 실패', error);
    sendErrorAuto(res, ErrorCode.FIGMA_CONNECTION_FAILED, 'Figma 템플릿 검증 중 오류가 발생했습니다');
  }
});
