import { DEFAULT_LAYER_NAMES } from '@card-news/shared';
import type { TemplateLayerNames } from '@card-news/shared';

/** 템플릿 레이어 이름 검증 결과 */
export interface TemplateValidationResult {
  valid: boolean;
  missingLayers: string[];
}

/**
 * Figma 프레임의 레이어 이름 목록이 필수 레이어 이름 규칙을 충족하는지 검증한다.
 *
 * @param layerNames - Figma 프레임에서 발견된 실제 레이어 이름 배열
 * @param requiredNames - 필수 레이어 이름 규칙 (기본값: DEFAULT_LAYER_NAMES)
 * @returns 검증 결과 (valid 여부 및 누락된 레이어 이름 목록)
 */
export function validateTemplateLayerNames(
  layerNames: string[],
  requiredNames: TemplateLayerNames = DEFAULT_LAYER_NAMES,
): TemplateValidationResult {
  const required = Object.values(requiredNames);
  const missingLayers = required.filter((name) => !layerNames.includes(name));

  return {
    valid: missingLayers.length === 0,
    missingLayers,
  };
}
