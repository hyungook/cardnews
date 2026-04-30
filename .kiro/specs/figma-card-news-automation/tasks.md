# 구현 계획: Figma 카드뉴스 자동화

## 개요

React + TypeScript 프론트엔드, Node.js + Express + TypeScript 백엔드, Figma 플러그인(TypeScript)으로 구성된 카드뉴스 자동화 시스템을 구현한다. WebSocket 브릿지를 통해 서버와 Figma 플러그인이 통신하며, Google API(Service Account)로 스프레드시트/드라이브를 연동한다. Vitest + fast-check으로 속성 기반 테스트를 병행한다.

## Tasks

- [x] 1. 프로젝트 구조 및 공통 타입/인터페이스 설정
  - [x] 1.1 모노레포 프로젝트 구조 생성
    - `packages/server` (백엔드), `packages/web` (프론트엔드), `packages/figma-plugin` (Figma 플러그인) 디렉토리 구조 생성
    - 루트 `package.json`, `tsconfig.json` 설정
    - Vitest, fast-check, TypeScript 등 공통 의존성 설치
    - _Requirements: 14.1_

  - [x] 1.2 공통 데이터 모델 및 타입 정의
    - `CardNewsRow`, `BadgeInfo`, `OverflowResult`, `ExportResult`, `HistoryRecord`, `GenerationProgress`, `AppConfig` 등 설계 문서의 모든 인터페이스/타입을 공유 타입 파일로 작성
    - `VALID_BADGES` 상수 배열 및 `ValidBadgeName` 타입 정의
    - _Requirements: 1.2, 4.1_

- [x] 2. 핵심 유틸리티 함수 구현 및 속성 테스트
  - [x] 2.1 스프레드시트 행 파싱/직렬화 함수 구현
    - `parseRow()`: 셀 배열 → `CardNewsRow` 변환 (빈 값, 줄바꿈 보존)
    - `serializeRow()`: `CardNewsRow` → 셀 배열 변환
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 2.2 속성 테스트: 스프레드시트 행 데이터 라운드트립
    - **Property 1: 스프레드시트 행 데이터 라운드트립**
    - fast-check으로 임의의 문자열 배열(빈 값, 줄바꿈 포함) 생성 → `parseRow()` → `serializeRow()` → 원본과 동일 검증
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

  - [x] 2.3 뱃지 정규화 및 Variant 결정 함수 구현
    - `normalizeBadgeName()`: 대소문자 무시, 앞뒤 공백 제거 후 20종 매칭
    - `determineBadgeVariant()`: 유효 뱃지 개수에 따른 Variant 선택 (0개면 숨김)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_

  - [ ]* 2.4 속성 테스트: 뱃지 유효성 검증 및 정규화
    - **Property 3: 뱃지 유효성 검증 및 정규화**
    - fast-check으로 유효 뱃지의 대소문자·공백 변형 + 무효 문자열 생성 → 정규화 결과 검증
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6**

  - [x] 2.5 선택적 필드 가시성 결정 함수 구현
    - `determineLayerAction()`: `subText`, `copyright` 빈 값 여부에 따라 hide/setText 명령 결정
    - _Requirements: 3.7, 3.9_

  - [ ]* 2.6 속성 테스트: 선택적 필드 가시성 결정
    - **Property 2: 선택적 필드 가시성 결정**
    - fast-check으로 임의의 CardNewsRow 생성 → 빈/비빈 subText, copyright에 따른 명령 검증
    - **Validates: Requirements 3.7, 3.9**

  - [x] 2.7 텍스트 오버플로우 감지 함수 구현
    - `detectOverflow()`: 텍스트 바운딩박스와 부모 프레임 바운딩박스 비교
    - `validateLineCount()`: 줄바꿈 기준 줄 수 계산 (3줄 이하 유효)
    - _Requirements: 6.1, 6.4_

  - [ ]* 2.8 속성 테스트: 텍스트 오버플로우 감지
    - **Property 6: 텍스트 오버플로우 감지**
    - fast-check으로 임의의 BoundingBox 쌍 생성 → 포함/초과 판정 검증
    - **Validates: Requirements 6.1**

  - [ ]* 2.9 속성 테스트: 기본문구 줄 수 제한 검증
    - **Property 7: 기본문구 줄 수 제한 검증**
    - fast-check으로 줄바꿈 0~10개 포함 문자열 생성 → 3줄 이하/4줄 이상 판정 검증
    - **Validates: Requirements 6.4**

  - [x] 2.10 파일명 생성 및 중복 처리 함수 구현
    - `generateFilename()`: `카드뉴스_(영화제목).jpg` 형식, 중복 시 `_02`, `_03` 순번 추가
    - _Requirements: 5.6, 5.7_

  - [ ]* 2.11 속성 테스트: 파일명 생성 및 중복 처리
    - **Property 5: 파일명 생성 및 중복 처리**
    - fast-check으로 임의의 영화 제목 + 기존 파일명 목록 생성 → 형식, 유일성, 순번 규칙 검증
    - **Validates: Requirements 5.6, 5.7**

  - [x] 2.12 URL에서 ID 추출 함수 구현
    - `extractSpreadsheetId()`: 구글 스프레드시트 URL에서 ID 추출
    - `extractFolderId()`: 구글 드라이브 폴더 URL에서 ID 추출
    - `extractFigmaFileKey()`: Figma 파일 URL에서 File Key 추출 (`figma.com/file/{key}/...` 또는 `figma.com/design/{key}/...` 형식)
    - _Requirements: 14.7, 14.8, 14.10_

  - [ ]* 2.13 속성 테스트: URL에서 ID 추출
    - **Property 9: URL에서 ID 추출**
    - fast-check으로 유효한 Google URL 및 Figma URL 패턴 생성 → ID/File Key 추출 결과 검증
    - **Validates: Requirements 14.7, 14.8, 14.10**

  - [x] 2.14 템플릿 레이어 이름 검증 함수 구현
    - `validateTemplateLayerNames()`: Figma 프레임 내 레이어 이름 목록과 필수 레이어 이름 규칙(`bg_image`, `logo`, `main_text`, `sub_text`, `copyright`, `badge_container`) 비교
    - 누락된 레이어 이름 목록 반환
    - _Requirements: 14.13, 14.14_

  - [ ]* 2.15 속성 테스트: 템플릿 레이어 이름 검증
    - **Property 12: 템플릿 레이어 이름 검증**
    - fast-check으로 임의의 레이어 이름 목록(일부 필수 이름 포함/누락) 생성 → 유효/무효 판정 및 누락 목록 검증
    - **Validates: Requirements 14.13, 14.14**

- [x] 3. 체크포인트 - 핵심 유틸리티 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [x] 4. 설정 관리 모듈 구현
  - [x] 4.1 설정 파일 저장/로드 및 유효성 검증 구현
    - `saveConfig()`: `AppConfig` 객체를 로컬 JSON 파일로 저장
    - `loadConfig()`: JSON 파일에서 `AppConfig` 객체 로드
    - `validateConfig()`: 필수 필드 존재 및 비어있지 않음 검증
    - _Requirements: 14.12, 14.13_

  - [ ]* 4.2 속성 테스트: 설정 파일 라운드트립
    - **Property 10: 설정 파일 라운드트립**
    - fast-check으로 임의의 AppConfig 객체 생성 → 저장 → 로드 → 원본과 동일 검증
    - **Validates: Requirements 14.12**

  - [ ]* 4.3 속성 테스트: 설정 유효성 검증
    - **Property 11: 설정 유효성 검증**
    - fast-check으로 임의의 AppConfig(일부 필드 누락 변형) 생성 → 유효/무효 판정 검증
    - **Validates: Requirements 14.13**

- [x] 5. 백엔드 서버 핵심 모듈 구현
  - [x] 5.1 Express 서버 및 API 라우터 설정
    - Express 앱 생성, CORS 설정, 라우터 분리 (`/api/config`, `/api/figma`, `/api/sheets`, `/api/generate`, `/api/history`, `/api/frames`, `/api/download`)
    - 설정 관련 엔드포인트 구현: `POST /api/config/setup`, `POST /api/config/test-connection`, `GET /api/config/status`
    - Figma 템플릿 관련 엔드포인트 구현: `GET /api/figma/frames` (최상위 프레임 목록 조회), `POST /api/figma/validate-template` (레이어 이름 규칙 검증)
    - _Requirements: 14.1, 14.4, 14.10, 14.11, 14.12, 14.13, 14.14_

  - [x] 5.2 스프레드시트_리더 모듈 구현
    - Google Sheets API v4 연동 (Service Account 인증)
    - `readAllRows()`, `updateCell()`, `appendHistory()`, `readHistory()` 구현
    - 스프레드시트 관련 엔드포인트 구현: `GET /api/sheets/data`, `PUT /api/sheets/cell`, `POST /api/sheets/refresh`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.3, 10.4, 11.1, 11.2_

  - [x] 5.3 드라이브_리더 모듈 구현
    - Google Drive API v3 연동 (Service Account 인증)
    - `downloadBackground()`, `downloadLogo()`, `uploadResult()`, `fileExists()`, `listResultFiles()` 구현
    - 다운로드 엔드포인트 구현: `GET /api/download/:fileId`
    - _Requirements: 2.1, 2.2, 2.3, 5.8_

  - [ ]* 5.4 단위 테스트: 스프레드시트_리더 및 드라이브_리더
    - Google API 모킹을 통한 데이터 읽기/쓰기/다운로드/업로드 테스트
    - 파일 미존재 시 오류 처리 테스트
    - _Requirements: 1.1, 2.3_

- [x] 6. WebSocket 브릿지 및 Figma 오케스트레이터 구현
  - [x] 6.1 WebSocket 서버 및 브릿지 구현
    - 서버 시작 시 WebSocket 서버 생성
    - Plugin UI(iframe) ↔ 서버 간 메시지 라우팅
    - 명령-응답 매칭 (요청 ID 기반)
    - _Requirements: 3.1_

  - [x] 6.2 Figma 오케스트레이터 구현
    - `cacheTemplateSpec()`: REST API로 템플릿 스펙 1회 캐싱
    - `cloneFrame()`, `setTextLayer()`, `hideLayer()`, `replaceImage()`, `switchBadgeVariant()`, `checkOverflow()`, `deleteFrames()`: WebSocket 브릿지 경유 Plugin 명령
    - `exportImage()`: Figma REST API 직접 호출
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 6.3 내보내기 관리자 구현
    - `exportWithQualityAdjustment()`: 80% → 점진적 하향(최소 70%) 품질 자동 조정
    - `generateFilename()` 연동 (중복 처리 포함)
    - 구글 드라이브 결과물 폴더 업로드
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [ ]* 6.4 속성 테스트: JPG 품질 자동 조정 알고리즘
    - **Property 4: JPG 품질 자동 조정 알고리즘**
    - fast-check으로 임의의 파일 크기 시퀀스(모킹) 생성 → 품질 범위(70~80), 500KB 기준 충족, sizeWarning 플래그 검증
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [x] 7. 배치 생성 파이프라인 구현
  - [x] 7.1 카드뉴스 생성 파이프라인 구현
    - `POST /api/generate` 엔드포인트: 선택된 행 목록 수신 → 데이터 검증 → 이미지 로드 → Figma 수정 → 오버플로우 검증 → 렌더링 → 업로드 순차 실행
    - 행 단위 오류 격리: 오류 행 건너뛰기, 나머지 행 정상 처리
    - Rate Limit 대응: 지수 백오프(2초, 4초, 8초), 최대 3회 재시도, 요청 간 1~2초 딜레이
    - _Requirements: 7.2, 7.5, 12.1, 12.4, 12.6, 12.8_

  - [x] 7.2 SSE 진행 상태 스트림 구현
    - `GET /api/generate/progress` 엔드포인트: SSE로 실시간 진행 상태 전송
    - `GenerationProgress` 데이터 구조 활용 (현재 행, 전체 행, 현재 단계, 결과 목록)
    - Rate Limit 대기 상태 표시
    - _Requirements: 7.4, 12.7_

  - [x] 7.3 미리보기 엔드포인트 구현
    - `POST /api/preview/:rowIndex`: 특정 행 데이터로 Figma 템플릿 복제 → 레이어 수정 → 0.5x 스케일 렌더링
    - _Requirements: 8.1, 8.2_

  - [x] 7.4 히스토리 기록 및 조회 구현
    - 생성 완료 후 히스토리_탭에 기록 (`appendHistory()`)
    - `GET /api/history`, `GET /api/history/:id` 엔드포인트
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 7.5 프레임 관리 엔드포인트 구현
    - `GET /api/frames/batches`: 정리 가능한 배치 목록 조회
    - `DELETE /api/frames/:batchId`: 배치 프레임 삭제 (Figma Plugin 경유)
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ]* 7.6 속성 테스트: 배치 오류 격리
    - **Property 8: 배치 오류 격리**
    - fast-check으로 임의의 행 배치(일부 오류 행 포함, 모킹) 생성 → 오류 행이 정상 행 처리에 영향 없음 검증
    - **Validates: Requirements 12.1**

- [x] 8. 체크포인트 - 백엔드 전체 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [x] 9. Figma 플러그인 구현
  - [x] 9.1 플러그인 프로젝트 설정 및 매니페스트 작성
    - `manifest.json` 작성 (플러그인 이름, UI 설정)
    - TypeScript 빌드 설정 (esbuild/webpack)
    - _Requirements: 3.2_

  - [x] 9.2 Plugin Sandbox 명령 핸들러 구현
    - `clone-frame`: 템플릿 프레임 복제
    - `set-text`: 텍스트 레이어 수정
    - `hide-layer`: 레이어 숨김 처리
    - `replace-image`: 이미지 레이어 교체 (Base64 → Uint8Array → fills)
    - `switch-badge-variant`: 뱃지 Variant 전환
    - `check-overflow`: absoluteBoundingBox 비교로 오버플로우 검증
    - `delete-frames`: 프레임 삭제
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.2, 4.3, 4.6, 6.1_

  - [x] 9.3 Plugin UI (iframe) WebSocket 클라이언트 구현
    - WebSocket 서버 연결 및 자동 재연결
    - 서버 명령 수신 → `postMessage`로 Sandbox 전달
    - Sandbox 결과 수신 → WebSocket으로 서버 전달
    - _Requirements: 3.1_

- [x] 10. 웹 UI 프론트엔드 구현
  - [x] 10.1 React + Vite 프로젝트 설정 및 라우팅
    - Vite + React + TypeScript 프로젝트 초기화
    - 페이지 라우팅: 설정 마법사, 메인 대시보드, 히스토리
    - _Requirements: 14.1_

  - [x] 10.2 SetupWizard 컴포넌트 구현
    - 단계별 설정 안내 UI (Google Cloud 프로젝트, API 활성화, 서비스 계정, 공유 설정, Figma 토큰)
    - JSON 키 파일 드래그앤드롭 업로드
    - 스프레드시트/드라이브 URL 입력 시 자동 ID 추출 (`extractSpreadsheetId`, `extractFolderId` 활용)
    - Figma API 토큰 입력
    - Figma 파일 URL 입력 시 자동 File Key 추출 (`extractFigmaFileKey` 활용)
    - Figma 파일 내 최상위 프레임 목록 드롭다운 표시 (`GET /api/figma/frames`)
    - 템플릿 프레임 선택 후 레이어 이름 규칙 검증 (`POST /api/figma/validate-template`)
    - 누락 레이어 안내 및 Figma 템플릿 레이어 이름 규칙 안내 문서 표시
    - "연결 테스트" 버튼 및 결과 표시
    - _Requirements: 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 14.13, 14.14, 14.15, 14.16, 14.17_

  - [x] 10.3 SpreadsheetTable 컴포넌트 구현
    - 스프레드시트 데이터 테이블 표시
    - 인라인 셀 편집 (클릭 → 편집 모드, 줄바꿈 지원)
    - 편집 완료 시 구글 시트 동기화 (`PUT /api/sheets/cell`)
    - "새로고침" 버튼
    - 행 선택 체크박스 (개별 선택, 전체 선택/해제)
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 10.4 BadgeAutocomplete 컴포넌트 구현
    - 뱃지 컬럼 편집 시 20종 뱃지 목록 자동완성/드롭다운
    - 유효하지 않은 뱃지 이름 실시간 오류 표시 (빨간 테두리)
    - _Requirements: 10.6, 10.7_

  - [x] 10.5 GenerationProgress 및 ResultSummary 컴포넌트 구현
    - SSE 기반 실시간 진행 상태 표시 (현재 행/전체 행, 현재 단계)
    - Rate Limit 대기 상태 표시
    - 생성 완료 후 결과 요약 (성공/실패 수, 오류 목록, 다운로드 링크)
    - _Requirements: 7.1, 7.3, 7.4, 12.2, 12.3, 12.7_

  - [x] 10.6 PreviewPanel 컴포넌트 구현
    - 특정 행 미리보기 요청 및 결과 표시
    - 저해상도(0.5x) 안내 문구
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.7 HistoryList 컴포넌트 구현
    - 히스토리 목록 표시 (생성 일시, 카드뉴스 수, 오류 수)
    - 히스토리 상세 보기 (이미지 목록, 오류 목록)
    - 이미지 다시 다운로드 기능
    - _Requirements: 11.3, 11.4, 11.5_

  - [x] 10.8 FrameCleanup 컴포넌트 구현
    - "프레임 정리" 버튼 및 배치 목록 표시
    - 배치 선택 후 프레임 삭제 요청
    - _Requirements: 13.2, 13.3, 13.4_

- [x] 11. 체크포인트 - 프론트엔드 및 전체 통합 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [x] 12. 통합 연결 및 최종 검증
  - [x] 12.1 프론트엔드-백엔드 통합 연결
    - 웹 UI에서 백엔드 API 호출 연결 (axios/fetch 설정)
    - SSE 이벤트 스트림 연결
    - WebSocket 상태 표시 (Figma 플러그인 연결 여부)
    - _Requirements: 7.2, 7.4_

  - [x] 12.2 에러 처리 통합
    - 각 에러 유형별 사용자 안내 메시지 구현 (`BADGE_INVALID`, `FILE_NOT_FOUND`, `TEXT_OVERFLOW`, `LINE_LIMIT`, `API_ERROR`, `RENDER_ERROR`, `RATE_LIMIT`, `CONNECTION_ERROR`, `SIZE_WARNING`)
    - API 오류 시 재시도 옵션 UI
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 12.3 통합 테스트 작성
    - 모킹된 외부 서비스로 전체 생성 파이프라인 end-to-end 흐름 검증
    - WebSocket 브릿지 메시지 전달 검증
    - SSE 진행 상태 업데이트 수신 검증
    - 히스토리 기록 검증
    - _Requirements: 7.2, 11.1_

- [x] 13. 최종 체크포인트 - 전체 시스템 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

## Notes

- `*` 표시된 태스크는 선택 사항이며, 빠른 MVP를 위해 건너뛸 수 있습니다.
- 각 태스크는 특정 요구사항을 참조하여 추적 가능합니다.
- 체크포인트에서 점진적 검증을 수행합니다.
- 속성 테스트는 설계 문서의 정확성 속성(Property 1~12)을 검증합니다.
- 단위 테스트는 특정 예제와 엣지 케이스를 검증합니다.
