/**
 * API 응답 타입 정의
 */

/**
 * 성공 응답
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * 에러 응답
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * API 응답 타입
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 에러 코드 정의
 */
export enum ErrorCode {
  // 파일 관련
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_DUPLICATE = 'FILE_DUPLICATE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_FILENAME = 'INVALID_FILENAME',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  
  // 업로드 관련
  UPLOAD_LIMIT_EXCEEDED = 'UPLOAD_LIMIT_EXCEEDED',
  NO_FILE_PROVIDED = 'NO_FILE_PROVIDED',
  INVALID_FOLDER = 'INVALID_FOLDER',
  
  // 설정 관련
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  MISSING_FIELDS = 'MISSING_FIELDS',
  
  // API 연결
  SHEETS_CONNECTION_FAILED = 'SHEETS_CONNECTION_FAILED',
  FIGMA_CONNECTION_FAILED = 'FIGMA_CONNECTION_FAILED',
  API_CONNECTION_FAILED = 'API_CONNECTION_FAILED',
  
  // 데이터 검증
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BADGE_INVALID = 'BADGE_INVALID',
  LINE_LIMIT_EXCEEDED = 'LINE_LIMIT_EXCEEDED',
  TEXT_OVERFLOW = 'TEXT_OVERFLOW',
  
  // 일반
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * 에러 메시지 매핑
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // 파일 관련
  [ErrorCode.FILE_NOT_FOUND]: '파일을 찾을 수 없습니다',
  [ErrorCode.FILE_TOO_LARGE]: '파일 크기가 너무 큽니다',
  [ErrorCode.FILE_DUPLICATE]: '중복된 파일입니다',
  [ErrorCode.INVALID_FILE_TYPE]: '지원하지 않는 파일 형식입니다',
  [ErrorCode.INVALID_FILENAME]: '유효하지 않은 파일명입니다',
  [ErrorCode.FILE_ALREADY_EXISTS]: '같은 이름의 파일이 이미 존재합니다',
  
  // 업로드 관련
  [ErrorCode.UPLOAD_LIMIT_EXCEEDED]: '동시 업로드 제한을 초과했습니다',
  [ErrorCode.NO_FILE_PROVIDED]: '파일이 제공되지 않았습니다',
  [ErrorCode.INVALID_FOLDER]: '유효하지 않은 폴더입니다',
  
  // 설정 관련
  [ErrorCode.CONFIG_NOT_FOUND]: '설정을 찾을 수 없습니다',
  [ErrorCode.CONFIG_INVALID]: '유효하지 않은 설정입니다',
  [ErrorCode.MISSING_FIELDS]: '필수 필드가 누락되었습니다',
  
  // API 연결
  [ErrorCode.SHEETS_CONNECTION_FAILED]: 'Google Sheets 연결에 실패했습니다',
  [ErrorCode.FIGMA_CONNECTION_FAILED]: 'Figma API 연결에 실패했습니다',
  [ErrorCode.API_CONNECTION_FAILED]: 'API 연결에 실패했습니다',
  
  // 데이터 검증
  [ErrorCode.VALIDATION_ERROR]: '데이터 검증에 실패했습니다',
  [ErrorCode.BADGE_INVALID]: '유효하지 않은 뱃지입니다',
  [ErrorCode.LINE_LIMIT_EXCEEDED]: '줄 수 제한을 초과했습니다',
  [ErrorCode.TEXT_OVERFLOW]: '텍스트가 영역을 초과합니다',
  
  // 일반
  [ErrorCode.INTERNAL_ERROR]: '서버 내부 오류가 발생했습니다',
  [ErrorCode.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다',
  [ErrorCode.BAD_REQUEST]: '잘못된 요청입니다',
  [ErrorCode.UNAUTHORIZED]: '인증이 필요합니다',
  [ErrorCode.FORBIDDEN]: '접근 권한이 없습니다',
};
