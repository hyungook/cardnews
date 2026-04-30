import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import styles from './FrameCleanup.module.css';

interface BatchInfo {
  batchId: string;
  createdAt: string;
  frameCount: number;
}

export default function FrameCleanup() {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: { batches: BatchInfo[] } }>(
        '/frames/batches',
      );
      setBatches(response.data.batches || []);
    } catch {
      // silently fail
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleDelete = useCallback(
    async (batchId: string) => {
      if (!confirm('이 배치의 프레임을 삭제하시겠습니까?')) return;
      setDeleting(batchId);
      try {
        await apiFetch(`/frames/${batchId}`, { method: 'DELETE' });
        setBatches((prev) => prev.filter((b) => b.batchId !== batchId));
      } catch {
        // silently fail
      } finally {
        setDeleting(null);
      }
    },
    [],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>🗂 프레임 정리</span>
        <button
          className={styles.refreshBtn}
          onClick={fetchBatches}
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} 새로고침
        </button>
      </div>

      {loading && batches.length === 0 && (
        <div className={styles.loading}>배치 목록을 불러오는 중...</div>
      )}

      {!loading && batches.length === 0 && (
        <div className={styles.empty}>정리할 프레임 배치가 없습니다.</div>
      )}

      <ul className={styles.batchList}>
        {batches.map((batch) => (
          <li key={batch.batchId} className={styles.batchItem}>
            <div>
              <div className={styles.batchInfo}>
                {batch.frameCount}개 프레임
              </div>
              <div className={styles.batchDate}>
                {new Date(batch.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
            <button
              className={styles.deleteBtn}
              onClick={() => handleDelete(batch.batchId)}
              disabled={deleting === batch.batchId}
            >
              {deleting === batch.batchId ? '삭제 중...' : '삭제'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
