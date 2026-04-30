import type { BoundingBox, OverflowResult } from '@card-news/shared';

/**
 * 텍스트 바운딩박스가 부모 프레임 바운딩박스를 초과하는지 감지한다.
 *
 * x축과 y축 양방향으로 검사한다:
 * - 텍스트가 부모 영역의 왼쪽/위쪽으로 벗어나는 경우
 * - 텍스트가 부모 영역의 오른쪽/아래쪽으로 벗어나는 경우
 *
 * @param textBounds - 텍스트 노드의 바운딩박스
 * @param parentBounds - 부모 프레임의 바운딩박스
 * @returns OverflowResult
 */
export function detectOverflow(
  textBounds: BoundingBox,
  parentBounds: BoundingBox,
): OverflowResult {
  const overflowRight = Math.max(
    0,
    textBounds.x + textBounds.width - (parentBounds.x + parentBounds.width),
  );
  const overflowLeft = Math.max(0, parentBounds.x - textBounds.x);

  const overflowBottom = Math.max(
    0,
    textBounds.y + textBounds.height - (parentBounds.y + parentBounds.height),
  );
  const overflowTop = Math.max(0, parentBounds.y - textBounds.y);

  const overflowX = overflowRight + overflowLeft;
  const overflowY = overflowBottom + overflowTop;

  return {
    isOverflowing: overflowX > 0 || overflowY > 0,
    textBounds,
    parentBounds,
    overflowX,
    overflowY,
  };
}

/** validateLineCount의 반환 타입 */
export interface LineCountResult {
  valid: boolean;
  lineCount: number;
}

/**
 * 문자열의 줄 수를 검증한다.
 * 줄바꿈 문자(\n)를 기준으로 줄 수를 계산하여 3줄 이하이면 유효로 판정한다.
 *
 * @param text - 검증할 문자열
 * @returns LineCountResult
 */
export function validateLineCount(text: string): LineCountResult {
  const lineCount = text.split('\n').length;
  return {
    valid: lineCount <= 3,
    lineCount,
  };
}
