# 프로젝트 개선 구현 계획

## Phase 1: 기반 인프라 구축 (1-2일) ✅ 완료

### Task 1.1: 환경 변수 관리 ✅
- [x] 1.1.1 `dotenv` 및 `zod` 패키지 설치
- [x] 1.1.2 `packages/server/src/config/env.ts` 생성
- [x] 1.1.3 `.env.example` 파일 생성
- [x] 1.1.4 `.gitignore`에 `.env` 추가
- [x] 1.1.5 기존 하드코딩된 값을 환경 변수로 변경
- [x] 1.1.6 README에 환경 변수 설정 가이드 추가

### Task 1.2: 로깅 시스템 ✅
- [x] 1.2.1 `winston` 및 `winston-daily-rotate-file` 패키지 설치
- [x] 1.2.2 `packages/server/src/utils/logger.ts` 생성
- [x] 1.2.3 `logs/` 폴더를 `.gitignore`에 추가
- [x] 1.2.4 모든 `console.log`를 `logger` 호출로 변경
- [x] 1.2.5 에러 로그에 스택 트레이스 포함

### Task 1.3: API 응답 표준화 ✅
- [x] 1.3.1 `packages/shared/src/api-types.ts` 생성
- [x] 1.3.2 `ErrorCode` enum 정의
- [x] 1.3.3 `packages/server/src/utils/response.ts` 생성
- [x] 1.3.4 모든 API 라우터에 표준 응답 적용
  - [x] `local-upload.ts`
  - [x] `config.ts`
  - [x] `sheets.ts`
  - [x] `figma.ts`
  - [x] `generate.ts`
  - [x] `history.ts`
  - [x] `frames.ts`
- [ ] 1.3.5 에러 처리 미들웨어 추가 (선택사항)

### Task 1.4: 파일 경로 검증 ✅
- [x] 1.4.1 `packages/server/src/utils/file-validator.ts` 생성
- [x] 1.4.2 `validateFilename()` 함수 구현
- [x] 1.4.3 `sanitizeFilename()` 함수 구현
- [x] 1.4.4 파일 업로드/삭제 API에 검증 로직 추가
- [x] 1.4.5 단위 테스트 작성 (31개 테스트 통과)

---

## Phase 2: 파일 관리 개선 (2-3일)

### Task 2.1: 중복 파일 체크
- [ ] 2.1.1 `packages/server/src/utils/file-hash.ts` 생성
- [ ] 2.1.2 `calculateFileHash()` 함수 구현
- [ ] 2.1.3 `isDuplicateFile()` 함수 구현
- [ ] 2.1.4 업로드 API에 중복 체크 로직 추가
- [ ] 2.1.5 중복 파일 발견 시 409 에러 반환
- [ ] 2.1.6 웹 UI에 중복 파일 알림 추가

### Task 2.2: 동시 업로드 제한
- [ ] 2.2.1 `packages/server/src/middleware/upload-limiter.ts` 생성
- [ ] 2.2.2 동시 업로드 카운터 구현
- [ ] 2.2.3 제한 초과 시 429 에러 반환
- [ ] 2.2.4 업로드 API에 미들웨어 적용
- [ ] 2.2.5 웹 UI에 업로드 대기열 표시

### Task 2.3: 파일명 충돌 처리
- [ ] 2.3.1 `packages/server/src/utils/filename-conflict.ts` 생성
- [ ] 2.3.2 `resolveFilenameConflict()` 함수 구현
- [ ] 2.3.3 `normalizeFilename()`에 충돌 처리 통합
- [ ] 2.3.4 업로드 API에 충돌 처리 로직 추가
- [ ] 2.3.5 단위 테스트 작성

### Task 2.4: 업로드 전 확인
- [ ] 2.4.1 `POST /api/local/check-duplicate` 엔드포인트 추가
- [ ] 2.4.2 웹 UI에 업로드 전 확인 다이얼로그 추가
- [ ] 2.4.3 덮어쓰기/이름 변경 옵션 제공

### Task 2.5: 파일명 수정 API
- [ ] 2.5.1 `POST /api/local/rename` 엔드포인트 추가
- [ ] 2.5.2 파일명 검증 로직 추가
- [ ] 2.5.3 웹 UI에 파일명 수정 기능 추가
- [ ] 2.5.4 통합 테스트 작성

---

## Phase 3: 기능 개선 (1-2일)

### Task 3.1: 자동 삭제 관리
- [ ] 3.1.1 `GET /api/local/cleanup/preview` 엔드포인트 추가
- [ ] 3.1.2 삭제 예정 파일 목록 반환
- [ ] 3.1.3 `POST /api/local/cleanup/execute` 엔드포인트 추가
- [ ] 3.1.4 웹 UI에 자동 삭제 관리 페이지 추가
- [ ] 3.1.5 삭제 전 확인 다이얼로그 추가

### Task 3.2: API 연결 테스트
- [ ] 3.2.1 `packages/server/src/utils/connection-test.ts` 생성
- [ ] 3.2.2 `testGoogleSheetsConnection()` 함수 구현
- [ ] 3.2.3 `testFigmaConnection()` 함수 구현
- [ ] 3.2.4 `/api/config/test-connection`에 실제 테스트 로직 추가
- [ ] 3.2.5 연결 실패 시 구체적인 에러 메시지 제공

### Task 3.3: 페이지네이션
- [ ] 3.3.1 `listFilesPaginated()` 함수 구현
- [ ] 3.3.2 `GET /api/local/files`에 page, limit 쿼리 파라미터 추가
- [ ] 3.3.3 웹 UI에 페이지네이션 컴포넌트 추가
- [ ] 3.3.4 무한 스크롤 또는 페이지 버튼 구현

---

## Phase 4: 테스트 및 문서화 (1-2일)

### Task 4.1: 테스트 작성
- [ ] 4.1.1 파일 업로드 API 통합 테스트
- [ ] 4.1.2 파일 삭제 API 통합 테스트
- [ ] 4.1.3 중복 파일 체크 테스트
- [ ] 4.1.4 파일명 충돌 처리 테스트
- [ ] 4.1.5 동시 업로드 제한 테스트
- [ ] 4.1.6 API 연결 테스트
- [ ] 4.1.7 테스트 커버리지 확인 (목표: 70%)

### Task 4.2: API 문서화
- [ ] 4.2.1 `swagger-jsdoc` 및 `swagger-ui-express` 패키지 설치
- [ ] 4.2.2 `packages/server/src/swagger.ts` 생성
- [ ] 4.2.3 각 API 라우터에 JSDoc 주석 추가
- [ ] 4.2.4 `/api-docs` 엔드포인트 추가
- [ ] 4.2.5 에러 코드 문서 작성

### Task 4.3: 사용자 문서
- [ ] 4.3.1 `docs/INSTALLATION.md` 작성
- [ ] 4.3.2 `docs/DEPLOYMENT.md` 작성
- [ ] 4.3.3 `docs/API.md` 작성
- [ ] 4.3.4 `docs/ERROR_CODES.md` 작성
- [ ] 4.3.5 README 업데이트

---

## Phase 5: 배포 설정 (1일)

### Task 5.1: Docker 설정
- [ ] 5.1.1 `Dockerfile` 작성
- [ ] 5.1.2 `docker-compose.yml` 작성
- [ ] 5.1.3 `.dockerignore` 작성
- [ ] 5.1.4 헬스 체크 엔드포인트 추가 (`GET /health`)
- [ ] 5.1.5 Docker 이미지 빌드 및 테스트

### Task 5.2: PM2 설정
- [ ] 5.2.1 `pm2` 패키지 설치
- [ ] 5.2.2 `ecosystem.config.js` 작성
- [ ] 5.2.3 프로덕션 빌드 스크립트 추가
- [ ] 5.2.4 PM2로 실행 테스트

### Task 5.3: 프로덕션 최적화
- [ ] 5.3.1 메모리 모니터링 미들웨어 추가
- [ ] 5.3.2 CORS 설정 환경 변수화
- [ ] 5.3.3 압축 미들웨어 추가 (`compression`)
- [ ] 5.3.4 보안 헤더 추가 (`helmet`)
- [ ] 5.3.5 Rate limiting 추가 (`express-rate-limit`)

---

## 체크리스트

### 필수 작업 (Phase 1-3)
- [ ] 환경 변수 관리
- [ ] 로깅 시스템
- [ ] API 응답 표준화
- [ ] 파일 경로 검증
- [ ] 중복 파일 체크
- [ ] 동시 업로드 제한
- [ ] 파일명 충돌 처리
- [ ] API 연결 테스트

### 권장 작업 (Phase 4-5)
- [ ] 테스트 작성
- [ ] API 문서화
- [ ] Docker 설정
- [ ] PM2 설정
- [ ] 프로덕션 최적화

### 선택 작업
- [ ] 파일명 수정 기능
- [ ] 자동 삭제 관리 UI
- [ ] 페이지네이션
- [ ] 무한 스크롤

---

## 예상 일정

| Phase | 작업 내용 | 예상 시간 | 우선순위 |
|-------|----------|----------|---------|
| Phase 1 | 기반 인프라 | 1-2일 | 필수 |
| Phase 2 | 파일 관리 | 2-3일 | 필수 |
| Phase 3 | 기능 개선 | 1-2일 | 필수 |
| Phase 4 | 테스트/문서 | 1-2일 | 권장 |
| Phase 5 | 배포 설정 | 1일 | 권장 |

**총 예상 시간**: 6-10일

---

## 다음 단계

1. Phase 1부터 순차적으로 진행
2. 각 Phase 완료 후 테스트 및 검증
3. 문제 발생 시 즉시 수정
4. 모든 Phase 완료 후 전체 통합 테스트
5. 프로덕션 배포

시작하시겠습니까?
