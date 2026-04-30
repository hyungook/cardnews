import type { FileNamingPattern, CardNewsRow } from '@card-news/shared';
import { DEFAULT_FILE_NAMING } from '@card-news/shared';

/**
 * 파일명 패턴에서 {title}을 영화제목으로 치환하여 실제 파일명을 생성한다.
 *
 * @param pattern - 패턴 문자열 (예: '{title}.jpg', 'LI_{title}.png')
 * @param title - 영화/드라마 제목
 * @returns 치환된 파일명
 */
export function resolvePattern(pattern: string, title: string): string {
  return pattern.replace(/\{title\}/g, title);
}

/**
 * CardNewsRow에서 배경 이미지 파일명을 결정한다.
 * 수동 오버라이드가 있으면 그것을 사용하고, 없으면 패턴으로 자동 생성한다.
 */
export function getBackgroundFilename(
  row: CardNewsRow,
  naming: FileNamingPattern = DEFAULT_FILE_NAMING,
): string {
  if (row.backgroundFilenameOverride && row.backgroundFilenameOverride.trim() !== '') {
    return row.backgroundFilenameOverride.trim();
  }
  return resolvePattern(naming.backgroundPattern, row.movieTitle);
}

/**
 * CardNewsRow에서 로고 파일명을 결정한다.
 * 수동 오버라이드가 있으면 그것을 사용하고, 없으면 패턴으로 자동 생성한다.
 */
export function getLogoFilename(
  row: CardNewsRow,
  naming: FileNamingPattern = DEFAULT_FILE_NAMING,
): string {
  if (row.logoFilenameOverride && row.logoFilenameOverride.trim() !== '') {
    return row.logoFilenameOverride.trim();
  }
  return resolvePattern(naming.logoPattern, row.movieTitle);
}
