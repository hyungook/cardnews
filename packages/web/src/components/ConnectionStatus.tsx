import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface StatusState {
  config: 'ok' | 'error' | 'loading';
  figma: 'ok' | 'error' | 'loading';
}

export default function ConnectionStatus() {
  const [status, setStatus] = useState<StatusState>({ config: 'loading', figma: 'loading' });
  const [showDetail, setShowDetail] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const response = await apiFetch<{ success: boolean; data: { configured: boolean; valid: boolean } }>('/config/status');
      // configured가 true면 설정됨으로 표시 (templateNodeId 없어도 OK)
      setStatus((prev) => ({ ...prev, config: response.data.configured ? 'ok' : 'error' }));
    } catch {
      setStatus((prev) => ({ ...prev, config: 'error' }));
    }

    try {
      const response = await apiFetch<{ success: boolean; data: { pluginConnected: boolean } }>('/config/plugin-status');
      setStatus((prev) => ({ ...prev, figma: response.data.pluginConnected ? 'ok' : 'error' }));
    } catch {
      setStatus((prev) => ({ ...prev, figma: 'error' }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // 10초마다 체크
    return () => clearInterval(interval);
  }, [checkStatus]);

  const allOk = status.config === 'ok' && status.figma === 'ok';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDetail(!showDetail)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          border: '1px solid #333',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
          fontSize: 12,
          cursor: 'pointer',
          color: '#e5e5e5',
          transition: 'all 0.2s',
        }}
        title="연결 상태 확인"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
        }}
      >
        <span style={{ fontSize: 10, color: allOk ? '#4ade80' : '#f87171' }}>●</span>
        {allOk ? '연결됨' : '확인 필요'}
      </button>

      {showDetail && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setShowDetail(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            border: '1px solid #333',
            borderRadius: 10,
            padding: 16,
            width: 260,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            zIndex: 100,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: '#ffffff' }}>연결 상태</div>

            <StatusRow label="Google API" status={status.config} hint="설정 페이지에서 Google Cloud JSON 키를 등록하세요" />
            <StatusRow label="Figma 플러그인" status={status.figma} hint="Figma 데스크톱 앱에서 Plugins → Development → 카드뉴스 자동화를 실행하세요" />

            <button
              onClick={checkStatus}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: 6,
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                fontSize: 12,
                cursor: 'pointer',
                color: '#e5e5e5',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
              }}
            >
              🔄 다시 확인
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({ label, status, hint }: { label: string; status: string; hint: string }) {
  const isOk = status === 'ok';
  const isLoading = status === 'loading';

  // 라벨별 상태 메시지 커스터마이징
  let statusText = '';
  if (isLoading) {
    statusText = '확인 중';
  } else if (isOk) {
    statusText = '설정됨';
  } else {
    // Google API는 "미설정", Figma는 "플러그인 실행 필요"
    statusText = label === 'Figma 플러그인' ? '실행 필요' : '미설정';
  }

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{isLoading ? '⏳' : isOk ? '🟢' : '🔴'}</span>
        <span style={{ flex: 1, color: '#4a4a4a', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: isOk ? '#4ade80' : '#f87171' }}>
          {statusText}
        </span>
      </div>
      {!isOk && !isLoading && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, paddingLeft: 24 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
