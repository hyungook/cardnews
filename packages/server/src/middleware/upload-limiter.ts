import { Request, Response, NextFunction } from 'express';
import { sendErrorAuto } from '../utils/response.js';
import { ErrorCode } from '@card-news/shared';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * 동시 업로드 제한 미들웨어
 * 
 * 동시에 업로드할 수 있는 파일 수를 제한한다.
 * 제한을 초과하면 429 Too Many Requests 에러를 반환한다.
 */

/**
 * 현재 진행 중인 업로드 수
 */
let activeUploads = 0;

/**
 * 대기 중인 요청 큐
 */
interface QueuedRequest {
  req: Request;
  res: Response;
  next: NextFunction;
  resolve: () => void;
}

const uploadQueue: QueuedRequest[] = [];

/**
 * 업로드 시작 시 호출
 */
function acquireUploadSlot(): boolean {
  if (activeUploads < env.MAX_CONCURRENT_UPLOADS) {
    activeUploads++;
    log.debug('업로드 슬롯 획득', { activeUploads, maxUploads: env.MAX_CONCURRENT_UPLOADS });
    return true;
  }
  return false;
}

/**
 * 업로드 완료 시 호출
 */
function releaseUploadSlot(): void {
  activeUploads--;
  log.debug('업로드 슬롯 해제', { activeUploads, maxUploads: env.MAX_CONCURRENT_UPLOADS });
  
  // 대기 중인 요청이 있으면 처리
  if (uploadQueue.length > 0) {
    const queued = uploadQueue.shift();
    if (queued) {
      log.debug('대기 중인 업로드 처리', { queueLength: uploadQueue.length });
      queued.resolve();
    }
  }
}

/**
 * 현재 업로드 상태 조회
 */
export function getUploadStatus() {
  return {
    activeUploads,
    maxUploads: env.MAX_CONCURRENT_UPLOADS,
    queueLength: uploadQueue.length,
    availableSlots: env.MAX_CONCURRENT_UPLOADS - activeUploads,
  };
}

/**
 * 업로드 제한 미들웨어
 * 
 * 동시 업로드 수가 제한을 초과하면 429 에러를 반환한다.
 * 
 * @param allowQueue true면 대기열에 추가, false면 즉시 거부 (기본값: false)
 */
export function uploadLimiter(allowQueue = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 업로드 슬롯 획득 시도
    if (acquireUploadSlot()) {
      // 슬롯 획득 성공 - 업로드 진행
      
      // 응답 완료 시 슬롯 해제
      const originalSend = res.send;
      const originalJson = res.json;
      
      const cleanup = () => {
        releaseUploadSlot();
      };
      
      res.send = function (body?: any) {
        cleanup();
        return originalSend.call(this, body);
      };
      
      res.json = function (body?: any) {
        cleanup();
        return originalJson.call(this, body);
      };
      
      // 연결 종료 시에도 슬롯 해제
      res.on('close', cleanup);
      res.on('finish', cleanup);
      
      next();
    } else {
      // 슬롯 획득 실패
      if (allowQueue) {
        // 대기열에 추가
        log.info('업로드 대기열에 추가', { 
          queueLength: uploadQueue.length + 1,
          activeUploads,
          maxUploads: env.MAX_CONCURRENT_UPLOADS 
        });
        
        await new Promise<void>((resolve) => {
          uploadQueue.push({ req, res, next, resolve });
        });
        
        // 대기 완료 후 슬롯 획득
        acquireUploadSlot();
        
        // 응답 완료 시 슬롯 해제
        const originalSend = res.send;
        const originalJson = res.json;
        
        const cleanup = () => {
          releaseUploadSlot();
        };
        
        res.send = function (body?: any) {
          cleanup();
          return originalSend.call(this, body);
        };
        
        res.json = function (body?: any) {
          cleanup();
          return originalJson.call(this, body);
        };
        
        res.on('close', cleanup);
        res.on('finish', cleanup);
        
        next();
      } else {
        // 즉시 거부
        log.warn('동시 업로드 제한 초과', { 
          activeUploads,
          maxUploads: env.MAX_CONCURRENT_UPLOADS 
        });
        
        sendErrorAuto(res, ErrorCode.UPLOAD_LIMIT_EXCEEDED, 
          `동시 업로드 제한을 초과했습니다. 현재 ${activeUploads}/${env.MAX_CONCURRENT_UPLOADS}개 업로드 중입니다.`
        );
      }
    }
  };
}

/**
 * 업로드 상태 초기화 (테스트용)
 */
export function resetUploadLimiter(): void {
  activeUploads = 0;
  uploadQueue.length = 0;
  log.debug('업로드 제한 초기화');
}
