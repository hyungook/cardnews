import { VALID_BADGES } from '@card-news/shared';
import type { ValidBadgeName, BadgeInfo } from '@card-news/shared';

/**
 * 뱃지 이름을 정규화한다.
 * 앞뒤 공백을 제거하고, 대소문자를 무시하여 20종 유효 뱃지 목록과 매칭한다.
 * 매칭되면 정식(canonical) 뱃지 이름을 반환하고, 매칭되지 않으면 null을 반환한다.
 *
 * @param input - 사용자 입력 뱃지 이름
 * @returns 정규화된 ValidBadgeName 또는 null
 */
export function normalizeBadgeName(input: string): ValidBadgeName | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const lowerInput = trimmed.toLowerCase();

  for (const badge of VALID_BADGES) {
    if (badge.toLowerCase() === lowerInput) {
      return badge;
    }
  }

  return null;
}

/** determineBadgeVariant의 반환 타입 */
export interface BadgeVariantResult {
  count: number;
  badges: BadgeInfo[];
  invalidBadges: string[];
}

/**
 * 뱃지 문자열 배열(스프레드시트의 badge1~badge4)을 분석하여
 * 유효 뱃지 개수, 뱃지 정보 배열, 무효 뱃지 목록을 반환한다.
 *
 * - 빈 문자열은 무시한다.
 * - 각 뱃지 이름을 normalizeBadgeName으로 정규화한다.
 * - count=0이면 뱃지 레이어를 숨김 처리해야 한다.
 * - count=1~4이면 해당 개수의 뱃지 Variant를 선택한다.
 *
 * @param badgeStrings - 스프레드시트의 뱃지 컬럼 값 배열 (최대 4개)
 * @returns BadgeVariantResult
 */
export function determineBadgeVariant(badgeStrings: string[]): BadgeVariantResult {
  const badges: BadgeInfo[] = [];
  const invalidBadges: string[] = [];

  for (const raw of badgeStrings) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;

    const normalized = normalizeBadgeName(trimmed);
    if (normalized !== null) {
      badges.push({
        name: normalized,
        position: badges.length + 1,
      });
    } else {
      invalidBadges.push(trimmed);
    }
  }

  return {
    count: badges.length,
    badges,
    invalidBadges,
  };
}
