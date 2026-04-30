import { useState, useCallback, useEffect, type DragEvent } from 'react';
import { apiFetch } from '../api/client';

interface UploadedFile {
  id: string;
  name: string;
  folder: string;
  size: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

interface ImageUploaderProps {
  onUploadComplete?: () => void;
}

export default function ImageUploader({ onUploadComplete }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [results, setResults] = useState<{ name: string; status: 'ok' | 'error'; message: string }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 업로드된 파일 목록 불러오기
  const loadUploadedFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const response = await apiFetch<{ success: boolean; data: { files: UploadedFile[] } }>('/local/files');
      setUploadedFiles(response.data.files || []);
    } catch (err) {
      console.error('파일 목록 조회 실패:', err);
      setUploadedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadUploadedFiles();
  }, [loadUploadedFiles]);

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    setResults([]);
    
    const fileArray = Array.from(files);
    const progressArray: UploadProgress[] = fileArray.map((f) => ({
      fileName: f.name,
      progress: 0,
      status: 'uploading' as const,
    }));
    setUploadProgress(progressArray);

    const newResults: typeof results = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        newResults.push({ name: file.name, status: 'error', message: '이미지 파일이 아닙니다' });
        setUploadProgress((prev) =>
          prev.map((p) => (p.fileName === file.name ? { ...p, status: 'error', progress: 0 } : p))
        );
        continue;
      }

      // Determine folder based on filename pattern
      const isLogo = file.name.startsWith('LI_');
      const folder = isLogo ? 'logo' : 'background';

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        // XMLHttpRequest로 진행률 추적
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploadProgress((prev) =>
                prev.map((p) => (p.fileName === file.name ? { ...p, progress: percent } : p))
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress((prev) =>
                prev.map((p) => (p.fileName === file.name ? { ...p, status: 'done', progress: 100 } : p))
              );
              resolve();
            } else {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || '업로드 실패'));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('네트워크 오류')));

          xhr.open('POST', '/api/local/upload');
          xhr.send(formData);
        });

        newResults.push({
          name: file.name,
          status: 'ok',
          message: '업로드 완료',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '업로드 실패';
        newResults.push({ name: file.name, status: 'error', message });
        setUploadProgress((prev) =>
          prev.map((p) => (p.fileName === file.name ? { ...p, status: 'error', progress: 0 } : p))
        );
      }
    }

    setResults(newResults);
    setUploading(false);
    
    // 업로드 완료 후 파일 목록 새로고침
    setTimeout(() => {
      loadUploadedFiles();
      onUploadComplete?.();
      setUploadProgress([]);
    }, 2000);
  }, [loadUploadedFiles, onUploadComplete]);

  const deleteFile = useCallback(async (fileName: string, folder: string) => {
    if (!confirm(`"${fileName}"을(를) 삭제하시겠습니까?`)) return;

    try {
      const encodedFolder = encodeURIComponent(folder);
      await apiFetch(`/local/files/${fileName}?folder=${encodedFolder}`, { method: 'DELETE' });
      setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName || f.folder !== folder));
      onUploadComplete?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  }, [onUploadComplete]);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      border: '1px solid #333',
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#fff' }}>
        📤 이미지 업로드
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? '#e50914' : '#444'}`,
          borderRadius: 10,
          padding: 32,
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#2a0a0c' : '#0a0a0a',
          transition: 'all 0.2s',
          fontSize: 13,
          color: '#b3b3b3',
        }}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div style={{ color: '#e50914' }}>⏳ 업로드 중...</div>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 6 }}>
              이미지 파일을 여기에 드래그하거나 클릭하여 선택
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              LI_로 시작하면 로고 폴더, 그 외는 배경이미지 폴더에 업로드됩니다
            </div>
          </>
        )}
      </div>

      {/* 업로드 진행률 */}
      {uploadProgress.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {uploadProgress.map((p) => (
            <div key={p.fileName} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 6,
                color: '#b3b3b3',
              }}>
                <span style={{ fontWeight: 500 }}>{p.fileName}</span>
                <span style={{
                  color: p.status === 'done' ? '#4ade80' : p.status === 'error' ? '#f87171' : '#e50914',
                }}>
                  {p.status === 'done' ? '✅ 완료' : p.status === 'error' ? '❌ 실패' : `${p.progress}%`}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: 6,
                background: '#2a2a2a',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${p.progress}%`,
                  height: '100%',
                  background: p.status === 'error' ? '#f87171' : p.status === 'done' ? '#4ade80' : '#e50914',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && uploadProgress.length === 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              fontSize: 11,
              borderBottom: '1px solid #2a2a2a',
              color: '#b3b3b3',
            }}>
              <span>{r.status === 'ok' ? '✅' : '❌'}</span>
              <span style={{ flex: 1 }}>{r.name}</span>
              <span style={{ color: r.status === 'ok' ? '#4ade80' : '#f87171' }}>{r.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      <div style={{ marginTop: 24, borderTop: '1px solid #333', paddingTop: 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            📂 업로드된 파일 ({uploadedFiles.length})
          </div>
          <button
            onClick={loadUploadedFiles}
            disabled={loadingFiles}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              border: '1px solid #444',
              borderRadius: 6,
              background: '#2a2a2a',
              color: '#b3b3b3',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3a3a3a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2a2a2a';
            }}
          >
            {loadingFiles ? '⏳' : '🔄'} 새로고침
          </button>
        </div>

        {uploadedFiles.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
            업로드된 파일이 없습니다
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  fontSize: 11,
                  borderBottom: '1px solid #2a2a2a',
                  background: '#1a1a1a',
                  borderRadius: 6,
                  marginBottom: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2a2a2a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                }}
              >
                <span style={{ fontSize: 18 }}>
                  {file.folder === '로고' ? '🏷️' : '🖼️'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#fff', marginBottom: 2 }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {file.folder} · {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={() => deleteFile(file.name, file.folder)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    border: '1px solid #8a1a1f',
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  🗑️ 삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
