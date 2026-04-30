import { Router } from 'express';
import { frameRegistry } from '../pipeline/frame-registry.js';
import { loadConfig } from '../config/config-manager.js';
import { getWebSocketBridge } from '../index.js';
import { FigmaOrchestrator } from '../figma/figma-orchestrator.js';
import { sendSuccess, sendError, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const framesRouter = Router();

/**
 * GET /api/frames/batches
 * 정리 가능한 배치 프레임 그룹 목록을 반환한다.
 */
framesRouter.get('/batches', (_req, res) => {
  log.debug('배치 프레임 목록 조회');
  const batches = frameRegistry.getAllBatches();
  const result = batches.map((b) => ({
    batchId: b.batchId,
    frameCount: b.frameIds.length,
    createdAt: b.createdAt,
  }));
  log.info('배치 프레임 목록 조회 성공', { batchCount: result.length });
  sendSuccess(res, { batches: result });
});

/**
 * DELETE /api/frames/:batchId
 * 특정 배치의 복제 프레임을 Figma에서 삭제하고 레지스트리에서 제거한다.
 */
framesRouter.delete('/:batchId', async (req, res) => {
  const { batchId } = req.params;

  log.info('배치 프레임 삭제 요청', { batchId });
  const batch = frameRegistry.getBatch(batchId);
  if (!batch) {
    log.warn('배치를 찾을 수 없음', { batchId });
    sendErrorAuto(res, ErrorCode.NOT_FOUND, `배치를 찾을 수 없습니다: ${batchId}`);
    return;
  }

  if (batch.frameIds.length === 0) {
    frameRegistry.removeBatch(batchId);
    log.info('빈 배치 제거 완료', { batchId });
    sendSuccess(res, { deletedCount: 0 });
    return;
  }

  const config = await loadConfig();
  if (!config) {
    log.warn('설정 파일이 존재하지 않음');
    sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일을 찾을 수 없습니다. 설정 마법사를 완료해주세요.');
    return;
  }

  const bridge = getWebSocketBridge();
  if (!bridge || !bridge.connected) {
    log.warn('Figma 플러그인이 연결되지 않음');
    sendError(res, ErrorCode.FIGMA_CONNECTION_FAILED, 'Figma 플러그인이 연결되어 있지 않습니다.', 503);
    return;
  }

  try {
    const orchestrator = new FigmaOrchestrator(bridge, {
      accessToken: config.figma.accessToken,
      fileKey: config.figma.fileKey,
    });

    await orchestrator.deleteFrames(batch.frameIds);
    const deletedCount = batch.frameIds.length;
    frameRegistry.removeBatch(batchId);

    log.info('배치 프레임 삭제 성공', { batchId, deletedCount });
    sendSuccess(res, { deletedCount });
  } catch (error) {
    log.error('배치 프레임 삭제 실패', error, { batchId });
    sendErrorAuto(res, ErrorCode.FIGMA_CONNECTION_FAILED, '프레임 삭제 중 오류가 발생했습니다');
  }
});
