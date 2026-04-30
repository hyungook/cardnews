import { google, type sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { AppConfig, CardNewsRow, HistoryRecord } from '@card-news/shared';
import { parseRow } from '../utils/spreadsheet-row.js';

/**
 * Google Sheets API v4를 사용하여 스프레드시트 데이터를 읽고 쓰는 모듈.
 * Service Account 인증 방식을 사용한다.
 */
export class SpreadsheetReader {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(config: AppConfig) {
    const auth = new GoogleAuth({
      credentials: config.google.serviceAccountKey as object,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = config.google.spreadsheetId;
  }

  /**
   * 첫 번째 시트의 모든 행 데이터를 읽어 CardNewsRow[]로 반환한다.
   * 헤더 행(1행)을 건너뛰고 2행부터 데이터를 파싱한다.
   */
  async readAllRows(): Promise<CardNewsRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'A2:J',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((cells, index) =>
      parseRow(cells.map(String), index + 2),
    );
  }

  /**
   * 특정 셀의 값을 업데이트한다.
   * @param row - 행 번호 (1-based)
   * @param col - 열 번호 (0-based, 0=A, 1=B, ...)
   * @param value - 새 값
   */
  async updateCell(row: number, col: number, value: string): Promise<void> {
    const colLetter = String.fromCharCode('A'.charCodeAt(0) + col);
    const range = `${colLetter}${row}`;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[value]],
      },
    });
  }

  /**
   * 히스토리_탭("히스토리" 시트)에 생성 이력을 추가한다.
   */
  async appendHistory(record: HistoryRecord): Promise<void> {
    const filesJson = JSON.stringify(record.files);
    const errorsJson = JSON.stringify(record.errors);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: '히스토리!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          record.id,
          record.createdAt,
          record.totalCount,
          record.successCount,
          record.errorCount,
          filesJson,
          errorsJson,
        ]],
      },
    });
  }

  /**
   * 히스토리_탭("히스토리" 시트)의 모든 기록을 읽어 HistoryRecord[]로 반환한다.
   */
  async readHistory(): Promise<HistoryRecord[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: '히스토리!A:G',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((cells) => ({
      id: cells[0] ?? '',
      createdAt: cells[1] ?? '',
      totalCount: Number(cells[2]) || 0,
      successCount: Number(cells[3]) || 0,
      errorCount: Number(cells[4]) || 0,
      files: safeJsonParse(cells[5], []),
      errors: safeJsonParse(cells[6], []),
    }));
  }
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
