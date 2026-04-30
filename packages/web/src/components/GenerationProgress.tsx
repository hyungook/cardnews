import { useState, useEffect, useRef } from 'react';
import type { GenerationProgress as ProgressData, RowResult } from '@card-news/shared';
import styles from './GenerationProgress.module.css';

export interface GenerationProgressProps {
  batchId: string | null;
  onComplete?: (results: RowResult[]) => void;
}

export default function GenerationProgress({
  batchId,
  onComplete,
}: GenerationProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!batchId) {
      setProgress(null);
      return;
    }

    const es = new EventSource(`/api/generate/progress?batchId=${batchId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        setProgress(data);
        if (data.status === 'completed' || data.status === 'error') {
          es.close();
          onComplete?.(data.results);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [batchId, onComplete]);

  if (!batchId || !progress) return null;

  const percent =
    progress.totalRows > 0
      ? Math.round((progress.currentRow / progress.totalRows) * 100)
      : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>생성 진행 중</span>
        <span className={styles.status}>
          {progress.currentRow}/{progress.totalRows}행
        </span>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className={styles.stepInfo}>
        현재 단계: {progress.currentStep}
      </div>

      {progress.rateLimit?.waiting && (
        <div className={styles.rateLimitBanner}>
          ⏳ API 대기 중... ({progress.rateLimit.retryAfter}초 후 재시도)
        </div>
      )}

      {progress.results.length > 0 && (
        <div className={styles.resultList}>
          {progress.results.map((r) => (
            <div
              key={r.rowIndex}
              className={`${styles.resultItem} ${
                r.status === 'success'
                  ? styles.resultSuccess
                  : r.status === 'error'
                    ? styles.resultError
                    : styles.resultWarning
              }`}
            >
              <span>
                {r.status === 'success' ? '✅' : r.status === 'error' ? '❌' : '⚠️'}
              </span>
              <span>
                {r.rowIndex}행 — {r.movieTitle}
              </span>
              {r.error && <span>: {r.error}</span>}
              {r.sizeWarning && <span> (용량 초과 경고)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
