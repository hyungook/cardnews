import { readFile, writeFile } from 'fs/promises';
import type { AppConfig } from '@card-news/shared';

const DEFAULT_CONFIG_PATH = './config.json';

export interface ValidationResult {
  valid: boolean;
  missingFields: string[];
}

/**
 * AppConfig 객체를 JSON 파일로 저장한다.
 */
export async function saveConfig(
  config: AppConfig,
  filePath: string = DEFAULT_CONFIG_PATH,
): Promise<void> {
  await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * JSON 파일에서 AppConfig 객체를 로드한다.
 * 파일이 존재하지 않으면 null을 반환한다.
 */
export async function loadConfig(
  filePath: string = DEFAULT_CONFIG_PATH,
): Promise<AppConfig | null> {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data) as AppConfig;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * AppConfig 객체의 필수 필드가 존재하고 비어있지 않은지 검증한다.
 */
export function validateConfig(config: AppConfig): ValidationResult {
  const missingFields: string[] = [];

  // google.serviceAccountKey: must be an object with at least one key
  if (
    !config.google?.serviceAccountKey ||
    typeof config.google.serviceAccountKey !== 'object' ||
    Array.isArray(config.google.serviceAccountKey) ||
    Object.keys(config.google.serviceAccountKey).length === 0
  ) {
    missingFields.push('google.serviceAccountKey');
  }

  // google.spreadsheetId: non-empty string
  if (!config.google?.spreadsheetId || typeof config.google.spreadsheetId !== 'string' || config.google.spreadsheetId.trim() === '') {
    missingFields.push('google.spreadsheetId');
  }

  // figma.accessToken: non-empty string
  if (!config.figma?.accessToken || typeof config.figma.accessToken !== 'string' || config.figma.accessToken.trim() === '') {
    missingFields.push('figma.accessToken');
  }

  // figma.fileKey: non-empty string
  if (!config.figma?.fileKey || typeof config.figma.fileKey !== 'string' || config.figma.fileKey.trim() === '') {
    missingFields.push('figma.fileKey');
  }

  // figma.templateNodeId: non-empty string
  if (!config.figma?.templateNodeId || typeof config.figma.templateNodeId !== 'string' || config.figma.templateNodeId.trim() === '') {
    missingFields.push('figma.templateNodeId');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
