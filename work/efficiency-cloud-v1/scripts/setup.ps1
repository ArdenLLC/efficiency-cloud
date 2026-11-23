$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) { throw '需要 Node.js 20 或更高版本' }
if (!(Test-Path '.env.local')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host '已创建 .env.local。请填写 Supabase URL 与 Publishable Key 后重新运行。'
  exit 0
}
$content = Get-Content '.env.local' -Raw
if ($content -match 'YOUR_PROJECT|YOUR_SUPABASE') { throw '请先编辑 .env.local 填入真实 Supabase 配置。' }
npm install
npm run build
Write-Host 'Web 构建完成：dist/'
Write-Host 'Android: npm run cap:add:android（需要 Android Studio / SDK）'
Write-Host 'iOS: npm run cap:add:ios（仅 macOS + Xcode）'
