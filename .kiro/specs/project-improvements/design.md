# 프로젝트 개선 설계

## 1. 보안 개선

### 1.1 파일 경로 검증
```typescript
// packages/server/src/utils/file-validator.ts
export function validateFilename(filename: string): boolean {
  // 경로 구분자 차단
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }
  
  // 허용된 문자만 사용
  const validPattern = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ._-]+$/;
  return validPattern.test(filename);
}

export function sanitizeFilename(filename: string): string {
  // 위험한 문자 제거
  return filename.replace(/[\/\\\.\.]/g, '');
}
```

### 1.2 파일 해시 기반 중복 체크
```typescript
// packages/server/src/utils/file-hash.ts
import crypto from 'crypto';

export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function isDuplicateFile(
  folderName: string,
  fileHash: string
): Promise<{ isDuplicate: boolean; existingFilename?: string }> {
  // 폴더 내 모든 파일의 해시 계산 및 비교
  const files = await listFiles(folderName);
  
  for (const file of files) {
    const filePath = join(BASE_DIR, folderName, file.name);
    const fileBuffer = await readFile(filePath);
    const existingHash = calculateFileHash(fileBuffer);
    
    if (existingHash === fileHash) {
      return { isDuplicate: true, existingFilename: file.name };
    }
  }
  
  return { isDuplicate: false };
}
```

### 1.3 동시 업로드 제한
```typescript
// packages/server/src/middleware/upload-limiter.ts
import { Request, Response, NextFunction } from 'express';

let currentUploads = 0;
const MAX_CONCURRENT_UPLOADS = parseInt(process.env.MAX_CONCURRENT_UPLOADS || '40', 10);

export function uploadLimiter(req: Request, res: Response, next: NextFunction) {
  if (currentUploads >= MAX_CONCURRENT_UPLOADS) {
    res.status(429).json({
      success: false,
      error: {
        code: 'UPLOAD_LIMIT_EXCEEDED',
        message: `동시 업로드 제한을 초과했습니다. 잠시 후 다시 시도해주세요. (현재: ${currentUploads}/${MAX_CONCURRENT_UPLOADS})`,
      },
    });
    return;
  }
  
  currentUploads++;
  
  res.on('finish', () => {
    currentUploads--;
  });
  
  res.on('close', () => {
    currentUploads--;
  });
  
  next();
}
```

## 2. 파일명 충돌 처리

### 2.1 자동 번호 부여
```typescript
// packages/server/src/utils/filename-conflict.ts
export async function resolveFilenameConflict(
  folderName: string,
  filename: string
): Promise<string> {
  const files = await listFiles(folderName);
  const existingNames = files.map(f => f.name);
  
  if (!existingNames.includes(filename)) {
    return filename;
  }
  
  const ext = extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);
  
  let counter = 1;
  let newFilename = `${nameWithoutExt}_${counter}${ext}`;
  
  while (existingNames.includes(newFilename)) {
    counter++;
    newFilename = `${nameWithoutExt}_${counter}${ext}`;
  }
  
  return newFilename;
}
```

### 2.2 파일명 수정 API
```typescript
// POST /api/local/rename
{
  folder: '배경이미지' | '로고',
  oldFilename: string,
  newFilename: string
}
```

## 3. 로깅 시스템

### 3.1 Winston 설정
```typescript
// packages/server/src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'card-news-automation' },
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
    
    // 에러 로그 파일
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '20m',
    }),
    
    // 전체 로그 파일
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
    }),
  ],
});

// 개발 환경에서는 상세 로그
if (isDevelopment) {
  logger.level = 'debug';
}
```

### 3.2 로그 사용 예시
```typescript
// console.log 대체
logger.info('서버 시작', { port: PORT });
logger.debug('파일 업로드 시작', { filename, size });
logger.warn('파일 크기 초과', { filename, size, maxSize });
logger.error('업로드 실패', { error: err.message, stack: err.stack });
```

## 4. 환경 변수 관리

### 4.1 .env 파일 구조
```bash
# .env.example
NODE_ENV=development
PORT=3000

# 파일 저장 경로
BASE_DIR=./images

# 파일 업로드 제한
MAX_FILE_SIZE=20971520
MAX_CONCURRENT_UPLOADS=40

# 자동 삭제 설정
CLEANUP_DAYS=30

# 로그 설정
LOG_LEVEL=info

# CORS 설정
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

### 4.2 환경 변수 로드
```typescript
// packages/server/src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  BASE_DIR: z.string().default('./images'),
  MAX_FILE_SIZE: z.string().transform(Number).default('20971520'),
  MAX_CONCURRENT_UPLOADS: z.string().transform(Number).default('40'),
  CLEANUP_DAYS: z.string().transform(Number).default('30'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

## 5. API 응답 표준화

### 5.1 응답 타입 정의
```typescript
// packages/shared/src/api-types.ts
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// 에러 코드 정의
export enum ErrorCode {
  // 파일 관련
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_DUPLICATE = 'FILE_DUPLICATE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_FILENAME = 'INVALID_FILENAME',
  
  // 업로드 관련
  UPLOAD_LIMIT_EXCEEDED = 'UPLOAD_LIMIT_EXCEEDED',
  NO_FILE_PROVIDED = 'NO_FILE_PROVIDED',
  
  // 설정 관련
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  
  // API 연결
  SHEETS_CONNECTION_FAILED = 'SHEETS_CONNECTION_FAILED',
  FIGMA_CONNECTION_FAILED = 'FIGMA_CONNECTION_FAILED',
  
  // 일반
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}
```

### 5.2 응답 헬퍼 함수
```typescript
// packages/server/src/utils/response.ts
import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, ErrorCode } from '@card-news/shared';
import { logger } from './logger.js';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode = 500,
  details?: unknown
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && details ? { details } : {}),
    },
  };
  
  logger.error('API Error', { code, message, statusCode, details });
  res.status(statusCode).json(response);
}
```

## 6. API 연결 테스트 구현

### 6.1 Google Sheets 연결 테스트
```typescript
// packages/server/src/utils/connection-test.ts
export async function testGoogleSheetsConnection(config: AppConfig): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    const reader = new SpreadsheetReader(config);
    
    // 실제로 스프레드시트 읽기 시도
    await reader.readAllRows();
    
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

export async function testFigmaConnection(config: AppConfig): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    // Figma REST API로 파일 정보 조회
    const response = await fetch(
      `https://api.figma.com/v1/files/${config.figma.fileKey}`,
      {
        headers: {
          'X-Figma-Token': config.figma.accessToken,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Figma API 오류: ${response.status} ${response.statusText}`);
    }
    
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
```

## 7. 성능 최적화

### 7.1 파일 목록 페이지네이션
```typescript
// GET /api/local/files?page=1&limit=50
export interface PaginatedFilesResponse {
  files: LocalFile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listFilesPaginated(
  folderName: string,
  page = 1,
  limit = 50
): Promise<PaginatedFilesResponse> {
  const allFiles = await listFiles(folderName);
  const total = allFiles.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const files = allFiles.slice(startIndex, endIndex);
  
  return {
    files,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
```

### 7.2 메모리 사용량 모니터링
```typescript
// packages/server/src/middleware/memory-monitor.ts
export function memoryMonitor(req: Request, res: Response, next: NextFunction) {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  logger.debug('Memory usage', {
    heapUsed: `${heapUsedMB}MB`,
    heapTotal: `${heapTotalMB}MB`,
    usage: `${Math.round((heapUsedMB / heapTotalMB) * 100)}%`,
  });
  
  // 메모리 사용량이 90% 초과 시 경고
  if (heapUsedMB / heapTotalMB > 0.9) {
    logger.warn('High memory usage detected', { heapUsedMB, heapTotalMB });
  }
  
  next();
}
```

## 8. 배포 설정

### 8.1 Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# 의존성 설치
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

RUN npm ci --workspace=packages/server --workspace=packages/shared

# 소스 코드 복사
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# 빌드
RUN npm run build --workspace=packages/server

# 이미지 저장 폴더 생성
RUN mkdir -p /app/images/배경이미지 /app/images/로고 /app/images/결과물

# 포트 노출
EXPOSE 3000

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 실행
CMD ["node", "packages/server/dist/index.js"]
```

### 8.2 docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
    volumes:
      - ./images:/app/images
      - ./logs:/app/logs
      - ./config.json:/app/config.json
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### 8.3 PM2 설정
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'card-news-automation',
    script: './packages/server/dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '500M',
    watch: false,
  }],
};
```

### 8.4 헬스 체크 엔드포인트
```typescript
// GET /health
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
  });
});
```

## 9. 문서화

### 9.1 Swagger/OpenAPI 설정
```typescript
// packages/server/src/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '카드뉴스 자동화 API',
      version: '1.0.0',
      description: 'Figma 기반 카드뉴스 자동 생성 시스템',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '개발 서버',
      },
    ],
  },
  apis: ['./packages/server/src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

## 구현 순서

### Phase 1 (1-2일)
1. 환경 변수 관리 (.env, zod 검증)
2. 로깅 시스템 (Winston)
3. API 응답 표준화
4. 파일 경로 검증

### Phase 2 (2-3일)
5. 중복 파일 체크 (해시 기반)
6. 동시 업로드 제한
7. 파일명 충돌 처리
8. 파일명 수정 API

### Phase 3 (1-2일)
9. API 연결 테스트 구현
10. 자동 삭제 관리 API
11. 페이지네이션

### Phase 4 (1-2일)
12. 테스트 작성
13. 문서화 (Swagger)
14. 배포 설정 (Docker, PM2)
