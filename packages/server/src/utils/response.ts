import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, ErrorCode, ErrorMessages } from '@card-news/shared';
import { log } from './logger.js';
import { isDevelopment } from '../config/env.js';

/**
 * 성공 응답 전송
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * 에러 응답 전송
 */
export function sendError(
  res: Response,
  code: ErrorCode,
  message?: string,
  statusCode = 500,
  details?: unknown
): void {
  const errorMessage = message || ErrorMessages[code] || '알 수 없는 오류가 발생했습니다';
  
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: errorMessage,
      // 개발 환경에서만 상세 정보 포함
      ...(isDevelopment && details ? { details } : {}),
    },
  };
  
  // 에러 로깅
  log.error('API Error', undefined, {
    code,
    message: errorMessage,
    statusCode,
    ...(details ? { details } : {}),
  });
  
  res.status(statusCode).json(response);
}

/**
 * HTTP 상태 코드 매핑
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * 에러 코드별 HTTP 상태 코드 매핑
 */
export function getHttpStatusForError(code: ErrorCode): number {
  switch (code) {
    // 400 Bad Request
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.INVALID_FILE_TYPE:
    case ErrorCode.INVALID_FILENAME:
    case ErrorCode.INVALID_FOLDER:
    case ErrorCode.NO_FILE_PROVIDED:
    case ErrorCode.MISSING_FIELDS:
    case ErrorCode.CONFIG_INVALID:
    case ErrorCode.BADGE_INVALID:
    case ErrorCode.LINE_LIMIT_EXCEEDED:
    case ErrorCode.TEXT_OVERFLOW:
      return HttpStatus.BAD_REQUEST;
    
    // 404 Not Found
    case ErrorCode.FILE_NOT_FOUND:
    case ErrorCode.NOT_FOUND:
    case ErrorCode.CONFIG_NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    
    // 409 Conflict
    case ErrorCode.FILE_DUPLICATE:
    case ErrorCode.FILE_ALREADY_EXISTS:
      return HttpStatus.CONFLICT;
    
    // 413 Payload Too Large
    case ErrorCode.FILE_TOO_LARGE:
      return 413;
    
    // 429 Too Many Requests
    case ErrorCode.UPLOAD_LIMIT_EXCEEDED:
      return HttpStatus.TOO_MANY_REQUESTS;
    
    // 500 Internal Server Error
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

/**
 * 에러 응답 전송 (자동 상태 코드 매핑)
 */
export function sendErrorAuto(
  res: Response,
  code: ErrorCode,
  message?: string,
  details?: unknown
): void {
  const statusCode = getHttpStatusForError(code);
  sendError(res, code, message, statusCode, details);
}
