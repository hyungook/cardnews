# 카드뉴스 자동화 실행 방법

## ⚙️ 환경 변수 설정

서버를 실행하기 전에 환경 변수를 설정해야 합니다.

### 1. `.env` 파일 생성

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 서버 설정
NODE_ENV=development
PORT=3000

# 파일 저장 경로
BASE_DIR=./images

# 파일 업로드 제한
MAX_FILE_SIZE=20971520        # 20MB (바이트 단위)
MAX_CONCURRENT_UPLOADS=40     # 동시 업로드 제한 (로고 + 배경 합계)

# 자동 삭제 설정
CLEANUP_DAYS=30               # 결과물 보관 일수

# 로깅 설정
LOG_LEVEL=info                # debug, info, warn, error 중 선택

# CORS 설정 (선택사항)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 2. 환경 변수 설명

| 변수명 | 설명 | 기본값 | 예시 |
|--------|------|--------|------|
| `NODE_ENV` | 실행 환경 | `development` | `development`, `production`, `test` |
| `PORT` | 서버 포트 | `3000` | `3000`, `8080` |
| `BASE_DIR` | 이미지 저장 경로 | `./images` | `./images`, `/var/data/images` |
| `MAX_FILE_SIZE` | 최대 파일 크기 (바이트) | `20971520` (20MB) | `10485760` (10MB) |
| `MAX_CONCURRENT_UPLOADS` | 동시 업로드 제한 | `40` | `20`, `50` |
| `CLEANUP_DAYS` | 결과물 보관 일수 | `30` | `7`, `60` |
| `LOG_LEVEL` | 로그 레벨 | `info` | `debug`, `info`, `warn`, `error` |
| `ALLOWED_ORIGINS` | CORS 허용 오리진 (쉼표 구분) | `http://localhost:5173,http://localhost:3000` | 외부 접근 시 도메인 추가 |

### 3. 외부 접근 설정

외부에서 접속 가능하게 하려면:

```bash
# .env 파일에 추가
ALLOWED_ORIGINS=http://localhost:5173,http://your-domain.com,https://your-domain.com
```

그리고 서버를 `0.0.0.0`으로 바인딩하려면 `packages/server/src/index.ts`에서:

```typescript
app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`서버가 포트 ${env.PORT}에서 실행 중입니다`);
});
```

---

## 🚀 방법 1: 터미널에서 실행 (권장)

가장 간단하고 안정적인 방법입니다.

### 프로젝트 폴더에서 실행
```bash
cd /Users/ohhyungook/KIRO
npm run dev
```

### 또는 실행 스크립트 사용
```bash
cd /Users/ohhyungook/KIRO
./start.sh
```

### 또는 앱 런처 스크립트 사용 (디버깅 가능)
```bash
cd /Users/ohhyungook/KIRO
./app-launcher/launch-terminal.sh
```

실행 후 브라우저에서 자동으로 열리거나, 수동으로 http://localhost:5173 을 열면 됩니다.

---

## 📱 방법 2: 앱 아이콘으로 실행

### 앱 재설치
```bash
cd /Users/ohhyungook/KIRO/app-launcher
./install.sh
```

바탕화면에 "카드뉴스자동화.app" 아이콘이 생성됩니다.

### 앱 실행 시 문제 해결

#### 1. 로그 확인
앱이 실행되지 않으면 바탕화면의 `카드뉴스자동화.log` 파일을 확인하세요.

#### 2. 보안 설정
macOS가 앱 실행을 차단할 수 있습니다:
- **시스템 설정 > 개인정보 보호 및 보안**으로 이동
- "확인되지 않은 개발자" 경고가 있으면 **"확인 없이 열기"** 클릭

#### 3. 실행 권한 확인
```bash
chmod +x ~/Desktop/카드뉴스자동화.app/Contents/MacOS/launch.sh
```

---

## 🛑 서버 종료

### 터미널에서 실행한 경우
터미널에서 `Ctrl + C` 를 누르면 종료됩니다.

### 앱으로 실행한 경우
```bash
# 포트 3000, 5173을 사용하는 프로세스 종료
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

---

## 💡 추천 방법

**터미널에서 실행하는 것을 권장합니다:**
- 오류 메시지를 바로 확인 가능
- 로그를 실시간으로 볼 수 있음
- 종료가 간편함 (Ctrl+C)

앱 아이콘은 편리하지만 macOS의 보안 제약과 환경 변수 문제로 인해 문제가 발생할 수 있습니다.

---

## 🔧 문제 해결

### Node.js를 찾을 수 없다는 오류
```bash
# Node.js 설치 확인
node --version
npm --version

# 설치되지 않았다면
# https://nodejs.org 에서 다운로드
```

### 포트가 이미 사용 중이라는 오류
```bash
# 포트 사용 중인 프로세스 종료
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### 의존성 오류
```bash
# 의존성 재설치
cd /Users/ohhyungook/KIRO
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
cd packages/web
npm install --legacy-peer-deps
```
