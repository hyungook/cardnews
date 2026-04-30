import sharp from 'sharp';
import type { FigmaOrchestrator } from '../figma/figma-orchestrator.js';
import type { ExportResult } from '@card-news/shared';
import { generateFilename } from '../utils/filename.js';
import { saveResult, listResultFilenames } from '../local/local-storage.js';

/** 최대 허용 파일 크기 (500KB) */
const MAX_FILE_SIZE = 512_000;

/** 품질 단계: 80 → 75 → 70 */
const QUALITY_STEPS = [80, 75, 70] as const;

/**
 * 내보내기 관리자
 *
 * Figma에서 PNG로 내보낸 이미지를 sharp로 JPG 변환하며,
 * 500KB 이하가 될 때까지 품질을 점진적으로 낮춘다.
 * 최종 결과를 로컬 파일 시스템의 결과물 폴더에 저장한다.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8
 */
export class ExportManager {
  constructor(
    private orchestrator: FigmaOrchestrator,
  ) {}

  /**
   * 이미지를 내보내고 품질을 자동 조정하여 로컬 파일 시스템에 저장한다.
   *
   * 1. Figma REST API로 PNG 내보내기
   * 2. sharp로 JPG 변환 (80% → 75% → 70%)
   * 3. 500KB 이하가 되면 해당 품질 사용
   * 4. 70%에서도 초과 시 sizeWarning=true
   * 5. generateFilename()으로 파일명 생성 (중복 처리)
   * 6. 로컬 파일 시스템 결과물 폴더에 저장
   */
  async exportWithQualityAdjustment(
    nodeId: string,
    movieTitle: string,
    existingFiles: string[],
  ): Promise<ExportResult> {
    // 1. Figma에서 PNG로 내보내기 (lossless)
    const pngBuffer = await this.orchestrator.exportImage(nodeId, 1, 'png');

    // 2. 품질 단계별 JPG 변환 시도
    let jpgBuffer: Buffer = Buffer.alloc(0);
    let finalQuality: typeof QUALITY_STEPS[number] = QUALITY_STEPS[0];
    let sizeWarning = false;

    for (const quality of QUALITY_STEPS) {
      jpgBuffer = await convertToJpg(pngBuffer, quality);
      finalQuality = quality;

      if (jpgBuffer.length <= MAX_FILE_SIZE) {
        break;
      }
    }

    // 70%에서도 500KB 초과 시 경고 플래그
    if (jpgBuffer.length > MAX_FILE_SIZE) {
      sizeWarning = true;
    }

    // 3. 파일명 생성 (중복 처리)
    const filename = generateFilename(movieTitle, existingFiles);

    // 4. 로컬 파일 시스템에 저장 (날짜별 폴더)
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await saveResult(filename, jpgBuffer, today);

    return {
      success: true,
      filename,
      quality: finalQuality,
      fileSize: jpgBuffer.length,
      sizeWarning,
    };
  }
}

/**
 * PNG Buffer를 지정된 품질의 JPG Buffer로 변환한다.
 */
export async function convertToJpg(pngBuffer: Buffer, quality: number): Promise<Buffer> {
  return sharp(pngBuffer).jpeg({ quality }).toBuffer();
}
