/**
 * 파일명 생성 및 중복 처리 유틸리티
 * Requirements: 5.6, 5.7
 */

/**
 * 카드뉴스 파일명을 생성한다.
 * - 기본 형식: `카드뉴스_(movieTitle).jpg`
 * - 중복 시: `카드뉴스_(movieTitle)_02.jpg`, `_03.jpg`, ...
 *
 * @param movieTitle 영화/드라마 제목
 * @param existingFiles 기존 파일명 목록
 * @returns 중복되지 않는 파일명
 */
export function generateFilename(movieTitle: string, existingFiles: string[]): string {
  const base = `카드뉴스_(${movieTitle})`;
  const ext = '.jpg';

  const first = `${base}${ext}`;
  if (!existingFiles.includes(first)) {
    return first;
  }

  for (let n = 2; ; n++) {
    const suffix = `_${String(n).padStart(2, '0')}`;
    const candidate = `${base}${suffix}${ext}`;
    if (!existingFiles.includes(candidate)) {
      return candidate;
    }
  }
}
