import type { CardNewsRow } from '@card-news/shared';

/** 레이어에 대해 수행할 액션 */
export type LayerAction =
  | { action: 'hide' }
  | { action: 'setText'; text: string };

/**
 * 필드 값에 따라 레이어 액션을 결정한다.
 * - 빈 문자열이면 해당 레이어를 숨김(hide) 처리한다.
 * - 비어있지 않으면 텍스트 설정(setText) 명령을 반환한다.
 *
 * @param value - 필드 값 (subText 또는 copyright)
 * @returns LayerAction
 */
export function determineLayerAction(value: string): LayerAction {
  if (value === '') {
    return { action: 'hide' };
  }
  return { action: 'setText', text: value };
}

/** 선택적 필드들에 대한 레이어 액션 맵 */
export interface OptionalFieldActions {
  subText: LayerAction;
  copyright: LayerAction;
}

/**
 * CardNewsRow의 선택적 필드(subText, copyright)에 대해
 * 각각의 레이어 액션을 결정하여 반환한다.
 *
 * @param row - 스프레드시트 행 데이터
 * @returns OptionalFieldActions
 */
export function determineOptionalFieldActions(row: CardNewsRow): OptionalFieldActions {
  return {
    subText: determineLayerAction(row.subText),
    copyright: determineLayerAction(row.copyright),
  };
}
