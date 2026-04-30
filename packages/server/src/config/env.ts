import dotenv from 'dotenv';
import { z } from 'zod';
import { join } from 'path';

// .env 파일 로드 (프로젝트 루트에서)
dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * 환경 변수 스키마 정의
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number).pipe(z.number().positive()),
  BASE_DIR: z.string().default('./images'),
  MAX_FILE_SIZE: z.string().default('20971520').transform(Number).pipe(z.number().positive()), // 20MB
  MAX_CONCURRENT_UPLOADS: z.string().default('40').transform(Number).pipe(z.number().positive()),
  CLEANUP_DAYS: z.string().default('30').transform(Number).pipe(z.number().positive()),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: z.string().optional(),
});

/**
 * 환경 변수 파싱 및 검증
 */
function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ 환경 변수 검증 실패:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

/**
 * 검증된 환경 변수
 */
export const env = parseEnv();

/**
 * 환경별 헬퍼 함수
 */
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * CORS 허용 오리진 목록
 */
export const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

/**
 * 환경 변수 정보 출력 (개발 환경에서만)
 */
if (isDevelopment) {
  console.log('📋 환경 변수 설정:');
  console.log(`  - NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  - PORT: ${env.PORT}`);
  console.log(`  - BASE_DIR: ${env.BASE_DIR}`);
  console.log(`  - MAX_FILE_SIZE: ${(env.MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  - MAX_CONCURRENT_UPLOADS: ${env.MAX_CONCURRENT_UPLOADS}`);
  console.log(`  - CLEANUP_DAYS: ${env.CLEANUP_DAYS}`);
  console.log(`  - LOG_LEVEL: ${env.LOG_LEVEL}`);
  console.log(`  - ALLOWED_ORIGINS: ${allowedOrigins.join(', ')}`);
}
