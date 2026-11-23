#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo '需要 Node.js 20+'; exit 1; }
node -e "const v=process.versions.node.split('.')[0]; if (+v < 20) process.exit(1)" || { echo 'Node.js 版本需要 20 或更高'; exit 1; }
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo '已创建 .env.local。请先填写 Supabase URL 和 Publishable Key，再重新运行本脚本。'
  exit 0
fi
if grep -Eq 'YOUR_PROJECT|YOUR_SUPABASE' .env.local; then
  echo '请先编辑 .env.local，填入真实 Supabase URL 与 Publishable Key。'
  exit 1
fi
npm install
npm run build
printf '\nWeb 构建完成：dist/\n'
printf '生成 Android 工程：npm run cap:add:android（需要 Android Studio / SDK）\n'
printf '生成 iOS 工程：npm run cap:add:ios（仅 macOS + Xcode）\n'
