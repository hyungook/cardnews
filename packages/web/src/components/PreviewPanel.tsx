import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';
import styles from './PreviewPanel.module.css';

export interface PreviewPanelProps {
  rowIndex: number | null;
  onClose: () => void;
}

export default function PreviewPanel({ rowIndex, onClose }: PreviewPanelProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async (idx: number) => {
    setLoading(true);
    setError(null);
    setImageData(null);
    try {
      const response = await apiFetch<{ success: boolean; data: { image: string } }>(
        `/preview/${idx}`,
        { method: 'POST' },
      );
      setImageData(response.data.image);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '미리보기를 불러올 수 없습니다',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rowIndex !== null) {
      fetchPreview(rowIndex);
    }
  }, [rowIndex, fetchPreview]);

  if (rowIndex === null) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>미리보기 — {rowIndex}행</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <div className={styles.notice}>
        미리보기는 저해상도(0.5x)입니다. 최종 출력물과 레이아웃은 동일하나 해상도가 낮을 수 있습니다.
      </div>

      {loading && <div className={styles.loading}>미리보기 생성 중...</div>}

      {error && <div className={styles.error}>{error}</div>}

      {imageData && (
        <div className={styles.imageWrapper}>
          <img
            className={styles.previewImage}
            src={`data:image/jpeg;base64,${imageData}`}
            alt={`${rowIndex}행 미리보기`}
          />
        </div>
      )}
    </div>
  );
}
