// 환경 변수 로드 (가장 먼저)
import './config/env.js';

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { configRouter } from './routes/config.js';
import { figmaRouter } from './routes/figma.js';
import { sheetsRouter } from './routes/sheets.js';
import { generateRouter } from './routes/generate.js';
import { historyRouter } from './routes/history.js';
import { framesRouter } from './routes/frames.js';
import { localUploadRouter } from './routes/local-upload.js';
import { migrateRouter } from './routes/migrate-columns.js';
import { WebSocketBridge } from './websocket/bridge.js';
import { ensureFolders, cleanupOldResults } from './local/local-storage.js';
import { env, allowedOrigins } from './config/env.js';
import { log, requestLogger } from './utils/logger.js';

export const SERVER_VERSION = '1.0.0';

export function createApp() {
  const app = express();

  // CORS 설정
  app.use(cors({
    origin: (origin, callback) => {
      // origin이 없는 경우 (같은 도메인) 또는 허용 목록에 있는 경우
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Origin not allowed'));
      }
    },
    credentials: true,
  }));
  
  app.use(express.json({ limit: '10mb' }));
  
  // 요청 로깅 미들웨어
  app.use(requestLogger);

  app.use('/api/config', configRouter);
  app.use('/api/figma', figmaRouter);
  app.use('/api/sheets', sheetsRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/frames', framesRouter);
  app.use('/api/local', localUploadRouter);
  app.use('/api/migrate', migrateRouter);

  return app;
}

const PORT = env.PORT;

let wsBridge: WebSocketBridge | null = null;

export function getWebSocketBridge(): WebSocketBridge | null {
  return wsBridge;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const httpServer = createServer(app);

  wsBridge = new WebSocketBridge(httpServer);

  // 서버 시작 전 초기화
  (async () => {
    try {
      // 로컬 폴더 생성
      await ensureFolders();
      log.info('로컬 폴더 초기화 완료');
      
      // 30일 이상 된 결과물 삭제
      const deletedCount = await cleanupOldResults(env.CLEANUP_DAYS);
      if (deletedCount > 0) {
        log.info(`오래된 결과물 삭제 완료`, { count: deletedCount, days: env.CLEANUP_DAYS });
      }
    } catch (error) {
      log.error('서버 초기화 실패', error);
    }

    httpServer.listen(PORT, () => {
      log.info(`카드뉴스 자동화 서버 시작`, { port: PORT, env: env.NODE_ENV });
      log.info(`WebSocket 브릿지 대기 중`, { url: `ws://localhost:${PORT}/ws` });
    });
  })();
}
