import { useState, useEffect, useCallback } from 'react';
import type { HistoryRecord, HistoryFile, HistoryError } from '@card-news/shared';
import { apiFetch } from '../api/client';

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: { records: HistoryRecord[] } }>(
        '/history',
      );
      setRecords(response.data.records || []);
    } catch {
      // silently fail
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSelect = useCallback(async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: { record: HistoryRecord } }>(
        `/history/${id}`,
      );
      setDetail(response.data.record || null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>히스토리</h1>
        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: 8,
            background: '#fff',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {loading ? '⏳' : '🔄'} 새로고침
        </button>
      </div>

      {loading && records.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>
          히스토리를 불러오는 중...
        </p>
      )}

      {!loading && records.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>
          생성 이력이 없습니다.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {records.map((rec) => (
          <div
            key={rec.id}
            style={{
              background: '#fff',
              border: selectedId === rec.id ? '2px solid #4a6cf7' : '1px solid #e0e0e0',
              borderRadius: 10,
              padding: 16,
              cursor: 'pointer',
            }}
            onClick={() => handleSelect(rec.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {new Date(rec.createdAt).toLocaleString('ko-KR')}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  카드뉴스 {rec.successCount}장 성공
                  {rec.errorCount > 0 && (
                    <span style={{ color: '#e74c3c' }}> · {rec.errorCount}건 오류</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                총 {rec.totalCount}건
              </div>
            </div>

            {selectedId === rec.id && (
              <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                {detailLoading && (
                  <p style={{ color: '#999', fontSize: 13 }}>상세 정보 로딩 중...</p>
                )}

                {detail && !detailLoading && (
                  <>
                    {detail.files.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                          생성된 파일 ({detail.files.length})
                        </div>
                        <div style={{
                          padding: '12px',
                          background: '#f0f7ff',
                          border: '1px solid #b3d4ff',
                          borderRadius: 8,
                          marginBottom: 8,
                          fontSize: 12,
                          color: '#1e40af',
                        }}>
                          💡 생성된 카드뉴스는 Figma 파일에서 확인할 수 있습니다.
                        </div>
                        {detail.files.map((file: HistoryFile) => (
                          <div
                            key={file.filename}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: '#f9f9f9',
                              borderRadius: 6,
                              marginBottom: 4,
                              fontSize: 12,
                            }}
                          >
                            <span>{file.filename} ({file.movieTitle})</span>
                            <span style={{ color: '#4ade80', fontSize: 11 }}>✅ 완료</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {detail.errors.length > 0 && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#e74c3c' }}>
                          오류 목록 ({detail.errors.length})
                        </div>
                        {detail.errors.map((err: HistoryError, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              padding: '6px 10px',
                              background: '#fff5f5',
                              borderRadius: 6,
                              marginBottom: 4,
                              fontSize: 12,
                              color: '#c0392b',
                            }}
                          >
                            {err.rowIndex}행 ({err.movieTitle}): {err.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
