import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  AppConfig,
  CardNewsRow,
  GenerationProgress,
  RowResult,
  HistoryRecord,
  HistoryFile,
  HistoryError,
} from '@card-news/shared';
import { SpreadsheetReader } from '../google/sheets-reader.js';
import { FigmaOrchestrator } from '../figma/figma-orchestrator.js';
import { ExportManager } from '../export/export-manager.js';
import { determineBadgeVariant } from '../utils/badge.js';
import { validateLineCount } from '../utils/text-validation.js';
import { determineLayerAction } from '../utils/layer-action.js';
import { getBackgroundFilename, getLogoFilename } from '../utils/file-naming.js';
import { loadConfig } from '../config/config-manager.js';
import { WebSocketBridge } from '../websocket/bridge.js';
import { frameRegistry } from './frame-registry.js';
import { readBackground, readLogo, listResultFilenames } from '../local/local-storage.js';

/** Delay between rows (1–2s) to prevent Rate Limit */
const ROW_DELAY_MS = 2000;

/** Exponential backoff base (5s, 10s, 20s, 40s) */
const BACKOFF_BASE_MS = 5000;

/** Max retries for rate-limited requests */
const MAX_RETRIES = 4;

export interface PipelineDeps {
  sheetsReader: SpreadsheetReader;
  orchestrator: FigmaOrchestrator;
  exportManager: ExportManager;
}

/**
 * 카드뉴스 생성 파이프라인.
 * EventEmitter를 통해 진행 상태를 외부에 전달한다.
 */
export class GeneratePipeline extends EventEmitter {
  readonly batchId: string;
  private progress: GenerationProgress;
  private deps: PipelineDeps;
  private config: AppConfig;
  private _cancelled = false;

  constructor(deps: PipelineDeps, config: AppConfig) {
    super();
    this.batchId = randomUUID();
    this.deps = deps;
    this.config = config;
    this.progress = {
      status: 'idle',
      currentRow: 0,
      totalRows: 0,
      currentStep: '',
      results: [],
    };
  }

  getProgress(): GenerationProgress {
    return { ...this.progress };
  }

  /** 생성을 중단한다. 현재 처리 중인 행은 완료 후 중단된다. */
  cancel(): void {
    this._cancelled = true;
  }

  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * 파이프라인을 실행한다.
   * @param rowIndices - 처리할 행 인덱스 배열 (1-based)
   */
  async run(rowIndices: number[]): Promise<GenerationProgress> {
    console.log(`[Pipeline] ===== 배치 시작 =====`);
    console.log(`[Pipeline] Batch ID: ${this.batchId}`);
    console.log(`[Pipeline] 처리할 행: ${rowIndices.join(', ')}`);
    
    this.updateProgress({ status: 'running', totalRows: rowIndices.length, currentStep: '데이터 읽기' });

    const files: HistoryFile[] = [];
    const errors: HistoryError[] = [];
    const clonedFrameIds: string[] = [];

    // Register batch in frame registry for cleanup tracking
    frameRegistry.registerBatch(this.batchId);

    try {
      // 1. Read spreadsheet data
      this.updateProgress({ currentStep: '데이터 읽기' });
      console.log('[Pipeline] 스프레드시트 데이터 읽기 시작...');
      const allRows = await this.deps.sheetsReader.readAllRows();
      console.log(`[Pipeline] 전체 행 수: ${allRows.length}`);

      // Filter to selected rows
      const selectedRows = rowIndices
        .map((idx) => allRows.find((r) => r.rowIndex === idx))
        .filter((r): r is CardNewsRow => r !== undefined);

      console.log(`[Pipeline] 선택된 행 수: ${selectedRows.length}`);

      if (selectedRows.length === 0) {
        console.log('[Pipeline] 선택된 행이 없습니다. 종료.');
        this.updateProgress({ status: 'completed', currentStep: '완료' });
        return this.progress;
      }

      this.updateProgress({ totalRows: selectedRows.length });

      // 2. Cache template spec (once per batch)
      this.updateProgress({ currentStep: '템플릿 캐싱' });
      await this.withRetry(() =>
        this.deps.orchestrator.cacheTemplateSpec(this.config.figma.templateNodeId),
      );

      // 3. Get existing result files for filename dedup
      const existingFiles = await listResultFilenames();

      // 4. Process each row
      for (let i = 0; i < selectedRows.length; i++) {
        // Check for cancellation before processing next row
        if (this._cancelled) {
          this.updateProgress({ status: 'completed', currentStep: `중단됨 (${i}/${selectedRows.length}장 처리 완료)` });
          break;
        }

        const row = selectedRows[i];
        this.updateProgress({ currentRow: i + 1 });

        try {
          const result = await this.processRow(row, existingFiles, clonedFrameIds);
          if (result.file) files.push(result.file);
          if (result.sizeWarning) {
            this.progress.results.push({
              rowIndex: row.rowIndex,
              movieTitle: row.movieTitle,
              status: 'warning',
              sizeWarning: true,
            });
          } else {
            this.progress.results.push({
              rowIndex: row.rowIndex,
              movieTitle: row.movieTitle,
              status: 'success',
            });
          }
        } catch (err) {
          const errorInfo = classifyError(err, row);
          errors.push(errorInfo);
          this.progress.results.push({
            rowIndex: row.rowIndex,
            movieTitle: row.movieTitle,
            status: 'error',
            error: errorInfo.message,
          });
        }

        this.emitProgress();

        // Delay between rows (skip after last row)
        if (i < selectedRows.length - 1) {
          await delay(ROW_DELAY_MS);
        }
      }

      // 5. Record history
      this.updateProgress({ currentStep: '히스토리 기록' });
      const historyRecord: HistoryRecord = {
        id: this.batchId,
        createdAt: new Date().toISOString(),
        totalCount: selectedRows.length,
        successCount: files.length,
        errorCount: errors.length,
        files,
        errors,
      };

      try {
        await this.deps.sheetsReader.appendHistory(historyRecord);
      } catch {
        // History recording failure should not fail the batch
      }

      this.updateProgress({ status: 'completed', currentStep: '완료' });
    } catch (err) {
      console.error('[Pipeline] 치명적 오류 발생:', err);
      this.updateProgress({
        status: 'error',
        currentStep: `오류: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    this.emitProgress();
    return this.progress;
  }

  private async processRow(
    row: CardNewsRow,
    existingFiles: string[],
    clonedFrameIds: string[],
  ): Promise<{ file?: HistoryFile; sizeWarning?: boolean }> {
    // a. Validate badges
    this.updateProgress({ currentStep: '데이터 검증' });
    const badgeResult = determineBadgeVariant([row.badge1, row.badge2, row.badge3, row.badge4]);
    if (badgeResult.invalidBadges.length > 0) {
      throw new PipelineError(
        'BADGE_INVALID',
        `뱃지 '${badgeResult.invalidBadges.join(', ')}'는 유효하지 않습니다`,
      );
    }

    // b. Validate line count
    const lineResult = validateLineCount(row.mainText);
    if (!lineResult.valid) {
      throw new PipelineError(
        'LINE_LIMIT',
        `기본문구는 최대 3줄까지 가능합니다 (현재 ${lineResult.lineCount}줄)`,
      );
    }

    // c. Download background image
    this.updateProgress({ currentStep: '이미지 로드' });
    const bgFilename = getBackgroundFilename(row, this.config.fileNaming);
    console.log(`[Pipeline] 행 ${row.rowIndex} - 배경 이미지 검색: "${bgFilename}"`);
    let bgImage: Buffer;
    try {
      bgImage = await this.withRetry(() => readBackground(bgFilename));
      console.log(`[Pipeline] 행 ${row.rowIndex} - 배경 이미지 로드 성공`);
    } catch (err) {
      console.error(`[Pipeline] 행 ${row.rowIndex} - 배경 이미지 로드 실패:`, err);
      throw new PipelineError('FILE_NOT_FOUND', `배경 이미지 '${bgFilename}'를 찾을 수 없습니다`);
    }

    // d. Download logo
    const logoFilename = getLogoFilename(row, this.config.fileNaming);
    console.log(`[Pipeline] 행 ${row.rowIndex} - 로고 검색: "${logoFilename}"`);
    let logoImage: Buffer;
    try {
      logoImage = await this.withRetry(() => readLogo(logoFilename));
      console.log(`[Pipeline] 행 ${row.rowIndex} - 로고 로드 성공`);
    } catch (err) {
      console.error(`[Pipeline] 행 ${row.rowIndex} - 로고 로드 실패:`, err);
      throw new PipelineError('FILE_NOT_FOUND', `로고 '${logoFilename}'를 찾을 수 없습니다`);
    }

    // e. Clone template frame
    this.updateProgress({ currentStep: 'Figma 수정' });
    const frameId = await this.withRetry(() =>
      this.deps.orchestrator.cloneFrame(this.config.figma.templateNodeId),
    );
    clonedFrameIds.push(frameId);

    // Register cloned frame in the frame registry
    frameRegistry.addFrame(this.batchId, frameId);

    // f. Replace background image
    await this.withRetry(() =>
      this.deps.orchestrator.replaceImage(frameId, 'bg_image', bgImage),
    );

    // g. Replace logo
    await this.withRetry(() =>
      this.deps.orchestrator.replaceImage(frameId, 'logo', logoImage),
    );

    // h. Set main text
    await this.withRetry(() =>
      this.deps.orchestrator.setTextLayer(frameId, 'main_text', row.mainText),
    );

    // i. Handle sub text
    const subAction = determineLayerAction(row.subText);
    if (subAction.action === 'setText') {
      await this.withRetry(() =>
        this.deps.orchestrator.setTextLayer(frameId, 'sub_text', subAction.text),
      );
    } else {
      await this.withRetry(() =>
        this.deps.orchestrator.hideLayer(frameId, 'sub_text'),
      );
    }

    // j. Handle copyright
    const copyrightAction = determineLayerAction(row.copyright);
    if (copyrightAction.action === 'setText') {
      await this.withRetry(() =>
        this.deps.orchestrator.setTextLayer(frameId, 'copyright', copyrightAction.text),
      );
    } else {
      await this.withRetry(() =>
        this.deps.orchestrator.hideLayer(frameId, 'copyright'),
      );
    }

    // k. Switch badge variant (or hide)
    if (badgeResult.count > 0) {
      await this.withRetry(() =>
        this.deps.orchestrator.switchBadgeVariant(frameId, badgeResult.count, badgeResult.badges),
      );
    } else {
      await this.withRetry(() =>
        this.deps.orchestrator.hideLayer(frameId, 'badge_container'),
      );
    }

    // l. Check text overflow
    const overflow = await this.withRetry(() =>
      this.deps.orchestrator.checkOverflow(frameId, 'main_text'),
    );
    if (overflow.isOverflowing) {
      const details = [];
      if (overflow.overflowX > 0) {
        details.push(`가로 ${Math.round(overflow.overflowX)}px 초과`);
      }
      if (overflow.overflowY > 0) {
        details.push(`세로 ${Math.round(overflow.overflowY)}px 초과`);
      }
      const detailMsg = details.length > 0 ? ` (${details.join(', ')})` : '';
      throw new PipelineError('TEXT_OVERFLOW', `기본 문구 텍스트가 오버플로우 되었습니다${detailMsg}. 텍스트를 줄여주세요`);
    }

    // m. Export image with quality adjustment
    this.updateProgress({ currentStep: '렌더링' });
    const exportResult = await this.withRetry(() =>
      this.deps.exportManager.exportWithQualityAdjustment(frameId, row.movieTitle, existingFiles),
    );

    // Track the new filename for subsequent dedup
    existingFiles.push(exportResult.filename);

    this.updateProgress({ currentStep: '업로드' });

    return {
      file: {
        filename: exportResult.filename,
        movieTitle: row.movieTitle,
        rowIndex: row.rowIndex,
      },
      sizeWarning: exportResult.sizeWarning,
    };
  }

  /**
   * Retry with exponential backoff for rate-limited requests.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (isRateLimitError(err) && attempt < MAX_RETRIES) {
          const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
          this.updateProgress({
            rateLimit: { waiting: true, retryAfter: waitMs / 1000 },
          });
          this.emitProgress();
          await delay(waitMs);
          this.updateProgress({ rateLimit: undefined });
          continue;
        }
        throw err;
      }
    }
    // Should not reach here
    throw new Error('Max retries exceeded');
  }

  private updateProgress(partial: Partial<GenerationProgress>): void {
    Object.assign(this.progress, partial);
  }

  private emitProgress(): void {
    this.emit('progress', this.getProgress());
  }
}

export class PipelineError extends Error {
  constructor(
    public readonly errorType: HistoryError['errorType'],
    message: string,
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

function classifyError(err: unknown, row: CardNewsRow): HistoryError {
  if (err instanceof PipelineError) {
    return {
      rowIndex: row.rowIndex,
      movieTitle: row.movieTitle,
      errorType: err.errorType,
      message: err.message,
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('Rate') || message.includes('429')) {
    return { rowIndex: row.rowIndex, movieTitle: row.movieTitle, errorType: 'API_ERROR', message };
  }
  if (message.includes('렌더링') || message.includes('이미지')) {
    return { rowIndex: row.rowIndex, movieTitle: row.movieTitle, errorType: 'RENDER_ERROR', message };
  }

  return { rowIndex: row.rowIndex, movieTitle: row.movieTitle, errorType: 'API_ERROR', message };
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') || err.message.includes('Rate Limit') || err.message.includes('rate limit');
  }
  return false;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create pipeline dependencies from config and WebSocket bridge.
 */
export function createPipelineDeps(config: AppConfig, bridge: WebSocketBridge): PipelineDeps {
  const sheetsReader = new SpreadsheetReader(config);
  const orchestrator = new FigmaOrchestrator(bridge, {
    accessToken: config.figma.accessToken,
    fileKey: config.figma.fileKey,
  });
  const exportManager = new ExportManager(orchestrator);

  return { sheetsReader, orchestrator, exportManager };
}
