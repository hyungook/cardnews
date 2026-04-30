/**
 * URL에서 ID 추출 유틸리티
 * Requirements: 14.7, 14.8, 14.10
 */

/**
 * 구글 스프레드시트 URL에서 스프레드시트 ID를 추출한다.
 * 형식: https://docs.google.com/spreadsheets/d/{ID}/edit...
 *
 * @param url 구글 스프레드시트 URL
 * @returns 스프레드시트 ID 또는 null
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * 구글 드라이브 폴더 URL에서 폴더 ID를 추출한다.
 * 형식: https://drive.google.com/drive/folders/{ID}?...
 *
 * @param url 구글 드라이브 폴더 URL
 * @returns 폴더 ID 또는 null
 */
export function extractFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Figma 파일 URL에서 File Key를 추출한다.
 * 형식: https://www.figma.com/file/{fileKey}/... 또는
 *       https://www.figma.com/design/{fileKey}/...
 *
 * @param url Figma 파일 URL
 * @returns File Key 또는 null
 */
export function extractFigmaFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
