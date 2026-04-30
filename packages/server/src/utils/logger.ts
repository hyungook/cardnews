import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env, isDevelopment } from '../config/env.js';

/**
 * 로그 포맷 정의
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * 콘솔 출력 포맷 (개발 환경용)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // 메타데이터가 있으면 추가
    const metaKeys = Object.keys(meta).filter(key => key !== 'timestamp' && key !== 'level' && key !== 'message');
    if (metaKeys.length > 0) {
      const metaObj: Record<string, unknown> = {};
      metaKeys.forEach(key => {
        metaObj[key] = meta[key];
      });
      msg += ` ${JSON.stringify(metaObj)}`;
    }
    
    return msg;
  })
);

/**
 * Winston 로거 인스턴스
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'card-news-automation' },
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: consoleFormat,
      silent: env.NODE_ENV === 'test', // 테스트 환경에서는 콘솔 출력 비활성화
    }),
    
    // 에러 로그 파일 (일별 로테이션)
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
      format: logFormat,
    }),
    
    // 전체 로그 파일 (일별 로테이션)
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      format: logFormat,
    }),
  ],
});

/**
 * 개발 환경에서는 debug 레벨까지 출력
 */
if (isDevelopment) {
  logger.level = 'debug';
}

/**
 * 로거 헬퍼 함수
 */
export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
    if (error instanceof Error) {
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
    } else {
      logger.error(message, { ...meta, error });
    }
  },
};

/**
 * HTTP 요청 로깅 미들웨어
 */
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };
    
    if (res.statusCode >= 500) {
      logger.error('HTTP Request', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
}

// 초기화 로그
logger.info('로깅 시스템 초기화 완료', {
  level: env.LOG_LEVEL,
  environment: env.NODE_ENV,
});
