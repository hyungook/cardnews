# Implementation Plan: Local File Storage Integration

## Overview

이 구현 계획은 구글 드라이브 의존성을 제거하고 로컬 파일 시스템으로 전환하는 작업을 정의합니다. 기존 `figma-card-news-automation` 시스템에 로컬 스토리지 기능을 통합하여 완전히 대체합니다.

## Tasks

- [ ] 1. LocalStorage 모듈 완성
  - [x] 1.1 파일명 정규화 함수 구현
    - `normalizeFilename()` 함수 추가: 공백 → 언더스코어, 특수문자 제거, 한글 유지
    - 파일 확장자 보존 로직 추가
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 1.2 30일 자동 삭제 함수 구현
    - `cleanupOldResults()` 함수 추가: 날짜 폴더 순회, 30일 이상 폴더 삭제
    - 삭제된 파일 수 반환
    - _Requirements: 6.6_

  - [x] 1.3 saveFile 함수 수정
    - 파일명 자동 정규화 적용
    - 정규화된 파일명 반환
    - _Requirements: 2.2, 2.3, 2.5, 3.2, 3.3, 3.5_

  - [x] 1.4 readResultFile 함수 제거
    - 웹 UI 다운로드 기능 제거에 따라 불필요
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.5 단위 테스트 작성
    - 파일명 정규화 테스트 (공백, 특수문자, 한글)
    - 30일 자동 삭제 테스트
    - 파일 저장/읽기 테스트
    - 파일 목록 조회 테스트
    - 파일 삭제 테스트

- [ ] 2. API Routes 구현
  - [x] 2.1 local-upload.ts 라우터 생성
    - POST `/api/local/upload` 엔드포인트 구현
    - GET `/api/local/files` 엔드포인트 구현
    - DELETE `/api/local/files/:filename` 엔드포인트 구현
    - multer 설정 (20MB 제한)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 2.2 index.ts에 라우터 등록
    - `app.use('/api/local', localUploadRouter)` 추가
    - 기존 `/api/drive` 라우터 제거 준비

  - [ ] 2.3 API 테스트 작성
    - 업로드 성공/실패 시나리오
    - 파일 목록 조회 테스트
    - 파일 삭제 테스트

- [ ] 3. Pipeline 통합
  - [x] 3.1 PipelineDeps 인터페이스 수정
    - `driveReader` 필드 제거
    - _Requirements: 11.4_

  - [x] 3.2 processRow 메서드 수정
    - `this.deps.driveReader.downloadBackground()` → `readBackground()` 변경
    - `this.deps.driveReader.downloadLogo()` → `readLogo()` 변경
    - import 문 추가: `import { readBackground, readLogo } from '../local/local-storage.js'`
    - _Requirements: 11.1, 11.2_

  - [x] 3.3 createPipelineDeps 함수 수정
    - `DriveReader` 인스턴스 생성 제거
    - `driveReader` 파라미터 제거
    - _Requirements: 11.4_

- [ ] 4. ExportManager 통합
  - [x] 4.1 생성자 수정
    - `driveReader` 파라미터 제거
    - _Requirements: 11.3_

  - [x] 4.2 exportWithQualityAdjustment 메서드 수정
    - `this.driveReader.uploadResultWithDate()` → `saveResult()` 변경
    - `this.driveReader.listResultFiles()` → `listResultFilenames()` 변경
    - import 문 추가: `import { saveResult, listResultFilenames } from '../local/local-storage.js'`
    - _Requirements: 11.3_

- [ ] 5. Server 초기화
  - [x] 5.1 index.ts 수정
    - 서버 시작 시 `ensureFolders()` 호출
    - 서버 시작 시 `cleanupOldResults(30)` 호출
    - 로그 출력 추가
    - _Requirements: 1.1, 1.2, 1.3, 6.6_

- [ ] 6. 구글 드라이브 코드 제거
  - [x] 6.1 DriveReader 클래스 제거
    - `packages/server/src/google/drive-reader.ts` 파일 삭제
    - _Requirements: 11.5_

  - [x] 6.2 drive-upload.ts 라우터 제거
    - `packages/server/src/routes/drive-upload.ts` 파일 삭제
    - index.ts에서 라우터 등록 제거
    - _Requirements: 11.6, 11.7, 11.8_

  - [x] 6.3 download.ts 라우터 수정
    - 구글 드라이브 다운로드 로직 제거
    - 또는 파일 전체 제거 (Figma 전용 다운로드)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 7. 통합 테스트
  - [ ] 7.1 전체 파이프라인 테스트
    - 로컬 이미지 업로드 → 카드뉴스 생성 → 결과물 저장 플로우
    - 파일 없음 에러 처리 확인
    - 파일명 중복 처리 확인

  - [ ] 7.2 에러 처리 테스트
    - 파일 없음 에러 메시지 확인
    - 권한 오류 시나리오 (가능한 경우)

- [ ] 8. 웹 UI 업데이트
  - [ ] 8.1 ImageUploader 컴포넌트 생성
    - 파일 드래그앤드롭 UI
    - POST `/api/local/upload` 호출
    - 업로드 진행 상태 표시
    - 정규화된 파일명 표시

  - [ ] 8.2 FileList 컴포넌트 생성
    - GET `/api/local/files` 호출
    - 파일 목록 테이블 표시
    - 파일 삭제 버튼
    - DELETE `/api/local/files/:filename` 호출

  - [ ] 8.3 SetupWizard에 이미지 업로드 단계 추가
    - 초기 설정 시 배경이미지/로고 업로드 안내
    - 구글 드라이브 폴더 ID 입력 단계 제거

  - [ ] 8.4 DashboardPage에 이미지 관리 탭 추가
    - ImageUploader 컴포넌트 배치
    - FileList 컴포넌트 배치

  - [ ] 8.5 HistoryList 컴포넌트 수정
    - 결과물 다운로드 버튼 제거 (Figma 전용)
    - Figma 파일 링크 안내 추가

- [ ] 9. 문서 업데이트
  - [ ] 9.1 README 업데이트
    - 로컬 파일 시스템 사용 안내
    - 구글 드라이브 설정 제거
    - 백업 전략 안내 추가

  - [ ] 9.2 설정 마법사 가이드 업데이트
    - 구글 드라이브 관련 단계 제거
    - 이미지 업로드 방법 안내 추가

- [ ] 10. 최종 검증
  - [ ] 10.1 모든 테스트 통과 확인
    - 단위 테스트
    - 통합 테스트
    - API 테스트

  - [ ] 10.2 전체 플로우 수동 테스트
    - 이미지 업로드
    - 카드뉴스 생성
    - Figma에서 결과물 확인
    - 30일 자동 삭제 확인

  - [ ] 10.3 성능 테스트
    - 로컬 I/O 속도 측정
    - 대량 파일 처리 테스트

## Notes

- 각 태스크는 특정 요구사항을 참조하여 추적 가능합니다.
- Phase별로 점진적으로 구현하여 안정성을 확보합니다.
- 구글 드라이브 코드는 로컬 스토리지가 완전히 동작한 후 제거합니다.
- 웹 UI 업데이트는 백엔드 완성 후 진행합니다.

## Implementation Order

1. **Phase 1**: LocalStorage 모듈 완성 (Task 1)
2. **Phase 2**: API Routes 구현 (Task 2)
3. **Phase 3**: Pipeline & ExportManager 통합 (Task 3, 4)
4. **Phase 4**: Server 초기화 (Task 5)
5. **Phase 5**: 통합 테스트 (Task 7)
6. **Phase 6**: 구글 드라이브 코드 제거 (Task 6)
7. **Phase 7**: 웹 UI 업데이트 (Task 8)
8. **Phase 8**: 문서 업데이트 및 최종 검증 (Task 9, 10)
