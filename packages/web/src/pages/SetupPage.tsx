import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { apiFetch } from '../api/client';
import styles from './SetupPage.module.css';

/* ── URL ID extraction (client-side, mirrors server utils) ── */

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractFolderId(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractFigmaFileKey(url: string): string | null {
  const m = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/* ── Types ── */

interface FigmaFrame {
  nodeId: string;
  name: string;
}

interface ValidationResult {
  valid: boolean;
  missingLayers: string[];
  foundLayers: string[];
}

interface ConnectionResults {
  googleSheets: { connected: boolean };
  figma: { connected: boolean };
}

const STEP_LABELS = [
  'Google Cloud',
  'Google Sheets',
  'Figma 토큰',
  'Figma 파일',
  '연결 테스트',
];

const TOTAL_STEPS = STEP_LABELS.length;

/* ── Component ── */

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Step 1: Google Cloud
  const [serviceAccountKey, setServiceAccountKey] = useState<object | null>(null);
  const [keyFileName, setKeyFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Google Sheets
  const [sheetUrl, setSheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  // Step 3: Figma Token
  const [figmaToken, setFigmaToken] = useState('');

  // Step 4: Figma File
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaFileKey, setFigmaFileKey] = useState<string | null>(null);
  const [frames, setFrames] = useState<FigmaFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState('');
  const [framesLoading, setFramesLoading] = useState(false);
  const [framesError, setFramesError] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Step 5: Connection Test
  const [testResults, setTestResults] = useState<ConnectionResults | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  /* ── Load existing config on mount ── */
  const loadExistingConfig = useCallback(async () => {
    try {
      console.log('[SetupPage] 기존 설정 로드 시작');
      const response = await apiFetch<{
        success: boolean;
        data: {
          configured: boolean;
          config?: {
            google?: {
              serviceAccountKey?: object;
              spreadsheetId?: string;
              driveFolderId?: string;
            };
            figma?: {
              accessToken?: string;
              fileKey?: string;
              templateNodeId?: string;
            };
          };
        };
      }>('/config/load');

      console.log('[SetupPage] API 응답:', response);

      // response.data가 실제 데이터
      const data = response.data;
      
      if (data.configured && data.config) {
        const cfg = data.config;
        console.log('[SetupPage] 설정 데이터:', cfg);

        let lastCompletedStep = -1;

        // Google
        if (cfg.google?.serviceAccountKey) {
          console.log('[SetupPage] Google 서비스 계정 키 로드');
          setServiceAccountKey(cfg.google.serviceAccountKey);
          setKeyFileName('(기존 설정)');
          lastCompletedStep = 0;
        }
        if (cfg.google?.spreadsheetId) {
          console.log('[SetupPage] Google 스프레드시트 ID 로드:', cfg.google.spreadsheetId);
          setSpreadsheetId(cfg.google.spreadsheetId);
          setSheetUrl(`https://docs.google.com/spreadsheets/d/${cfg.google.spreadsheetId}`);
          lastCompletedStep = 1;
        }

        // Figma
        if (cfg.figma?.accessToken) {
          console.log('[SetupPage] Figma 액세스 토큰 로드');
          setFigmaToken(cfg.figma.accessToken);
          lastCompletedStep = 2;
        }
        if (cfg.figma?.fileKey) {
          console.log('[SetupPage] Figma 파일 키 로드:', cfg.figma.fileKey);
          setFigmaFileKey(cfg.figma.fileKey);
          setFigmaUrl(`https://www.figma.com/design/${cfg.figma.fileKey}/`);
          lastCompletedStep = 3;
          
          // templateNodeId가 있으면 자동으로 설정 (프레임 목록 조회는 사용자가 수동으로)
          if (cfg.figma?.templateNodeId && cfg.figma.templateNodeId.trim() !== '') {
            console.log('[SetupPage] Figma 템플릿 노드 ID 로드:', cfg.figma.templateNodeId);
            setSelectedFrame(cfg.figma.templateNodeId);
            // templateNodeId가 있으면 4단계까지 완료된 것으로 간주
            lastCompletedStep = 4;
          }
        }

        setConfigLoaded(true);
        
        // 마지막 완료된 단계의 다음 단계로 이동
        if (lastCompletedStep >= 0) {
          const nextStep = Math.min(lastCompletedStep + 1, TOTAL_STEPS - 1);
          console.log('[SetupPage] 자동으로 단계 이동:', nextStep);
          setStep(nextStep);
        }
        
        console.log('[SetupPage] 기존 설정 로드 완료');
      } else {
        console.log('[SetupPage] 설정이 없거나 configured=false');
      }
    } catch (error) {
      console.error('[SetupPage] 설정 로드 실패:', error);
      // 설정 없으면 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingConfig();
  }, [loadExistingConfig]);

  /* ── JSON key file handling ── */

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        setServiceAccountKey(parsed);
        setKeyFileName(file.name);
      } catch {
        alert('유효한 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /* ── URL change handlers ── */

  const onSheetUrlChange = (v: string) => {
    setSheetUrl(v);
    setSpreadsheetId(extractSpreadsheetId(v));
  };

  const onFigmaUrlChange = (v: string) => {
    setFigmaUrl(v);
    const key = extractFigmaFileKey(v);
    setFigmaFileKey(key);
    // Reset downstream state when URL changes
    setFrames([]);
    setSelectedFrame('');
    setValidation(null);
    setFramesError('');
  };

  /* ── Fetch Figma frames ── */

  const fetchFrames = async () => {
    if (!figmaFileKey || !figmaToken) return;
    setFramesLoading(true);
    setFramesError('');
    setFrames([]);
    setSelectedFrame('');
    setValidation(null);

    try {
      // 부분 설정 저장 (유효성 검증 없이) — templateNodeId가 아직 없으므로 setup-partial 사용
      await apiFetch('/config/setup-partial', {
        method: 'POST',
        body: JSON.stringify(buildConfig()),
      });

      const response = await apiFetch<{ 
        success: boolean; 
        data: { frames: FigmaFrame[] } 
      }>('/figma/frames');
      
      setFrames(response.data?.frames || []);
    } catch (err) {
      setFramesError(err instanceof Error ? err.message : '프레임 목록 조회 실패');
      setFrames([]);
    } finally {
      setFramesLoading(false);
    }
  };

  /* ── Validate template ── */

  const validateTemplate = async (frameNodeId: string) => {
    console.log('[SetupPage] validateTemplate 시작:', frameNodeId);
    setValidating(true);
    setValidation(null);
    try {
      const response = await apiFetch<{
        success: boolean;
        data: {
          valid: boolean;
          missingLayers: string[];
          foundLayers: string[];
        };
      }>('/figma/validate-template', {
        method: 'POST',
        body: JSON.stringify({ frameNodeId }),
      });
      
      console.log('[SetupPage] validateTemplate 응답:', response);
      const data = response.data;
      
      setValidation({
        valid: data.valid,
        missingLayers: data.missingLayers,
        foundLayers: data.foundLayers,
      });
    } catch (err) {
      console.error('[SetupPage] validateTemplate 오류:', err);
      setValidation({
        valid: false,
        missingLayers: [],
        foundLayers: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const onFrameSelect = (nodeId: string) => {
    console.log('[SetupPage] onFrameSelect:', nodeId);
    setSelectedFrame(nodeId);
    setValidation(null);
    if (nodeId) {
      validateTemplate(nodeId);
    }
  };

  /* ── Build config ── */

  const buildConfig = () => ({
    google: {
      serviceAccountKey: serviceAccountKey ?? {},
      spreadsheetId: spreadsheetId ?? '',
    },
    figma: {
      accessToken: figmaToken,
      fileKey: figmaFileKey ?? '',
      templateNodeId: selectedFrame,
    },
    template: {
      layerNames: {
        background: 'bg_image',
        logo: 'logo',
        mainText: 'main_text',
        subText: 'sub_text',
        copyright: 'copyright',
        badgeContainer: 'badge_container',
      },
    },
    fileNaming: {
      backgroundPattern: '{title}.jpg',
      logoPattern: 'LI_{title}.png',
    },
    server: { port: 3000 },
  });

  /* ── Connection test ── */

  const runConnectionTest = async () => {
    setTesting(true);
    setTestResults(null);
    setTestError('');
    try {
      // 연결 테스트만 수행 (설정 저장하지 않음)
      const response = await apiFetch<{
        success: boolean;
        data: {
          results: ConnectionResults;
        };
      }>('/config/test-connection', { method: 'POST' });
      
      setTestResults(response.data?.results || { googleSheets: { connected: false }, figma: { connected: false } });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : '연결 테스트 실패');
      setTestResults({ googleSheets: { connected: false }, figma: { connected: false } });
    } finally {
      setTesting(false);
    }
  };

  /* ── Complete setup ── */

  const completeSetup = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // templateNodeId가 없으면 부분 설정 저장 사용
      if (!selectedFrame || selectedFrame.trim() === '') {
        await apiFetch('/config/setup-partial', {
          method: 'POST',
          body: JSON.stringify(buildConfig()),
        });
      } else {
        await apiFetch('/config/setup', {
          method: 'POST',
          body: JSON.stringify(buildConfig()),
        });
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  /* ── Navigation helpers ── */

  const canGoNext = (): boolean => {
    switch (step) {
      case 0: return serviceAccountKey !== null;
      case 1: return spreadsheetId !== null;
      case 2: return figmaToken.trim().length > 0;
      case 3: {
        // selectedFrame이 있고, 검증이 완료되었거나 아직 검증하지 않은 경우
        const canGo = selectedFrame !== '' && (validation?.valid === true || validation === null);
        console.log('[SetupPage] canGoNext (step 3):', {
          selectedFrame,
          validation,
          canGo,
        });
        return canGo;
      }
      case 4: return true;
      default: return false;
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));

  /* ── Render steps ── */

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderGoogleCloudStep();
      case 1:
        return renderSheetsStep();
      case 2:
        return renderFigmaTokenStep();
      case 3:
        return renderFigmaFileStep();
      case 4:
        return renderConnectionTestStep();
      default:
        return null;
    }
  };

  /* ── Step 1: Google Cloud ── */
  const renderGoogleCloudStep = () => (
    <>
      <h2 className={styles.stepTitle}>🔑 Google Cloud 설정</h2>
      <p className={styles.stepSubtitle}>아래 순서대로 천천히 따라하세요. 처음 한 번만 하면 됩니다!</p>

      <div className={styles.guide}>
        <p style={{ fontWeight: 600, marginBottom: 12, color: '#fbbf24' }}>📌 Step 1. 구글 클라우드 프로젝트 만들기</p>
        <ol>
          <li>
            <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
              👉 이 링크를 클릭
            </a>
            하여 Google Cloud Console에 접속합니다. (구글 계정으로 로그인)
          </li>
          <li>화면 상단 왼쪽에 <strong>"프로젝트 선택"</strong> 버튼을 클릭합니다.</li>
          <li>팝업 오른쪽 위의 <strong>"새 프로젝트"</strong> 버튼을 클릭합니다.</li>
          <li>프로젝트 이름에 <strong>"카드뉴스자동화"</strong> 라고 입력하고 <strong>"만들기"</strong>를 클릭합니다.</li>
          <li>잠시 기다리면 프로젝트가 생성됩니다. (상단에 프로젝트 이름이 보이면 성공!)</li>
        </ol>

        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 20, color: '#fbbf24' }}>📌 Step 2. API 켜기 (1개)</p>
        <ol>
          <li>
            <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noreferrer">
              👉 Google Sheets API 켜기 링크
            </a>
            를 클릭하고, 파란색 <strong>"사용"</strong> 버튼을 클릭합니다.
          </li>
          <li>"사용" 버튼이 "관리"로 바뀌면 성공!</li>
        </ol>

        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 20, color: '#fbbf24' }}>📌 Step 3. 서비스 계정 만들기 (열쇠 파일 받기)</p>
        <ol>
          <li>
            <a href="https://console.cloud.google.com/iam-admin/serviceaccounts/create" target="_blank" rel="noreferrer">
              👉 서비스 계정 만들기 링크
            </a>
            를 클릭합니다.
          </li>
          <li>서비스 계정 이름에 <strong>"cardnews"</strong> 라고 입력합니다.</li>
          <li><strong>"만들고 계속하기"</strong> 버튼을 클릭합니다.</li>
          <li>역할 선택은 건너뛰고 <strong>"계속"</strong>을 클릭합니다.</li>
          <li><strong>"완료"</strong>를 클릭합니다.</li>
          <li>방금 만든 <strong>"cardnews@..."</strong> 이메일을 클릭합니다.</li>
          <li>상단 탭에서 <strong>"키"</strong> 탭을 클릭합니다.</li>
          <li><strong>"키 추가"</strong> → <strong>"새 키 만들기"</strong>를 클릭합니다.</li>
          <li><strong>"JSON"</strong>이 선택된 상태에서 <strong>"만들기"</strong>를 클릭합니다.</li>
          <li>🎉 JSON 파일이 자동으로 다운로드됩니다! 이 파일을 아래에 업로드하세요.</li>
        </ol>

        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 20, color: '#fbbf24' }}>📌 Step 4. 서비스 계정 이메일 복사하기 (나중에 필요!)</p>
        <ol>
          <li>다운로드된 JSON 파일을 메모장으로 열면 <strong>"client_email"</strong> 항목이 있습니다.</li>
          <li>예: <code>cardnews@카드뉴스자동화.iam.gserviceaccount.com</code></li>
          <li>이 이메일을 복사해두세요. 다음 단계에서 구글 시트를 이 이메일에 공유해야 합니다.</li>
        </ol>
      </div>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''} ${serviceAccountKey ? styles.dropzoneDone : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropzoneIcon}>{serviceAccountKey ? '✅' : '📁'}</div>
        {serviceAccountKey ? (
          <div>{keyFileName}</div>
        ) : (
          <>
            <div>JSON 키 파일을 여기에 드래그하거나 클릭하여 선택</div>
            <div className={styles.dropzoneHint}>.json 파일만 지원됩니다</div>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </>
  );

  /* ── Step 2: Google Sheets ── */
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetCreated, setSheetCreated] = useState(false);

  const createTemplateSheet = async () => {
    setCreatingSheet(true);
    try {
      // JSON 키만 있으면 시트 생성 가능 — 부분 설정을 직접 저장
      const partialConfig = {
        google: {
          serviceAccountKey: serviceAccountKey ?? {},
          spreadsheetId: '',
          driveFolderId: '',
        },
        figma: { accessToken: '', fileKey: '', templateNodeId: '' },
        template: {
          layerNames: {
            background: 'bg_image', logo: 'logo', mainText: 'main_text',
            subText: 'sub_text', copyright: 'copyright', badgeContainer: 'badge_container',
          },
        },
        fileNaming: { backgroundPattern: '{title}.jpg', logoPattern: 'LI_{title}.png' },
        sizePresets: [{ name: 'U+ IPTV', width: 808, height: 454, templateNodeId: '' }],
        server: { port: 3000 },
      };

      // 부분 설정 저장 (유효성 검증 없이 강제 저장)
      await fetch('/api/config/setup-partial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialConfig),
      });

      const response = await apiFetch<{ 
        success: boolean; 
        data: { 
          spreadsheetUrl: string; 
          spreadsheetId: string;
        } 
      }>('/sheets/create-template', { method: 'POST' });
      
      const data = response.data;
      setSheetUrl(data.spreadsheetUrl || '');
      setSpreadsheetId(data.spreadsheetId || '');
      setSheetCreated(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '시트 생성 실패. JSON 키 파일이 올바른지 확인해주세요.');
    } finally {
      setCreatingSheet(false);
    }
  };

  const renderSheetsStep = () => (
    <>
      <h2 className={styles.stepTitle}>📊 Google Sheets 연결</h2>
      <p className={styles.stepSubtitle}>카드뉴스 데이터를 입력할 스프레드시트를 연결합니다</p>

      <div className={styles.guide}>
        <p style={{ fontWeight: 600, marginBottom: 8, color: '#fbbf24' }}>방법 1: 템플릿 시트 자동 생성 (추천 👍)</p>
        <p style={{ marginBottom: 12, fontSize: 13 }}>
          아래 버튼을 클릭하면 카드뉴스용 스프레드시트가 자동으로 만들어집니다.
          헤더와 히스토리 탭이 미리 설정되어 있어요.
        </p>
        <button
          className={styles.btnPrimary}
          onClick={createTemplateSheet}
          disabled={creatingSheet || sheetCreated || !serviceAccountKey}
          style={{ marginBottom: 16, width: '100%' }}
        >
          {creatingSheet ? '생성 중...' : sheetCreated ? '✅ 시트가 생성되었습니다' : '📋 카드뉴스 템플릿 시트 자동 생성'}
        </button>
        {!serviceAccountKey && (
          <p style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>
            ⚠️ 이전 단계에서 JSON 키 파일을 먼저 업로드해주세요.
          </p>
        )}

        <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, color: '#fbbf24' }}>방법 2: 기존 스프레드시트 사용</p>
        <p style={{ marginBottom: 8, fontSize: 13 }}>
          이미 만들어둔 스프레드시트가 있다면 URL을 아래에 붙여넣으세요.
          첫 번째 행은 헤더여야 하고, 컬럼 순서는 아래와 같아야 합니다:
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table className={styles.layerTable}>
            <thead>
              <tr>
                <th>A</th><th>B</th><th>C</th><th>D</th>
                <th>E</th><th>F</th><th>G</th><th>H</th>
                <th>I (선택)</th><th>J (선택)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>영화제목</td><td>기본문구</td><td>추가문구</td><td>뱃지1</td>
                <td>뱃지2</td><td>뱃지3</td><td>뱃지4</td><td>카피라이트</td>
                <td>배경파일명(수동)</td><td>로고파일명(수동)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>
          💡 배경/로고 파일명은 영화제목으로 자동 생성됩니다 (예: 가나다 → 가나다.jpg, LI_가나다.png).<br/>
          파일명이 다른 경우에만 I, J열에 수동 입력하세요.
        </p>
        <p style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>
          💡 "히스토리"라는 이름의 시트 탭도 필요합니다. (생성 이력이 여기에 기록됩니다)
        </p>

        <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, color: '#e67e22' }}>
          ⚠️ 중요: 스프레드시트를 서비스 계정에 공유하세요!
        </p>
        <ol style={{ fontSize: 13 }}>
          <li>스프레드시트를 열고 오른쪽 위 <strong>"공유"</strong> 버튼을 클릭합니다.</li>
          <li>이전 단계에서 복사한 서비스 계정 이메일을 붙여넣습니다.</li>
          <li>권한을 <strong>"편집자"</strong>로 설정하고 <strong>"보내기"</strong>를 클릭합니다.</li>
        </ol>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>스프레드시트 URL</label>
        <input
          className={styles.input}
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={(e) => onSheetUrlChange(e.target.value)}
        />
        {spreadsheetId && (
          <div className={styles.extractedId}>
            ✅ 추출된 ID: {spreadsheetId}
          </div>
        )}
      </div>
    </>
  );

  /* ── Step 3: Figma Token ── */
  const renderFigmaTokenStep = () => (
    <>
      <h2 className={styles.stepTitle}>🎨 Figma API 토큰</h2>
      <p className={styles.stepSubtitle}>Figma Personal Access Token을 발급하고 입력하세요</p>

      <div className={styles.guide}>
        <p style={{ fontWeight: 600, marginBottom: 12, color: '#fbbf24' }}>📌 Step 1. Figma 설정 페이지 열기</p>
        <ol>
          <li>
            <a href="https://www.figma.com" target="_blank" rel="noreferrer">
              👉 figma.com
            </a>
            에 로그인합니다.
          </li>
          <li>화면 왼쪽 위 <strong>프로필 아이콘(또는 이름)</strong>을 클릭합니다.</li>
          <li>드롭다운 메뉴에서 <strong>"Settings"</strong> (설정)을 클릭합니다.</li>
        </ol>

        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 20, color: '#fbbf24' }}>📌 Step 2. Personal Access Token 생성</p>
        <ol>
          <li>설정 페이지에서 스크롤을 내려 <strong>"Security"</strong> 섹션을 찾습니다.</li>
          <li><strong>"Personal access tokens"</strong> 항목에서 <strong>"Generate new token"</strong> 버튼을 클릭합니다.</li>
          <li>토큰 이름을 입력합니다. (예: <code>카드뉴스자동화</code>)</li>
          <li><strong>Expiration(만료일)</strong>을 설정합니다. 장기 사용이라면 <strong>"No expiration"</strong>을 선택하세요.</li>
          <li>
            <strong>Scopes(권한 범위)</strong>를 설정합니다. 아래 항목을 선택하세요:
            <div style={{
              background: '#f0f7ff',
              border: '1px solid #b3d4ff',
              borderRadius: 8,
              padding: '10px 14px',
              marginTop: 8,
              marginBottom: 4,
            }}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>✅ 선택해야 할 항목</div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #b3d4ff' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Scope</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Read</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Write</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>용도</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px' }}><strong>File content</strong></td>
                    <td style={{ padding: '4px 8px' }}>✅ 체크</td>
                    <td style={{ padding: '4px 8px' }}>✅ 체크</td>
                    <td style={{ padding: '4px 8px' }}>프레임 조회, 레이어 수정, 이미지 내보내기</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
                나머지 항목(Variables, Webhooks 등)은 선택하지 않아도 됩니다.
              </div>
            </div>
          </li>
          <li><strong>"Generate token"</strong> 버튼을 클릭합니다.</li>
        </ol>

        <p style={{ fontWeight: 600, marginBottom: 12, marginTop: 20, color: '#fbbf24' }}>📌 Step 3. 토큰 복사 후 아래에 붙여넣기</p>
        <ol>
          <li>생성된 토큰이 화면에 표시됩니다. (<code>figd_</code>로 시작하는 긴 문자열)</li>
          <li>복사 버튼을 클릭하여 토큰을 복사합니다.</li>
          <li>아래 입력란에 붙여넣으세요.</li>
        </ol>

        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 8,
          padding: '10px 14px',
          marginTop: 16,
          fontSize: 13,
        }}>
          ⚠️ <strong>주의:</strong> 이 화면을 닫으면 토큰을 다시 볼 수 없습니다! 반드시 복사한 직후 아래에 붙여넣으세요.
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Access Token</label>
        <input
          className={styles.inputPassword}
          type="password"
          placeholder="figd_..."
          value={figmaToken}
          onChange={(e) => setFigmaToken(e.target.value)}
        />
        {figmaToken.trim().length > 0 && (
          <div className={styles.extractedId}>✅ 토큰이 입력되었습니다.</div>
        )}
      </div>
    </>
  );

  /* ── Step 5: Figma File ── */
  const renderFigmaFileStep = () => (
    <>
      <h2 className={styles.stepTitle}>Figma 파일 및 템플릿</h2>
      <p className={styles.stepSubtitle}>Figma 파일 URL을 입력하고 템플릿 프레임을 선택하세요</p>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Figma 파일 URL</label>
        <input
          className={styles.input}
          type="url"
          placeholder="https://www.figma.com/design/..."
          value={figmaUrl}
          onChange={(e) => onFigmaUrlChange(e.target.value)}
        />
        {figmaFileKey && (
          <div className={styles.extractedId}>
            추출된 File Key: {figmaFileKey}
          </div>
        )}
      </div>

      {figmaFileKey && (
        <div className={styles.fieldGroup}>
          <button
            className={styles.btnPrimary}
            onClick={fetchFrames}
            disabled={framesLoading}
            style={{ marginBottom: 12 }}
          >
            {framesLoading ? (
              <><span className={styles.spinner} />프레임 목록 조회 중...</>
            ) : (
              '프레임 목록 조회'
            )}
          </button>

          {framesError && <div className={styles.validationError}>{framesError}</div>}

          {frames.length > 0 && (
            <>
              <label className={styles.label}>템플릿 프레임 선택</label>
              <select
                className={styles.select}
                value={selectedFrame}
                onChange={(e) => onFrameSelect(e.target.value)}
              >
                <option value="">프레임을 선택하세요</option>
                {frames.map((f) => (
                  <option key={f.nodeId} value={f.nodeId}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {validating && (
            <div style={{ marginTop: 12, color: '#cbd5e1', fontSize: 13 }}>
              <span className={styles.spinner} />레이어 검증 중...
            </div>
          )}

          {validation && !validating && (
            validation.valid ? (
              <div className={styles.validationOk}>
                ✅ 모든 필수 레이어가 확인되었습니다.
              </div>
            ) : (
              <div className={styles.validationError}>
                ❌ 누락된 레이어가 있습니다:
                <ul className={styles.missingList}>
                  {validation.missingLayers.map((l) => (
                    <li key={l}><code>{l}</code></li>
                  ))}
                </ul>
              </div>
            )
          )}

          {/* Layer naming guide */}
          <div className={styles.layerGuide}>
            <h4>📐 템플릿 레이어 이름 규칙</h4>
            <p style={{ marginBottom: 8, fontSize: 12, color: '#fde68a' }}>
              Figma 템플릿의 동적 레이어는 아래 이름을 정확히 사용해야 합니다.
            </p>
            <table className={styles.layerTable}>
              <thead>
                <tr>
                  <th>레이어 이름</th>
                  <th>역할</th>
                  <th>필수</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>bg_image</code></td><td>배경 이미지</td><td>✅</td></tr>
                <tr><td><code>logo</code></td><td>로고 이미지</td><td>✅</td></tr>
                <tr><td><code>main_text</code></td><td>기본문구 (최대 3줄)</td><td>✅</td></tr>
                <tr><td><code>sub_text</code></td><td>추가문구 (빈 값 시 숨김)</td><td>✅</td></tr>
                <tr><td><code>copyright</code></td><td>카피라이트 (빈 값 시 숨김)</td><td>✅</td></tr>
                <tr><td><code>badge_container</code></td><td>뱃지 컨테이너 (1~4개)</td><td>✅</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  /* ── Step 6: Connection Test ── */
  const renderConnectionTestStep = () => (
    <>
      <h2 className={styles.stepTitle}>연결 테스트</h2>
      <p className={styles.stepSubtitle}>모든 API 연결 상태를 확인합니다</p>

      <button
        className={styles.btnTest}
        onClick={runConnectionTest}
        disabled={testing}
      >
        {testing ? (
          <><span className={styles.spinner} />테스트 중...</>
        ) : (
          '🔌 연결 테스트 실행'
        )}
      </button>

      {testError && <div className={styles.validationError}>{testError}</div>}

      {testResults && (
        <div className={styles.testResults}>
          <TestRow
            label="Google Sheets"
            connected={testResults.googleSheets.connected}
            hint="스프레드시트를 서비스 계정 이메일에 공유했는지 확인하세요."
          />
          <TestRow
            label="Figma API"
            connected={testResults.figma.connected}
            hint="Figma Access Token이 유효한지 확인하세요."
          />
        </div>
      )}

      {saved && (
        <div className={styles.validationOk} style={{ marginTop: 16 }}>
          ✅ 설정이 저장되었습니다. 대시보드에서 카드뉴스를 생성할 수 있습니다.
        </div>
      )}

      {saveError && (
        <div className={styles.validationError} style={{ marginTop: 16 }}>
          {saveError}
        </div>
      )}
    </>
  );

  /* ── Main render ── */

  if (loading) {
    return (
      <div className={styles.wizard}>
        <div className={styles.header}>
          <h1>설정 불러오는 중...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.header}>
        <h1>설정 마법사</h1>
        <p>Google API, Figma API 연동 설정을 단계별로 안내합니다.</p>
        {configLoaded && (
          <div style={{
            marginTop: '16px',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0a3a0c 0%, #0f5a12 100%)',
            border: '2px solid #1a7a1f',
            borderRadius: '12px',
            fontSize: '14px',
            color: '#86efac',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <strong style={{ fontSize: '16px', color: '#4ade80' }}>기존 설정을 불러왔습니다!</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#d1fae5', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '8px' }}>
                ✓ Google 서비스 계정: {serviceAccountKey ? '설정됨' : '미설정'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                ✓ Google 스프레드시트: {spreadsheetId ? '설정됨' : '미설정'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                ✓ Figma 액세스 토큰: {figmaToken ? '설정됨' : '미설정'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                ✓ Figma 파일: {figmaFileKey ? '설정됨' : '미설정'}
              </div>
              <div>
                ✓ Figma 템플릿: {selectedFrame ? '설정됨' : '미설정 (선택 필요)'}
              </div>
            </div>
            <div style={{ 
              marginTop: '12px', 
              paddingTop: '12px', 
              borderTop: '1px solid #1a7a1f',
              fontSize: '12px',
              color: '#a7f3d0'
            }}>
              💡 필요한 항목만 수정하고 "다음" 버튼을 눌러 진행하세요.
            </div>
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className={styles.steps}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''} ${i < step ? styles.stepDotDone : ''}`}
            title={label}
          />
        ))}
      </div>

      {/* Card */}
      <div className={styles.card}>
        {renderStep()}

        {/* Navigation */}
        <div className={styles.nav}>
          <button
            className={styles.btnSecondary}
            onClick={prev}
            disabled={step === 0}
          >
            이전
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              className={styles.btnPrimary}
              onClick={next}
              disabled={!canGoNext()}
            >
              다음
            </button>
          ) : (
            <button
              className={styles.btnSuccess}
              onClick={completeSetup}
              disabled={saving || saved}
            >
              {saving ? '저장 중...' : saved ? '설정 완료 ✓' : '설정 완료'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function TestRow({
  label,
  connected,
  hint,
}: {
  label: string;
  connected: boolean;
  hint: string;
}) {
  return (
    <div>
      <div className={styles.testRow}>
        <span className={styles.testIcon}>{connected ? '✅' : '❌'}</span>
        <span className={styles.testLabel}>{label}</span>
        <span className={`${styles.testStatus} ${connected ? styles.testOk : styles.testFail}`}>
          {connected ? '연결됨' : '실패'}
        </span>
      </div>
      {!connected && <div className={styles.errorHint}>{hint}</div>}
    </div>
  );
}
