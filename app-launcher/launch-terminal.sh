#!/bin/bash
# 터미널에서 카드뉴스 자동화 시스템 실행 (디버깅용)

# 현재 스크립트 위치에서 프로젝트 루트 찾기
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== 카드뉴스 자동화 시작 ==="
echo "프로젝트 경로: $PROJECT_DIR"
echo ""

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js를 찾을 수 없습니다"
    echo "   https://nodejs.org 에서 Node.js를 설치해주세요."
    exit 1
fi

echo "✅ Node.js 버전: $(node --version)"
echo "✅ npm 버전: $(npm --version)"
echo ""

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR"

# 의존성 확인
if [ ! -d "node_modules" ]; then
    echo "📦 의존성 설치 중..."
    npm install
fi

# 이전 프로세스 정리
echo "🧹 이전 프로세스 정리 중..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# 서버 시작
echo ""
echo "🚀 서버 시작 중..."
echo "   백엔드: http://localhost:3000"
echo "   프론트엔드: http://localhost:5173"
echo ""
echo "종료하려면 Ctrl+C를 누르세요"
echo ""

# 종료 시 프로세스 정리
cleanup() {
    echo ""
    echo "🛑 서버 종료 중..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    echo "✅ 종료 완료"
}
trap cleanup EXIT INT TERM

# npm run dev 실행
npm run dev
