#!/bin/bash
# 카드뉴스 자동화 시스템 실행기

# 현재 스크립트 위치에서 프로젝트 루트 찾기
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# 스크립트가 app-launcher 폴더에 있으므로 상위 디렉토리가 프로젝트 루트
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 로그 파일 경로
LOG_FILE="$HOME/Desktop/카드뉴스자동화.log"
echo "=== 카드뉴스 자동화 시작: $(date) ===" > "$LOG_FILE"

# macOS GUI 환경에서 실행 시 쉘 프로파일 로드 (PATH 설정 필요)
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc" 2>/dev/null
elif [ -f "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile" 2>/dev/null
elif [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" 2>/dev/null
fi

# 추가 PATH 보장 (Homebrew, NVM 등)
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/*/bin:/usr/bin:/bin:$PATH"

# NVM 사용 시 로드
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "PATH: $PATH" >> "$LOG_FILE"
echo "Node: $(which node)" >> "$LOG_FILE"
echo "Node version: $(node --version 2>&1)" >> "$LOG_FILE"

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js를 찾을 수 없습니다" >> "$LOG_FILE"
    osascript -e 'display alert "Node.js가 설치되어 있지 않습니다" message "https://nodejs.org 에서 Node.js를 설치해주세요.\n\n로그: ~/Desktop/카드뉴스자동화.log" as critical'
    exit 1
fi

# 프로젝트 디렉토리 확인
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 프로젝트 폴더를 찾을 수 없습니다: $PROJECT_DIR" >> "$LOG_FILE"
    osascript -e "display alert \"프로젝트 폴더를 찾을 수 없습니다\" message \"$PROJECT_DIR 경로를 확인해주세요.\n\n로그: ~/Desktop/카드뉴스자동화.log\" as critical"
    exit 1
fi

cd "$PROJECT_DIR"
echo "프로젝트 디렉토리: $(pwd)" >> "$LOG_FILE"

# 의존성 확인 및 재설치
echo "의존성 확인 중..." >> "$LOG_FILE"

# node_modules가 없거나 문제가 있으면 재설치
if [ ! -d "node_modules" ] || [ ! -d "packages/server/node_modules" ] || [ ! -d "packages/web/node_modules" ]; then
    echo "⚠️ node_modules가 없습니다. 전체 재설치 중..." >> "$LOG_FILE"
    rm -rf node_modules package-lock.json
    rm -rf packages/*/node_modules packages/*/package-lock.json
    npm install >> "$LOG_FILE" 2>&1
    
    # 웹 패키지는 legacy-peer-deps로 설치
    cd "$PROJECT_DIR/packages/web"
    npm install --legacy-peer-deps >> "$LOG_FILE" 2>&1
    cd "$PROJECT_DIR"
fi

# sharp 모듈 재빌드 (이미지 처리 라이브러리)
echo "sharp 모듈 재빌드 중..." >> "$LOG_FILE"
cd "$PROJECT_DIR/packages/server"
npm rebuild sharp >> "$LOG_FILE" 2>&1
cd "$PROJECT_DIR"

# 이전 프로세스 정리
echo "이전 프로세스 정리 중..." >> "$LOG_FILE"
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# npm run dev 실행 (루트에서 concurrently로 백엔드+프론트엔드 동시 실행)
echo "서버 시작 중..." >> "$LOG_FILE"
npm run dev >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "서버 PID: $SERVER_PID" >> "$LOG_FILE"

# 서버 준비 대기 (최대 30초)
echo "서버 준비 대기 중..." >> "$LOG_FILE"
for i in {1..30}; do
    if curl -s http://localhost:3000/api/config/status > /dev/null 2>&1; then
        echo "✅ 백엔드 서버 준비 완료 (${i}초)" >> "$LOG_FILE"
        break
    fi
    sleep 1
done

for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ 프론트엔드 서버 준비 완료 (${i}초)" >> "$LOG_FILE"
        break
    fi
    sleep 1
done

# 브라우저 자동 열기
echo "브라우저 열기..." >> "$LOG_FILE"
open "http://localhost:5173"

# 성공 알림
osascript -e 'display notification "브라우저에서 http://localhost:5173 이 열렸습니다" with title "카드뉴스 자동화" sound name "Glass"'

# 종료 시 프로세스 정리
cleanup() {
    echo "=== 종료: $(date) ===" >> "$LOG_FILE"
    kill $SERVER_PID 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
}
trap cleanup EXIT INT TERM

# 프로세스가 끝날 때까지 대기
wait
