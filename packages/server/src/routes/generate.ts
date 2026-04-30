import { Router } from 'express';
import type { GenerationProgress, CardNewsRow } from '@card-news/shared';
import { loadConfig } from '../config/config-manager.js';
import { getWebSocketBridge } from '../index.js';
import { GeneratePipeline, createPipelineDeps } from '../pipeline/generate-pipeline.js';
import { SpreadsheetReader } from '../google/sheets-reader.js';
import { FigmaOrchestrator } from '../figma/figma-orchestrator.js';
import { determineBadgeVariant } from '../utils/badge.js';
import { validateLineCount } from '../utils/text-validation.js';
import { determineLayerAction } from '../utils/layer-action.js';
import { getBackgroundFilename, getLogoFilename } from '../utils/file-naming.js';
import { sendSuccess, sendErrorAuto, HttpStatus } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';

export const generateRouter = Router();

/** In-memory store for active/completed pipeline progress keyed by batchId */
const pipelineStore = new Map<string, GeneratePipeline>();

/**
 * POST /api/generate
 * Accept { rowIndices: number[] }, start pipeline in background,
 * return { success: true, batchId } immediately.
 */
generateRouter.post('/', async (req, res) => {
  log.info('카드뉴스 생성 요청');
  const { rowIndices } = req.body as { rowIndices?: number[] };
  log.debug('생성 요청 행 인덱스', { rowIndices });

  if (!Array.isArray(rowIndices) || rowIndices.length === 0) {
    log.warn('rowIndices가 비어있거나 배열이 아님');
    sendErrorAuto(res, ErrorCode.BAD_REQUEST, 'rowIndices는 비어있지 않은 배열이어야 합니다');
    return;
  }

  if (rowIndices.some((i) => typeof i !== 'number' || i < 1)) {
    log.warn('rowIndices에 유효하지 않은 값 포함', { rowIndices });
    sendErrorAuto(res, ErrorCode.BAD_REQUEST, 'rowIndices는 1 이상의 정수 배열이어야 합니다');
    return;
  }

  log.debug('설정 파일 로드 중');
  const config = await loadConfig();
  if (!config) {
    log.warn('설정 파일이 존재하지 않음');
    sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일을 찾을 수 없습니다. 설정 마법사를 완료해주세요.');
    return;
  }

  log.debug('WebSocket 브릿지 확인 중');
  const bridge = getWebSocketBridge();
  if (!bridge || !bridge.connected) {
    log.warn('Figma 플러그인이 연결되지 않음');
    sendErrorAuto(res, ErrorCode.FIGMA_CONNECTION_FAILED, 'Figma 플러그인이 연결되어 있지 않습니다.', 503);
    return;
  }

  log.debug('파이프라인 생성 중');
  const deps = createPipelineDeps(config, bridge);
  const pipeline = new GeneratePipeline(deps, config);
  pipelineStore.set(pipeline.batchId, pipeline);

  log.info('파이프라인 시작', { batchId: pipeline.batchId, rowCount: rowIndices.length });
  // Start pipeline in background (fire-and-forget)
  pipeline.run(rowIndices).finally(() => {
    log.info('파이프라인 완료', { batchId: pipeline.batchId });
    // Keep in store for SSE clients to read final state;
    // clean up after 10 minutes
    setTimeout(() => pipelineStore.delete(pipeline.batchId), 10 * 60 * 1000);
  });

  sendSuccess(res, { batchId: pipeline.batchId }, HttpStatus.CREATED);
});

/**
 * GET /api/generate/progress
 * SSE endpoint streaming GenerationProgress updates.
 * Query param: ?batchId=xxx
 */
generateRouter.get('/progress', (req, res) => {
  const batchId = req.query.batchId as string | undefined;

  if (!batchId) {
    log.warn('batchId 쿼리 파라미터 누락');
    sendErrorAuto(res, ErrorCode.BAD_REQUEST, 'batchId 쿼리 파라미터가 필요합니다');
    return;
  }

  const pipeline = pipelineStore.get(batchId);
  if (!pipeline) {
    log.warn('배치를 찾을 수 없음', { batchId });
    sendErrorAuto(res, ErrorCode.NOT_FOUND, '해당 배치를 찾을 수 없습니다');
    return;
  }

  log.info('SSE 연결 시작', { batchId });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  const sendProgress = (progress: GenerationProgress) => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  };

  sendProgress(pipeline.getProgress());

  // Listen for updates
  const onProgress = (progress: GenerationProgress) => {
    sendProgress(progress);
    if (progress.status === 'completed' || progress.status === 'error') {
      cleanup();
    }
  };

  pipeline.on('progress', onProgress);

  const cleanup = () => {
    pipeline.off('progress', onProgress);
    log.info('SSE 연결 종료', { batchId });
    res.end();
  };

  req.on('close', cleanup);
});

/**
 * POST /api/preview/:rowIndex
 * Preview a specific row: clone template → modify layers → export at 0.5x → return base64 image.
 */
generateRouter.post('/preview/:rowIndex', async (req, res) => {
  const rowIndex = parseInt(req.params.rowIndex, 10);

  if (isNaN(rowIndex) || rowIndex < 1) {
    log.warn('유효하지 않은 rowIndex', { rowIndex: req.params.rowIndex });
    sendErrorAuto(res, ErrorCode.BAD_REQUEST, 'rowIndex는 1 이상의 정수여야 합니다');
    return;
  }

  log.info('미리보기 요청', { rowIndex });

  const config = await loadConfig();
  if (!config) {
    log.warn('설정 파일이 존재하지 않음');
    sendErrorAuto(res, ErrorCode.CONFIG_NOT_FOUND, '설정 파일을 찾을 수 없습니다. 설정 마법사를 완료해주세요.');
    return;
  }

  const bridge = getWebSocketBridge();
  if (!bridge || !bridge.connected) {
    log.warn('Figma 플러그인이 연결되지 않음');
    sendErrorAuto(res, ErrorCode.FIGMA_CONNECTION_FAILED, 'Figma 플러그인이 연결되어 있지 않습니다.', 503);
    return;
  }

  let frameId: string | null = null;
  const orchestrator = new FigmaOrchestrator(bridge, {
    accessToken: config.figma.accessToken,
    fileKey: config.figma.fileKey,
  });

  try {
    // 1. Read spreadsheet data and find the target row
    const sheetsReader = new SpreadsheetReader(config);
    const allRows = await sheetsReader.readAllRows();
    const row = allRows.find((r) => r.rowIndex === rowIndex);

    if (!row) {
      log.warn('행을 찾을 수 없음', { rowIndex });
      sendErrorAuto(res, ErrorCode.NOT_FOUND, `${rowIndex}행을 찾을 수 없습니다`);
      return;
    }

    // 2. Validate badges
    const badgeResult = determineBadgeVariant([row.badge1, row.badge2, row.badge3, row.badge4]);
    if (badgeResult.invalidBadges.length > 0) {
      log.warn('유효하지 않은 뱃지', { invalidBadges: badgeResult.invalidBadges });
      sendErrorAuto(res, ErrorCode.BADGE_INVALID, `뱃지 '${badgeResult.invalidBadges.join(', ')}'는 유효하지 않습니다`);
      return;
    }

    // 3. Validate line count
    const lineResult = validateLineCount(row.mainText);
    if (!lineResult.valid) {
      log.warn('줄 수 초과', { lineCount: lineResult.lineCount });
      sendErrorAuto(res, ErrorCode.LINE_LIMIT_EXCEEDED, `기본문구는 최대 3줄까지 가능합니다 (현재 ${lineResult.lineCount}줄)`);
      return;
    }

    // 4. Load images from local storage
    const { readBackground, readLogo } = await import('../local/local-storage.js');
    const bgFilename = getBackgroundFilename(row, config.fileNaming);
    const logoFilename = getLogoFilename(row, config.fileNaming);
    const [bgImage, logoImage] = await Promise.all([
      readBackground(bgFilename),
      readLogo(logoFilename),
    ]);

    // 5. Cache template spec & clone frame
    await orchestrator.cacheTemplateSpec(config.figma.templateNodeId);
    frameId = await orchestrator.cloneFrame(config.figma.templateNodeId);

    // 6. Apply layer modifications
    await orchestrator.replaceImage(frameId, 'bg_image', bgImage);
    await orchestrator.replaceImage(frameId, 'logo', logoImage);
    await orchestrator.setTextLayer(frameId, 'main_text', row.mainText);

    const subAction = determineLayerAction(row.subText);
    if (subAction.action === 'setText') {
      await orchestrator.setTextLayer(frameId, 'sub_text', subAction.text);
    } else {
      await orchestrator.hideLayer(frameId, 'sub_text');
    }

    const copyrightAction = determineLayerAction(row.copyright);
    if (copyrightAction.action === 'setText') {
      await orchestrator.setTextLayer(frameId, 'copyright', copyrightAction.text);
    } else {
      await orchestrator.hideLayer(frameId, 'copyright');
    }

    if (badgeResult.count > 0) {
      await orchestrator.switchBadgeVariant(frameId, badgeResult.count, badgeResult.badges);
    } else {
      await orchestrator.hideLayer(frameId, 'badge_container');
    }

    // 7. Export at 0.5x scale
    const imageBuffer = await orchestrator.exportImage(frameId, 0.5, 'jpg');
    const base64 = imageBuffer.toString('base64');

    log.info('미리보기 생성 성공', { rowIndex });
    sendSuccess(res, {
      image: `data:image/jpeg;base64,${base64}`,
    });
  } catch (err) {
    log.error('미리보기 생성 실패', err, { rowIndex });
    const message = err instanceof Error ? err.message : String(err);
    sendErrorAuto(res, ErrorCode.INTERNAL_ERROR, message);
  } finally {
    // 8. Clean up: delete the cloned frame
    if (frameId) {
      try {
        await orchestrator.deleteFrames([frameId]);
      } catch {
        // Cleanup failure should not affect the response
      }
    }
  }
});

/** Expose store for testing */
export function getPipelineStore(): Map<string, GeneratePipeline> {
  return pipelineStore;
}

/**
 * POST /api/generate/cancel
 * 진행 중인 배치 생성을 중단한다.
 * Body: { batchId: string }
 */
generateRouter.post('/cancel', (req, res) => {
  const { batchId } = req.body as { batchId?: string };

  if (!batchId) {
    log.warn('batchId 누락');
    sendErrorAuto(res, ErrorCode.BAD_REQUEST, 'batchId가 필요합니다');
    return;
  }

  const pipeline = pipelineStore.get(batchId);
  if (!pipeline) {
    log.warn('배치를 찾을 수 없음', { batchId });
    sendErrorAuto(res, ErrorCode.NOT_FOUND, '해당 배치를 찾을 수 없습니다');
    return;
  }

  log.info('생성 중단 요청', { batchId });
  pipeline.cancel();
  sendSuccess(res, { message: '생성 중단을 요청했습니다. 현재 처리 중인 행 완료 후 중단됩니다.' });
});
