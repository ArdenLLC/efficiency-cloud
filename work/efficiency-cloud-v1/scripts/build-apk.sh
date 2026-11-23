#!/usr/bin/env bash
# Usage: bash scripts/build-apk.sh [debug|release]
# Needs: Node 20+, JDK 21, Android SDK (ANDROID_HOME). Reads .env.local if present.
set -euo pipefail
MODE="${1:-debug}"
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
node scripts/check-release.mjs
npm install
npm run build
[ -d android ] || npx cap add android
node scripts/make-android-icons.mjs
node scripts/patch-android.mjs
npx cap sync android
cd android
chmod +x gradlew
if [ "$MODE" = "release" ]; then
  : "${ANDROID_KEYSTORE_PATH:?set ANDROID_KEYSTORE_PATH}" "${ANDROID_KEYSTORE_PASSWORD:?}" "${ANDROID_KEY_ALIAS:?}" "${ANDROID_KEY_PASSWORD:?}"
  ./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file="$ANDROID_KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="$ANDROID_KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$ANDROID_KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$ANDROID_KEY_PASSWORD"
  echo "APK: android/app/build/outputs/apk/release/"
else
  ./gradlew assembleDebug
  echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
fi
