// ============================================================
// 공통 데이터 모델 및 타입 정의
// 설계 문서의 모든 인터페이스/타입을 공유 타입 파일로 작성
// ============================================================

// ------------------------------------------------------------
// 뱃지 관련 타입 및 상수
// ------------------------------------------------------------

/** 20종 유효 뱃지 이름 목록 */
export const VALID_BADGES = [
  '무료', 'UHD', 'AI 보이스', '사전예약', '할인',
  '프리미엄무료', '가격인하', '소장', 'HD', '우리말',
  '예고편', '가치봄-자막+수어', 'Dolby ATMOS', 'Dolby VISION',
  'Dolby VISION-ATMOS', '이벤트', 'U+독점', 'U+오리지널',
  'U+STAGE', '유플레이',
] as const;

/** 유효한 뱃지 이름 유니온 타입 */
export type ValidBadgeName = typeof VALID_BADGES[number];

/** 뱃지 정보 */
export interface BadgeInfo {
  name: ValidBadgeName;
  position: number; // 1~4
}

// ------------------------------------------------------------
// 스프레드시트 행 데이터
// ------------------------------------------------------------

/** 스프레드시트 행 데이터 */
export interface CardNewsRow {
  rowIndex: number;           // 스프레드시트 행 번호 (1-based)
  movieTitle: string;         // 영화/드라마 제목
  mainText: string;           // 기본문구 (줄바꿈 포함 가능, 최대 3줄)
  subText: string;            // 추가문구 (빈 값 가능)
  badge1: string;             // 뱃지 1 (빈 값 가능)
  badge2: string;             // 뱃지 2 (빈 값 가능)
  badge3: string;             // 뱃지 3 (빈 값 가능)
  badge4: string;             // 뱃지 4 (빈 값 가능)
  copyright: string;          // 카피라이트 (빈 값 가능)
  // 파일명은 영화제목 + 패턴으로 자동 생성됨 (수동 오버라이드 가능)
  backgroundFilenameOverride?: string;  // 수동 지정 시 사용
  logoFilenameOverride?: string;        // 수동 지정 시 사용
}

// ------------------------------------------------------------
// 바운딩박스 및 오버플로우 검증
// ------------------------------------------------------------

/** 바운딩박스 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 오버플로우 검증 결과 */
export interface OverflowResult {
  isOverflowing: boolean;
  textBounds: BoundingBox;
  parentBounds: BoundingBox;
  overflowX: number; // 초과 픽셀 (0이면 정상)
  overflowY: number;
}

// ------------------------------------------------------------
// 내보내기 결과
// ------------------------------------------------------------

/** 내보내기 결과 */
export interface ExportResult {
  success: boolean;
  filename: string;
  quality: number;         // 최종 적용된 품질 (70~80)
  fileSize: number;        // 바이트
  sizeWarning: boolean;    // 70%에서도 500KB 초과 시 true
}

// ------------------------------------------------------------
// 히스토리 관련 타입
// ------------------------------------------------------------

/** 히스토리 파일 정보 */
export interface HistoryFile {
  filename: string;
  movieTitle: string;
  rowIndex: number;
}

/** 히스토리 오류 정보 */
export interface HistoryError {
  rowIndex: number;
  movieTitle: string;
  errorType: 'BADGE_INVALID' | 'FILE_NOT_FOUND' | 'TEXT_OVERFLOW' |
             'LINE_LIMIT' | 'API_ERROR' | 'RENDER_ERROR';
  message: string;
}

/** 히스토리 기록 */
export interface HistoryRecord {
  id: string;              // UUID
  createdAt: string;       // ISO 8601
  totalCount: number;      // 생성 시도 수
  successCount: number;    // 성공 수
  errorCount: number;      // 오류 수
  files: HistoryFile[];    // 생성된 파일 목록
  errors: HistoryError[];  // 오류 목록
}

// ------------------------------------------------------------
// 생성 진행 상태
// ------------------------------------------------------------

/** 행 처리 결과 */
export interface RowResult {
  rowIndex: number;
  movieTitle: string;
  status: 'success' | 'error' | 'warning';
  error?: string;
  sizeWarning?: boolean;
}

/** 생성 진행 상태 */
export interface GenerationProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentRow: number;
  totalRows: number;
  currentStep: string;     // '데이터 검증', '이미지 로드', 'Figma 수정', '렌더링', '업로드'
  results: RowResult[];
  rateLimit?: {
    waiting: boolean;
    retryAfter: number;    // 초
  };
}

// ------------------------------------------------------------
// 템플릿 관련 타입
// ------------------------------------------------------------

/** Figma 템플릿 레이어 이름 규칙 */
export interface TemplateLayerNames {
  background: string;      // 기본값: 'bg_image'
  logo: string;            // 기본값: 'logo'
  mainText: string;        // 기본값: 'main_text'
  subText: string;         // 기본값: 'sub_text'
  copyright: string;       // 기본값: 'copyright'
  badgeContainer: string;  // 기본값: 'badge_container'
}

/** 기본 레이어 이름 */
export const DEFAULT_LAYER_NAMES: TemplateLayerNames = {
  background: 'bg_image',
  logo: 'logo',
  mainText: 'main_text',
  subText: 'sub_text',
  copyright: 'copyright',
  badgeContainer: 'badge_container',
};

/** 레이어 스펙 */
export interface LayerSpec {
  nodeId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

/** 템플릿 스펙 캐시 */
export interface TemplateSpec {
  templateNodeId: string;
  layers: {
    background: LayerSpec;
    logo: LayerSpec;
    mainText: LayerSpec;
    subText: LayerSpec;
    copyright: LayerSpec;
    badgeContainer: LayerSpec;
  };
  cachedAt: number; // timestamp
}

// ------------------------------------------------------------
// 애플리케이션 설정
// ------------------------------------------------------------

/** 이미지 사이즈 프리셋 */
export interface ImageSizePreset {
  name: string;           // 프리셋 이름 (예: 'U+ IPTV', 'Full HD')
  width: number;
  height: number;
  templateNodeId: string; // 해당 사이즈에 맞는 Figma 템플릿 프레임 ID
}

/** 기본 이미지 사이즈 프리셋 */
export const DEFAULT_SIZE_PRESET: ImageSizePreset = {
  name: 'U+ IPTV',
  width: 808,
  height: 454,
  templateNodeId: '', // 설정 마법사에서 지정
};

/** 이미지 파일명 패턴 설정 */
export interface FileNamingPattern {
  backgroundPattern: string;  // 기본값: '{title}.jpg' — {title}이 영화제목으로 치환됨
  logoPattern: string;        // 기본값: 'LI_{title}.png'
}

/** 기본 파일명 패턴 */
export const DEFAULT_FILE_NAMING: FileNamingPattern = {
  backgroundPattern: '{title}.jpg',
  logoPattern: 'LI_{title}.png',
};

/** 애플리케이션 설정 */
export interface AppConfig {
  google: {
    serviceAccountKey: object;  // JSON 키 파일 내용
    spreadsheetId: string;
  };
  figma: {
    accessToken: string;
    fileKey: string;            // Figma 파일 URL에서 추출
    templateNodeId: string;     // 설정 마법사에서 드롭다운 선택
  };
  template: {
    layerNames: TemplateLayerNames;  // 레이어 이름 규칙 (기본값 제공)
  };
  fileNaming: FileNamingPattern;     // 이미지 파일명 패턴
  sizePresets: ImageSizePreset[];    // 이미지 사이즈 프리셋 목록 (첫 번째가 기본값)
  server: {
    port: number;              // 기본값: 3000
  };
}
