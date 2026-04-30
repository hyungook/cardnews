import { useState, useEffect, useCallback } from 'react';
import type { CardNewsRow, RowResult } from '@card-news/shared';
import { apiFetch } from '../api/client';
import SpreadsheetTable from '../components/SpreadsheetTable';
import GenerationProgress from '../components/GenerationProgress';
import PreviewPanel from '../components/PreviewPanel';
import FrameCleanup from '../components/FrameCleanup';
import ImageUploader from '../components/ImageUploader';

export default function DashboardPage() {
  const [rows, setRows] = useState<CardNewsRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<number | null>(null);
  const [completedResults, setCompletedResults] = useState<RowResult[] | null>(null);
  const [pluginConnected, setPluginConnected] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; folder: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ success: boolean; data: { rows: CardNewsRow[] } }>(
        '/sheets/data',
      );
      setRows(response.data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPluginStatus = useCallback(async () => {
    try {
      const response = await apiFetch<{ success: boolean; data: { pluginConnected: boolean } }>(
        '/config/plugin-status',
      );
      setPluginConnected(response.data.pluginConnected);
    } catch {
      setPluginConnected(false);
    }
  }, []);

  const fetchUploadedFiles = useCallback(async () => {
    try {
      const response = await apiFetch<{ success: boolean; data: { files: { name: string; folder: string }[] } }>('/local/files');
      setUploadedFiles(response.data.files || []);
    } catch {
      setUploadedFiles([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
    checkPluginStatus();
    fetchUploadedFiles();
    // 10초마다 플러그인 상태 확인
    const interval = setInterval(checkPluginStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchData, checkPluginStatus, fetchUploadedFiles]);

  const handleGenerate = useCallback(async () => {
    if (selectedRows.length === 0) return;
    setGenerating(true);
    setCompletedResults(null);
    try {
      const response = await apiFetch<{ success: boolean; data: { batchId: string } }>('/generate', {
        method: 'POST',
        body: JSON.stringify({ rowIndices: selectedRows }),
      });
      setBatchId(response.data.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 요청에 실패했습니다');
      setGenerating(false);
    }
  }, [selectedRows]);

  const handleCancel = useCallback(async () => {
    if (!batchId) return;
    try {
      await apiFetch('/generate/cancel', {
        method: 'POST',
        body: JSON.stringify({ batchId }),
      });
    } catch {
      // silently fail
    }
  }, [batchId]);

  const handleGenerationComplete = useCallback((results: RowResult[]) => {
    setGenerating(false);
    setCompletedResults(results);
  }, []);

  const successCount = completedResults?.filter((r) => r.status === 'success' || r.status === 'warning').length ?? 0;
  const errorCount = completedResults?.filter((r) => r.status === 'error').length ?? 0;
  const errorResults = completedResults?.filter((r) => r.status === 'error') ?? [];
  const successResults = completedResults?.filter((r) => r.status === 'success' || r.status === 'warning') ?? [];

  const handleDownloadAll = useCallback(async () => {
    // Download each successful result file
    for (const r of successResults) {
      if (r.movieTitle) {
        window.open(`/api/download/${r.movieTitle}`, '_blank');
      }
    }
  }, [successResults]);

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        marginBottom: '32px',
        padding: '24px',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        borderRadius: '12px',
        border: '1px solid #333',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.5px',
        }}>
          대시보드
        </h1>
        <button
          onClick={handleGenerate}
          disabled={selectedRows.length === 0 || generating}
          style={{
            marginLeft: 'auto',
            padding: '14px 32px',
            background: selectedRows.length > 0
              ? 'linear-gradient(135deg, #e50914 0%, #b20710 100%)'
              : '#333',
            color: selectedRows.length > 0 ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed',
            opacity: generating ? 0.7 : 1,
            transition: 'all 0.2s',
            boxShadow: selectedRows.length > 0 ? '0 4px 12px rgba(229, 9, 20, 0.4)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (selectedRows.length > 0 && !generating) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(229, 9, 20, 0.6)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = selectedRows.length > 0 ? '0 4px 12px rgba(229, 9, 20, 0.4)' : 'none';
          }}
        >
          {generating ? '⏳ 생성 중...' : `▶ 생성 (${selectedRows.length}개)`}
        </button>
        {generating && (
          <button
            onClick={handleCancel}
            style={{
              padding: '14px 28px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#333';
            }}
          >
            ⏹ 중단
          </button>
        )}
      </div>

          {/* Figma 플러그인 안내 배너 */}
      {!pluginConnected && !bannerDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, #3a1a0c 0%, #5a2a12 100%)',
          border: '2px solid #e67e22',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}>
          <div style={{ fontSize: '32px', flexShrink: 0 }}>🔌</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f39c12', marginBottom: '8px' }}>
              Figma 플러그인을 실행해주세요
            </div>
            <div style={{ fontSize: '13px', color: '#e5e5e5', lineHeight: 1.6, marginBottom: '12px' }}>
              카드뉴스를 생성하려면 Figma 데스크톱 앱에서 플러그인을 실행해야 합니다.<br />
              <strong>설정은 이미 저장되어 있으니</strong> 플러그인만 실행하면 바로 사용할 수 있습니다.
            </div>
            <div style={{
              background: '#2a2a2a',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              color: '#b3b3b3',
              marginBottom: '12px',
            }}>
              <div style={{ fontWeight: 600, color: '#f39c12', marginBottom: '8px' }}>📌 실행 방법 (단계별)</div>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 2 }}>
                <li><strong>Figma 데스크톱 앱</strong>을 실행합니다 (웹 버전 아님!)</li>
                <li>카드뉴스 템플릿이 있는 <strong>Figma 파일</strong>을 엽니다</li>
                <li>화면 상단 메뉴에서 <strong style={{ color: '#f39c12' }}>Plugins</strong>를 클릭합니다</li>
                <li>드롭다운에서 <strong style={{ color: '#f39c12' }}>Development</strong>를 선택합니다</li>
                <li><strong style={{ color: '#f39c12' }}>카드뉴스 자동화</strong>를 클릭합니다</li>
                <li>플러그인이 백그라운드에서 실행됩니다 (화면 변화 없음)</li>
                <li>이 배너가 사라지면 연결 성공! 🎉</li>
              </ol>
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#1a1a1a', borderRadius: '6px', borderLeft: '3px solid #f39c12' }}>
                <div style={{ fontSize: '11px', color: '#f39c12', fontWeight: 600, marginBottom: '4px' }}>💡 처음 사용하시나요?</div>
                <div style={{ fontSize: '11px', color: '#b3b3b3', lineHeight: 1.6 }}>
                  플러그인이 목록에 없다면 먼저 등록해야 합니다.<br />
                  우측 하단 <strong style={{ color: '#fff' }}>?</strong> 버튼을 클릭하여 "Figma 플러그인 실행" 섹션을 확인하세요.
                </div>
              </div>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid #666',
                borderRadius: '6px',
                color: '#b3b3b3',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3a3a3a';
                e.currentTarget.style.borderColor = '#888';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#666';
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #3a0a0c 0%, #5a0f12 100%)',
            color: '#ff6b6b',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #8a1a1f',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Generation Progress */}
      {generating && batchId && (
        <GenerationProgress
          batchId={batchId}
          onComplete={handleGenerationComplete}
        />
      )}

      {/* Result Summary */}
      {completedResults && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            border: '1px solid #333',
            borderRadius: 12,
            padding: 28,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#fff' }}>
            ✅ 생성 완료
          </div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
            <div style={{
              textAlign: 'center',
              padding: '20px',
              background: 'linear-gradient(135deg, #0a3a0c 0%, #0f5a12 100%)',
              borderRadius: 10,
              flex: 1,
              border: '1px solid #1a7a1f',
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#4ade80' }}>
                {successCount}
              </div>
              <div style={{ fontSize: 9, color: '#86efac', marginTop: 4 }}>성공</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '20px',
              background: 'linear-gradient(135deg, #3a0a0c 0%, #5a0f12 100%)',
              borderRadius: 10,
              flex: 1,
              border: '1px solid #8a1a1f',
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#f87171' }}>
                {errorCount}
              </div>
              <div style={{ fontSize: 9, color: '#fca5a5', marginTop: 4 }}>실패</div>
            </div>
          </div>
          {errorResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 12 }}>
                ❌ 오류 목록
              </div>
              {errorResults.map((r) => (
                <div
                  key={r.rowIndex}
                  style={{
                    padding: '10px 14px',
                    background: '#2a1a1a',
                    borderRadius: 6,
                    marginBottom: 6,
                    fontSize: 9,
                    color: '#fca5a5',
                    border: '1px solid #4a2a2a',
                  }}
                >
                  {r.rowIndex}행 ({r.movieTitle}): {r.error}
                </div>
              ))}
            </div>
          )}

          {/* 결과물 갤러리 */}
          {successResults.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>
                  🎬 생성된 카드뉴스 ({successResults.length}장)
                </div>
                <button
                  onClick={handleDownloadAll}
                  style={{
                    padding: '8px 18px',
                    background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 9,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  📥 전체 다운로드
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
              }}>
                {successResults.map((r) => (
                  <div
                    key={r.rowIndex}
                    style={{
                      background: '#2a2a2a',
                      borderRadius: 8,
                      padding: 12,
                      textAlign: 'center',
                      border: r.sizeWarning ? '2px solid #f59e0b' : '1px solid #3a3a3a',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '808/454',
                      background: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)',
                      borderRadius: 6,
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                    }}>
                      🎬
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 6, color: '#fff' }}>
                      {r.movieTitle}
                    </div>
                    {r.sizeWarning && (
                      <div style={{ fontSize: 9, color: '#f59e0b' }}>⚠️ 용량 초과</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setCompletedResults(null)}
            style={{
              marginTop: 16,
              padding: '8px 18px',
              border: '1px solid #444',
              borderRadius: 6,
              background: '#2a2a2a',
              fontSize: 9,
              cursor: 'pointer',
              color: '#b3b3b3',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a3a3a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2a2a2a';
            }}
          >
            닫기
          </button>
        </div>
      )}

      {/* Preview Panel */}
      <PreviewPanel
        rowIndex={previewRow}
        onClose={() => setPreviewRow(null)}
      />

      {loading ? (
        <p style={{
          color: '#94a3b8',
          textAlign: 'center',
          padding: '60px',
          fontSize: '15px',
        }}>
          ⏳ 데이터를 불러오는 중...
        </p>
      ) : (
        <SpreadsheetTable
          rows={rows}
          onRefresh={fetchData}
          onRowsSelected={setSelectedRows}
          selectedRows={selectedRows}
          onPreviewRow={setPreviewRow}
          uploadedFiles={uploadedFiles}
          onFilesChange={fetchUploadedFiles}
        />
      )}

      {/* Image Uploader */}
      <ImageUploader onUploadComplete={fetchUploadedFiles} />

      {/* Frame Cleanup */}
      <div style={{ marginTop: 32 }}>
        <FrameCleanup />
      </div>
    </div>
  );
}
