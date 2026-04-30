import type { CardNewsRow } from '@card-news/shared';

/**
 * 스프레드시트 컬럼 순서 (10열):
 * 영화제목, 배경이미지, 로고, 기본문구, 추가문구, 뱃지1, 뱃지2, 뱃지3, 뱃지4, 카피라이트
 */

/**
 * 셀 배열(string[])을 CardNewsRow로 변환한다.
 * 빈 값은 빈 문자열로 보존하고, 줄바꿈(\n)도 그대로 보존한다.
 */
export function parseRow(cells: string[], rowIndex: number): CardNewsRow {
  return {
    rowIndex,
    movieTitle: cells[0] ?? '',
    backgroundFilenameOverride: cells[1] ?? '',
    logoFilenameOverride: cells[2] ?? '',
    mainText: cells[3] ?? '',
    subText: cells[4] ?? '',
    badge1: cells[5] ?? '',
    badge2: cells[6] ?? '',
    badge3: cells[7] ?? '',
    badge4: cells[8] ?? '',
    copyright: cells[9] ?? '',
  };
}

/**
 * CardNewsRow를 셀 배열(string[])로 변환한다.
 * 컬럼 순서: 영화제목, 배경이미지, 로고, 기본문구, 추가문구, 뱃지1~4, 카피라이트
 */
export function serializeRow(row: CardNewsRow): string[] {
  return [
    row.movieTitle,
    row.backgroundFilenameOverride ?? '',
    row.logoFilenameOverride ?? '',
    row.mainText,
    row.subText,
    row.badge1,
    row.badge2,
    row.badge3,
    row.badge4,
    row.copyright,
  ];
}
