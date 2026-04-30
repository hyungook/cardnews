# Requirements Document

## Introduction

이 문서는 구글 드라이브 의존성을 제거하고 이미지 저장소를 로컬 파일 시스템으로 전환하는 기능의 요구사항을 정의합니다. 구글 시트 연동은 유지하되, 배경이미지/로고/결과물의 저장 및 조회를 서버 로컬 폴더에서 처리하여 스토리지 제약, API Rate Limit, 네트워크 지연 문제를 해결합니다.

## Glossary

- **Local_Storage**: 서버 로컬 파일 시스템에 이미지를 저장/조회하는 모듈
- **Image_Uploader**: 웹 UI에서 이미지를 업로드하는 컴포넌트
- **Export_Manager**: Figma에서 렌더링된 이미지를 JPG로 변환하고 저장하는 모듈
- **Pipeline**: 카드뉴스 생성 파이프라인 (데이터 읽기 → Figma 수정 → 렌더링 → 저장)
- **Drive_Reader**: 구글 드라이브 API를 사용하는 기존 모듈 (제거 대상)
- **Sheets_Reader**: 구글 시트 API를 사용하는 모듈 (유지)
- **Background_Image**: 카드뉴스 배경으로 사용되는 이미지 파일
- **Logo_Image**: 카드뉴스에 삽입되는 로고 이미지 파일
- **Result_Image**: 생성된 카드뉴스 결과물 이미지 파일

## Requirements

### Requirement 1: 로컬 폴더 구조 초기화

**User Story:** 개발자로서, 서버 시작 시 필요한 로컬 폴더가 자동으로 생성되기를 원합니다. 이를 통해 수동 설정 없이 즉시 시스템을 사용할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Server starts, THE Local_Storage SHALL create the `images/배경이미지/` directory if it does not exist
2. WHEN THE Server starts, THE Local_Storage SHALL create the `images/로고/` directory if it does not exist
3. WHEN THE Server starts, THE Local_Storage SHALL create the `images/결과물/` directory if it does not exist
4. THE Local_Storage SHALL use the server's current working directory as the base path for all image folders

### Requirement 2: 배경이미지 업로드 및 저장

**User Story:** 사용자로서, 웹 UI에서 배경이미지를 업로드하여 로컬 폴더에 저장하고 싶습니다. 이를 통해 구글 드라이브 설정 없이 이미지를 관리할 수 있습니다.

#### Acceptance Criteria

1. WHEN a user uploads a Background_Image through the web UI, THE Image_Uploader SHALL send the file to the server API endpoint
2. WHEN THE Server receives a Background_Image upload request, THE Local_Storage SHALL normalize the filename by removing special characters and replacing spaces with underscores
3. THE Local_Storage SHALL save the file to `images/배경이미지/` directory with the normalized filename
4. THE Local_Storage SHALL support JPG and PNG file formats for Background_Image uploads
5. WHEN a Background_Image with the same filename already exists, THE Local_Storage SHALL overwrite the existing file
6. WHEN a Background_Image upload succeeds, THE Server SHALL return the normalized filename to the client

### Requirement 3: 로고 이미지 업로드 및 저장

**User Story:** 사용자로서, 웹 UI에서 로고 이미지를 업로드하여 로컬 폴더에 저장하고 싶습니다. 이를 통해 구글 드라이브 설정 없이 로고를 관리할 수 있습니다.

#### Acceptance Criteria

1. WHEN a user uploads a Logo_Image through the web UI, THE Image_Uploader SHALL send the file to the server API endpoint
2. WHEN THE Server receives a Logo_Image upload request, THE Local_Storage SHALL normalize the filename by removing special characters and replacing spaces with underscores
3. THE Local_Storage SHALL save the file to `images/로고/` directory with the normalized filename
4. THE Local_Storage SHALL support PNG file format for Logo_Image uploads
5. WHEN a Logo_Image with the same filename already exists, THE Local_Storage SHALL overwrite the existing file
6. WHEN a Logo_Image upload succeeds, THE Server SHALL return the normalized filename to the client

### Requirement 4: 배경이미지 조회 및 다운로드

**User Story:** 시스템으로서, 카드뉴스 생성 시 로컬 폴더에서 배경이미지를 읽어야 합니다. 이를 통해 구글 드라이브 API 호출 없이 빠르게 이미지를 로드할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Pipeline requests a Background_Image by filename, THE Local_Storage SHALL read the file from `images/배경이미지/` directory
2. IF the requested Background_Image does not exist, THEN THE Local_Storage SHALL return an error with the message "파일 '{filename}'을(를) '배경이미지' 폴더에서 찾을 수 없습니다"
3. WHEN a Background_Image is found, THE Local_Storage SHALL return the file data as a Buffer
4. THE Local_Storage SHALL perform filename matching using exact string comparison

### Requirement 5: 로고 이미지 조회 및 다운로드

**User Story:** 시스템으로서, 카드뉴스 생성 시 로컬 폴더에서 로고 이미지를 읽어야 합니다. 이를 통해 구글 드라이브 API 호출 없이 빠르게 이미지를 로드할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Pipeline requests a Logo_Image by filename, THE Local_Storage SHALL read the file from `images/로고/` directory
2. IF the requested Logo_Image does not exist, THEN THE Local_Storage SHALL return an error with the message "파일 '{filename}'을(를) '로고' 폴더에서 찾을 수 없습니다"
3. WHEN a Logo_Image is found, THE Local_Storage SHALL return the file data as a Buffer
4. THE Local_Storage SHALL perform filename matching using exact string comparison

### Requirement 6: 결과물 저장 (날짜별 폴더)

**User Story:** 시스템으로서, 생성된 카드뉴스를 날짜별 폴더에 저장하여 체계적으로 관리하고 싶습니다. 이를 통해 구글 드라이브 스토리지 제약 없이 무제한으로 결과물을 저장할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Export_Manager saves a Result_Image, THE Local_Storage SHALL create a date-based subdirectory in `images/결과물/` using YYYY-MM-DD format
2. THE Local_Storage SHALL save the Result_Image to `images/결과물/YYYY-MM-DD/` directory with the generated filename
3. WHEN a date subdirectory already exists, THE Local_Storage SHALL reuse the existing directory
4. WHEN a Result_Image with the same filename already exists in the date subdirectory, THE Local_Storage SHALL overwrite the existing file
5. WHEN a Result_Image save succeeds, THE Local_Storage SHALL return the filename as the file identifier
6. THE System SHALL automatically delete Result_Image files older than 30 days during server startup to manage disk space

### Requirement 7: Figma에서 결과물 확인

**User Story:** 사용자로서, 생성된 카드뉴스를 Figma 파일에서 직접 확인하고 다운로드하고 싶습니다. 이를 통해 웹 UI 다운로드 기능 없이도 결과물을 받을 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Pipeline completes card news generation, THE System SHALL keep the cloned frames in the Figma file for user review
2. THE User SHALL be able to view and download the generated card news images directly from the Figma file
3. THE System SHALL NOT provide a web UI download feature for Result_Images
4. THE System SHALL provide a frame cleanup feature to remove old cloned frames from the Figma file when needed

### Requirement 10: 결과물 파일명 중복 방지

**User Story:** 시스템으로서, 결과물 저장 시 기존 파일명과 중복되지 않도록 자동으로 번호를 붙이고 싶습니다. 이를 통해 파일 덮어쓰기를 방지할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Export_Manager generates a filename, THE Local_Storage SHALL provide a list of all existing Result_Image filenames across all date subdirectories
2. THE Export_Manager SHALL check if the generated filename already exists in the provided list
3. IF the filename already exists, THEN THE Export_Manager SHALL append a numeric suffix (e.g., "_2", "_3") until a unique filename is found
4. THE Export_Manager SHALL use the unique filename when saving the Result_Image

### Requirement 11: 구글 드라이브 API 제거

**User Story:** 개발자로서, 구글 드라이브 관련 코드를 제거하여 시스템을 단순화하고 싶습니다. 이를 통해 구글 드라이브 설정 및 인증 문제를 해결할 수 있습니다.

#### Acceptance Criteria

1. THE Pipeline SHALL use Local_Storage instead of Drive_Reader for Background_Image retrieval
2. THE Pipeline SHALL use Local_Storage instead of Drive_Reader for Logo_Image retrieval
3. THE Export_Manager SHALL use Local_Storage instead of Drive_Reader for Result_Image storage
4. THE Server SHALL remove the Drive_Reader dependency from the Pipeline creation function
5. THE Server SHALL remove the `/api/drive/upload` endpoint
6. THE Server SHALL remove the `/api/drive/files` endpoint
7. THE Server SHALL remove the `/api/drive/files/:fileId` DELETE endpoint
8. THE Server SHALL maintain the Sheets_Reader for spreadsheet data and history recording

### Requirement 12: 로컬 스토리지 API 엔드포인트

**User Story:** 개발자로서, 로컬 파일 시스템 작업을 위한 새로운 API 엔드포인트가 필요합니다. 이를 통해 웹 UI에서 로컬 스토리지와 상호작용할 수 있습니다.

#### Acceptance Criteria

1. THE Server SHALL provide a POST `/api/local/upload` endpoint that accepts multipart form data with "file" and "folder" fields
2. THE `/api/local/upload` endpoint SHALL support folder values "background" and "logo"
3. THE Server SHALL provide a GET `/api/local/files` endpoint that returns file lists from both `images/배경이미지/` and `images/로고/` directories
4. THE Server SHALL provide a DELETE `/api/local/files/:filename` endpoint that accepts a "folder" query parameter
5. THE `/api/local/upload` endpoint SHALL return JSON with success status, normalized filename, and folder name
6. THE `/api/local/files` endpoint SHALL return JSON with success status and an array of file objects

### Requirement 13: 설정 파일 간소화

**User Story:** 개발자로서, 구글 드라이브 관련 설정을 제거하여 초기 설정을 간소화하고 싶습니다. 이를 통해 사용자가 더 쉽게 시스템을 설정할 수 있습니다.

#### Acceptance Criteria

1. THE AppConfig interface SHALL remove the `google.driveFolderId` field
2. THE Server SHALL not require `driveFolderId` in the configuration file
3. THE Server SHALL maintain the `google.serviceAccountKey` and `google.spreadsheetId` fields for Sheets_Reader functionality
4. THE Server SHALL validate that required Google Sheets configuration is present at startup

### Requirement 14: 에러 처리 일관성

**User Story:** 개발자로서, 로컬 파일 시스템 작업 시 발생하는 에러가 기존 구글 드라이브 에러와 동일한 형식으로 처리되기를 원합니다. 이를 통해 상위 레이어에서 일관된 에러 처리가 가능합니다.

#### Acceptance Criteria

1. WHEN a Background_Image is not found, THE Local_Storage SHALL throw an error that THE Pipeline classifies as "FILE_NOT_FOUND" error type
2. WHEN a Logo_Image is not found, THE Local_Storage SHALL throw an error that THE Pipeline classifies as "FILE_NOT_FOUND" error type
3. THE Local_Storage error messages SHALL match the format used by Drive_Reader for compatibility
4. THE Pipeline SHALL handle Local_Storage errors in the same way as Drive_Reader errors

### Requirement 16: 파일명 정규화

**User Story:** 시스템으로서, 업로드된 파일명을 자동으로 정규화하여 파일 시스템 호환성을 보장하고 싶습니다. 이를 통해 특수문자나 공백으로 인한 문제를 방지할 수 있습니다.

#### Acceptance Criteria

1. WHEN THE Local_Storage receives a filename, THE Local_Storage SHALL remove or replace special characters that are not filesystem-safe
2. THE Local_Storage SHALL replace spaces with underscores
3. THE Local_Storage SHALL preserve the file extension
4. THE Local_Storage SHALL preserve Korean characters (Hangul) in filenames
5. THE normalized filename SHALL be returned to the client after successful upload