#!/bin/sh
# One command to TestFlight, no EAS: bump the build number, regenerate the
# native project, archive, upload, push the bump. Run from anywhere in the
# repo on the Mac that has Xcode and the Apple account signed in:
#
#   pnpm ship
#
# Needs app/.env.production with the production keys (docs/release-builds.md).
# SENTRY_AUTH_TOKEN in the environment uploads source maps; without it the
# build still ships, unsymbolicated.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"
BUILD_DIR="$HOME/fither-build"
TEAM_ID="9D78WTZAD8"

cd "$ROOT"
git checkout -- app/expo-env.d.ts app/tsconfig.json 2>/dev/null || true
if [ -n "$(git status --porcelain)" ]; then
  echo "ship: commit or stash your changes first"; git status --short; exit 1
fi
git pull -q origin main

# Bump ios.buildNumber (a string in app.json) and commit it, so every
# upload carries a unique number and the repo records which one shipped.
NEXT="$(node -e '
const fs = require("fs"); const p = "app/app.json";
const a = JSON.parse(fs.readFileSync(p, "utf8"));
const n = String(Number(a.expo.ios.buildNumber) + 1);
a.expo.ios.buildNumber = n;
fs.writeFileSync(p, JSON.stringify(a, null, 2) + "\n");
process.stdout.write(n);
')"
VERSION="$(node -e 'process.stdout.write(require("./app/app.json").expo.version)')"
echo "ship: $VERSION ($NEXT)"

cd "$APP"
npx expo prebuild --platform ios --clean

mkdir -p "$BUILD_DIR"
if [ ! -f "$BUILD_DIR/ExportOptions.plist" ]; then
  cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>upload</string>
<key>teamID</key><string>$TEAM_ID</string>
</dict></plist>
PLIST
fi

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "ship: no SENTRY_AUTH_TOKEN, source maps will not upload"
  export SENTRY_ALLOW_FAILURE=true
fi

rm -rf "$BUILD_DIR/FITHER.xcarchive" "$BUILD_DIR/export"
cd "$APP/ios"
xcodebuild -workspace FITHER.xcworkspace -scheme FITHER -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$BUILD_DIR/FITHER.xcarchive" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic archive 2>&1 \
  | grep -E "error:|warning: .*sentry|SUCCEEDED|FAILED" || true
[ -d "$BUILD_DIR/FITHER.xcarchive" ] || { echo "ship: archive failed"; exit 1; }

xcodebuild -exportArchive -archivePath "$BUILD_DIR/FITHER.xcarchive" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
  -exportPath "$BUILD_DIR/export" -allowProvisioningUpdates 2>&1 \
  | grep -E "error:|SUCCEEDED|FAILED"

cd "$ROOT"
git add app/app.json
git commit -q -m "Build $NEXT"
git push -q origin main
echo "ship: $VERSION ($NEXT) uploaded; TestFlight shows it in about ten minutes"
