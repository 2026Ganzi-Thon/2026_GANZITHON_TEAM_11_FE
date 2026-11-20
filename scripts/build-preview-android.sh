#!/usr/bin/env bash
set -euo pipefail

# Keep the signing key and its password file outside the checkout.
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK directory}"
: "${PREVIEW_KEYSTORE_FILE:?Set PREVIEW_KEYSTORE_FILE to a private keystore}"
: "${PREVIEW_PASSWORD_FILE:?Set PREVIEW_PASSWORD_FILE to a private password file}"
: "${ANDROID_BUILD_TOOLS_VERSION:=37.0.0}"
: "${PREVIEW_KEY_ALIAS:=yangsebam-preview}"

if [[ ! -f "$PREVIEW_KEYSTORE_FILE" || ! -f "$PREVIEW_PASSWORD_FILE" ]]; then
  echo 'The preview signing files are missing.' >&2
  exit 1
fi

export APP_VARIANT=preview
node scripts/fetch-fonts.mjs
npx expo prebuild --clean --platform android --no-install
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon --max-workers=2 -I ../scripts/preview-native-paths.gradle \
    -Dorg.gradle.jvmargs='-Xmx2048m -XX:MaxMetaspaceSize=768m' \
    -PreactNativeArchitectures=arm64-v8a,x86_64
)

mkdir -p dist/preview
preview_version=$(node -p "require('./app.config')({ config: {} }).version")
apk="dist/preview/yangsebam-${preview_version}.apk"
tools="$ANDROID_HOME/build-tools/$ANDROID_BUILD_TOOLS_VERSION"
"$tools/apksigner" sign \
  --ks "$PREVIEW_KEYSTORE_FILE" --ks-key-alias "$PREVIEW_KEY_ALIAS" \
  --ks-pass "file:$PREVIEW_PASSWORD_FILE" \
  --v4-signing-enabled false --out "$apk" \
  android/app/build/outputs/apk/release/app-release.apk
"$tools/apksigner" verify --verbose --print-certs "$apk"
"$tools/zipalign" -c -P 16 4 "$apk"
node scripts/verify-preview-apk.cjs "$apk"
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path");const file=process.argv[1];const sum=crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");fs.writeFileSync(file+".sha256",sum+"  "+path.basename(file)+"\n");console.log("APK: "+file);' "$apk"
