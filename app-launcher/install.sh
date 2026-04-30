#!/bin/bash
# 카드뉴스 자동화 앱을 바탕화면에 설치하는 스크립트

APP_NAME="카드뉴스자동화"
APP_PATH="$HOME/Desktop/${APP_NAME}.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 카드뉴스 자동화 앱을 설치합니다..."

# 기존 앱 제거
rm -rf "$APP_PATH"

# .app 번들 구조 생성
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# 파일 복사
cp "$SCRIPT_DIR/launch.sh" "$APP_PATH/Contents/MacOS/launch.sh"
cp "$SCRIPT_DIR/Info.plist" "$APP_PATH/Contents/Info.plist"

# 실행 권한 부여
chmod +x "$APP_PATH/Contents/MacOS/launch.sh"

echo ""
echo "✅ 설치 완료!"
echo "   바탕화면에 '${APP_NAME}' 앱이 생성되었습니다."
echo "   더블클릭하면 카드뉴스 자동화 시스템이 실행됩니다."
echo ""
echo "💡 Dock에 고정하려면: 앱을 Dock으로 드래그하세요."
