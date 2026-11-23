# Usage: powershell -File scripts/build-apk.ps1 [debug|release]
param([string]$Mode = "debug")
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (Test-Path .env.local) { Get-Content .env.local | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim()) } }
node scripts/check-release.mjs
npm install; npm run build
if (-not (Test-Path android)) { npx cap add android }
node scripts/make-android-icons.mjs; node scripts/patch-android.mjs
npx cap sync android
Set-Location android
if ($Mode -eq "release") {
  .\gradlew.bat assembleRelease "-Pandroid.injected.signing.store.file=$env:ANDROID_KEYSTORE_PATH" "-Pandroid.injected.signing.store.password=$env:ANDROID_KEYSTORE_PASSWORD" "-Pandroid.injected.signing.key.alias=$env:ANDROID_KEY_ALIAS" "-Pandroid.injected.signing.key.password=$env:ANDROID_KEY_PASSWORD"
  Write-Host "APK: android\app\build\outputs\apk\release\"
} else { .\gradlew.bat assembleDebug; Write-Host "APK: android\app\build\outputs\apk\debug\app-debug.apk" }
