#!/bin/sh
# One command to TestFlight, no EAS. Run from anywhere in the repo on the
# Mac that has Xcode:
#
#   pnpm ship            bump the build number, prebuild, archive, upload,
#                        commit and push the bump
#   pnpm ship upload     upload the archive already on disk (a retry after
#                        a failed upload; nothing is rebuilt or re-bumped)
#
# Needs app/.env.production with the production keys (docs/release-builds.md).
# Reads .ship.env at the repo root (gitignored) when it exists:
#
#   ASC_KEY_ID=…         App Store Connect API key, so the upload never
#   ASC_ISSUER_ID=…      depends on Xcode's signed-in session (which
#   ASC_KEY_PATH=…       expired silently on 2026-09-14 and lost three builds)
#   SENTRY_AUTH_TOKEN=…  uploads source maps; without it the build still
#                        ships, unsymbolicated
#
# Every stage writes its full output to ~/fither-build/<stage>.log and
# says so; the terminal shows one timestamped line per stage plus the
# last lines of any log that fails. The archive is kept, so a failed
# upload is retried with `pnpm ship upload`, never rebuilt.
#
# Learned the hard way (2026-09-14): the upload's verdict is read from
# its log, never from a pipe; the pull is followed by an install, so a
# new native module is present before the archive; the bump commit skips
# the local test gate (the code was gated in CI at that commit, and a
# forty-second suite beside an archive failed a green build twice); the
# push rebases first, because main moves during a twenty-minute archive.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"
BUILD_DIR="$HOME/fither-build"
TEAM_ID="9D78WTZAD8"
ASC_APP_ID="6808850285"
MODE="${1:-ship}"
STARTED="$(date +%s)"

say() { printf 'ship %s: %s\n' "$(date +%H:%M:%S)" "$*"; }

# Run one stage with its output in a log; on failure show the tail and stop.
run_logged() {
  name="$1"; shift
  log="$BUILD_DIR/$name.log"
  if ! "$@" > "$log" 2>&1; then
    say "$name FAILED; the last lines of $log:"
    tail -40 "$log"
    exit 1
  fi
}

current_number() {
  node -e 'process.stdout.write(require("./app/app.json").expo.ios.buildNumber)'
}

# The bump is one line in app.json and the code it ships was gated in CI at
# that commit, so it skips the local hooks; main may have moved meanwhile.
commit_bump() {
  cd "$ROOT"
  git add app/app.json
  git commit -q --no-verify -m "Build $1"
  git pull -q --rebase origin main
  git push -q origin main
  say "committed and pushed Build $1"
}

upload() {
  number="$1"
  log="$BUILD_DIR/export.log"
  [ -d "$BUILD_DIR/FITHER.xcarchive" ] || { say "no archive at $BUILD_DIR/FITHER.xcarchive"; exit 1; }
  rm -rf "$BUILD_DIR/export"
  say "uploading $VERSION ($number), 2 to 5 minutes, log $log"
  # shellcheck disable=SC2086
  xcodebuild -exportArchive -archivePath "$BUILD_DIR/FITHER.xcarchive" \
    -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
    -exportPath "$BUILD_DIR/export" -allowProvisioningUpdates $AUTH > "$log" 2>&1 || true
  if grep -q "EXPORT SUCCEEDED" "$log"; then
    # The marker is what a later run reads when the commit below fails:
    # this number is spent.
    touch "$BUILD_DIR/uploaded-$number"
    say "UPLOADED $VERSION ($number)"
    return 0
  fi
  say "upload FAILED:"
  grep -E "error:" "$log" | head -5 || true
  if grep -q "Failed to Use Accounts" "$log"; then
    say "Xcode's Apple ID session has expired. Either add an App Store Connect"
    say "API key to .ship.env (docs/release-builds.md, the durable fix) or open"
    say "Xcode > Settings > Accounts, sign out and in, then: pnpm ship upload"
  else
    say "full log: $log. The archive is kept; after the fix: pnpm ship upload"
  fi
  exit 1
}

cd "$ROOT"
mkdir -p "$BUILD_DIR"
# shellcheck disable=SC1091
[ -f "$ROOT/.ship.env" ] && . "$ROOT/.ship.env"

AUTH=""
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
  [ -f "$ASC_KEY_PATH" ] || { say "ASC_KEY_PATH not found: $ASC_KEY_PATH"; exit 1; }
  AUTH="-authenticationKeyPath $ASC_KEY_PATH -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID"
  say "App Store Connect API key $ASC_KEY_ID"
else
  say "no API key in .ship.env; using Xcode's signed-in account (docs/release-builds.md"
  say "shows the two-minute setup that makes this never expire)"
fi
VERSION="$(node -e 'process.stdout.write(require("./app/app.json").expo.version)')"

if [ "$MODE" = "upload" ]; then
  NUMBER="$(current_number)"
  upload "$NUMBER"
  if [ -n "$(git status --porcelain -- app/app.json)" ]; then commit_bump "$NUMBER"; fi
  say "TestFlight shows it in about ten minutes:"
  say "https://appstoreconnect.apple.com/apps/$ASC_APP_ID/testflight/ios"
  exit 0
fi
[ "$MODE" = "ship" ] || { echo "usage: pnpm ship [upload]"; exit 1; }

# Expo rewrites these two on every start; they are never a change of ours.
git checkout -- app/expo-env.d.ts app/tsconfig.json 2>/dev/null || true

# A dirty tree is refused, with one exception: a build-number bump left
# behind by a run that died after bumping. Uploaded (the marker exists)
# means the number is spent, so it is committed now; not uploaded means
# the number is free, so app.json is reset and the number reused.
DIRTY="$(git status --porcelain | sed 's/^.. //')"
if [ -n "$DIRTY" ]; then
  if [ "$DIRTY" = "app/app.json" ] && [ "$(git diff HEAD --numstat -- app/app.json | cut -f1,2)" = "1	1" ] \
    && git diff HEAD -- app/app.json | grep -q '"buildNumber"'; then
    STALE="$(current_number)"
    if [ -f "$BUILD_DIR/uploaded-$STALE" ]; then
      say "build $STALE was uploaded but never committed; committing it first"
      commit_bump "$STALE"
    else
      say "build $STALE was bumped but never uploaded; the number is reused"
      git checkout -- app/app.json
    fi
  else
    say "commit or stash your changes first:"; git status --short; exit 1
  fi
fi

say "pulling main and installing"
git pull -q --rebase origin main
run_logged install pnpm install --frozen-lockfile

# Fail before changing a build number or spending time in Xcode when a
# production adapter is disabled or the public acquisition/link routes
# are redirected, parked or incomplete. Values are validated by shape
# and never printed.
say "production check"
run_logged production-check pnpm production:check

# Bump ios.buildNumber (a string in app.json); it is committed only after
# the upload succeeds, so the repo records numbers that reached Apple.
NEXT="$(node -e '
const fs = require("fs"); const p = "app/app.json";
const a = JSON.parse(fs.readFileSync(p, "utf8"));
const n = String(Number(a.expo.ios.buildNumber) + 1);
a.expo.ios.buildNumber = n;
fs.writeFileSync(p, JSON.stringify(a, null, 2) + "\n");
process.stdout.write(n);
')"
say "building $VERSION ($NEXT)"

cd "$APP"
say "prebuild (2 to 4 minutes), log $BUILD_DIR/prebuild.log"
run_logged prebuild npx expo prebuild --platform ios --clean

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
  say "no SENTRY_AUTH_TOKEN; source maps will not upload"
  export SENTRY_ALLOW_FAILURE=true
fi

rm -rf "$BUILD_DIR/FITHER.xcarchive" "$BUILD_DIR/export"
cd "$APP/ios"
say "archiving (10 to 20 minutes, silent), log $BUILD_DIR/archive.log"
# shellcheck disable=SC2086
run_logged archive xcodebuild -workspace FITHER.xcworkspace -scheme FITHER -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$BUILD_DIR/FITHER.xcarchive" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration $AUTH \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic archive
[ -d "$BUILD_DIR/FITHER.xcarchive" ] || { say "archive reported success but wrote nothing"; exit 1; }
say "archived"

# What actually got baked into the bundle. Expo inlines EXPO_PUBLIC_* at
# bundle time, inside the Xcode build phase, so the only honest check is
# to read the bundle the archive carries. A build 1.0.0 (1) shipped to
# TestFlight with RevenueCat's Test Store key and App Review rejected it
# (2.1(a), no purchase sheet); that must not happen twice.
BUNDLE="$BUILD_DIR/FITHER.xcarchive/Products/Applications/FITHER.app/main.jsbundle"
if [ -f "$BUNDLE" ]; then
  if grep -q "appl_" "$BUNDLE"; then
    say "store key OK (appl_ in the bundle)"
  elif grep -q "test_" "$BUNDLE"; then
    say "STOP: the bundle carries a RevenueCat test_ key, so no real purchase"
    say "sheet opens and App Review will reject it. Put the appl_ key in"
    say "app/.env.production and run again."
    exit 1
  else
    say "STOP: no RevenueCat key in the bundle; the app ships the dev store"
    say "adapter and nothing can be bought. Check app/.env.production."
    exit 1
  fi
else
  say "no bundle at $BUNDLE; cannot verify which keys shipped"
fi

upload "$NEXT"
commit_bump "$NEXT"
say "done in $(( ($(date +%s) - STARTED) / 60 )) minutes. TestFlight shows $VERSION ($NEXT) in about ten:"
say "https://appstoreconnect.apple.com/apps/$ASC_APP_ID/testflight/ios"
