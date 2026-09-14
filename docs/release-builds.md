# iOS release builds

The repository carries four EAS build profiles in `app/eas.json`. They use
EAS's named `development`, `preview`, and `production` environments so values
cannot silently leak from one release surface to another.

| Profile | Purpose | Distribution |
|---|---|---|
| `development-simulator` | Local native debugging in the iOS Simulator | Simulator app |
| `development` | Native debugging on registered iPhones | Internal |
| `preview` | Release-mode product and Gate 3 testing | Internal |
| `production` | TestFlight and App Store submission | App Store |

`pnpm release:check` validates the native identity, version alignment,
required development-client dependency, profile isolation, and production
auto-increment policy. It runs in both the pre-commit hook and CI. CI also runs
`pnpm bundle:ios`, which makes Metro resolve and export the complete production
JavaScript graph before a change can merge.

After a `main` push, release work is not complete until GitHub CI succeeds for
that exact commit. An EAS build is a separate gate: when one is triggered or
required, confirm its final status with `eas build:list` and retain the build
URL. Do not infer EAS success from GitHub CI or from a local Expo export.

## Shipping to TestFlight: `pnpm ship` (the path in use)

The owner builds on the Mac and uploads straight to App Store Connect.
Nothing here needs an Expo account. The script is
`scripts/ship-testflight.sh`; everything below is what it does and what
to do when it stops.

### The commands

```
cd ~/fither
pnpm ship             # ~20 min: pull, install, check, bump, prebuild, archive, upload, push
pnpm ship upload      # retry only the upload of the archive on disk
```

That is the whole routine. The script pulls and installs itself, refuses
a dirty tree (except its own leftover bump, which it sorts out), and
prints one timestamped line per stage. Every stage's full output is in
`~/fither-build/<stage>.log`; a failing stage prints its last forty lines.
When it ends it prints the TestFlight URL; the build shows there in about
ten minutes.

### One-time setup (two minutes each)

1. **Production keys** in `app/.env.production` (gitignored), read on top
   of `app/.env`:

   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
   EXPO_PUBLIC_SENTRY_DSN=https://…ingest.us.sentry.io/…
   EXPO_PUBLIC_POSTHOG_KEY=phc_…
   EXPO_PUBLIC_SHARE_BASE_URL=https://fither.pro
   EXPO_PUBLIC_FEEDBACK_URL=https://…
   ```

   A missing key ships that port's dev adapter. `pnpm production:check`
   validates the values by shape without printing them and verifies the
   live routes; the script runs it before touching anything, and after
   the archive it reads the bundle to confirm the `appl_` key is inside.

2. **App Store Connect API key** in `.ship.env` at the repo root
   (gitignored; `.ship.env.example` is the template). App Store Connect →
   Users and Access → Integrations → App Store Connect API → Team Keys →
   **+**, name `ship`, access **App Manager**. Download the `.p8` once
   (Apple never offers it again) to
   `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8` and write the
   three values. With the key, the upload never depends on Xcode's
   signed-in Apple ID, whose session expired silently on 2026-09-14 and
   cost three builds. Without it the script still works and says so.

3. Optional: `SENTRY_AUTH_TOKEN` (an org token with `project:releases`
   and `org:read`) in the same file uploads source maps; without it
   crashes arrive unsymbolicated.

### When it stops

| The script says | What happened | What to do |
|---|---|---|
| `commit or stash your changes first` | Real uncommitted work | Commit or stash, run again |
| `build N was uploaded but never committed` | A previous run died after the upload | Nothing; it commits N and builds N+1 |
| `build N was bumped but never uploaded` | A previous run died before the upload | Nothing; it reuses N |
| `production-check FAILED` | A key missing or a route not 200 | Fix `app/.env.production` or the site, run again |
| `prebuild FAILED` / `archive FAILED` | Native build error; the log tail is on screen | Fix, run again (a new number is used only after an upload) |
| `STOP: the bundle carries a RevenueCat test_ key` | Wrong key in `.env.production` | Put the `appl_` key in, run again |
| `upload FAILED … Failed to Use Accounts` | Xcode's Apple ID session expired | Add the API key (above), or Xcode → Settings → Accounts, sign out and in; then `pnpm ship upload` |
| `upload FAILED` (anything else) | Read `~/fither-build/export.log` | Fix, then `pnpm ship upload` |
| Push rejected at the very end | Main moved and the rebase conflicted | `git pull --rebase origin main && git push origin main` |

Never bump `ios.buildNumber` by hand; the script owns it and commits it
only after Apple has the build. `ITSAppUsesNonExemptEncryption` is false
in `app.json`, so there is no compliance question per build.

### What the script does, for the record

Pull and `pnpm install --frozen-lockfile`; `pnpm production:check`; bump
`ios.buildNumber`; `expo prebuild --platform ios --clean`; `xcodebuild
… archive` (team `9D78WTZAD8`, bundle `com.fitherfitness.app`, automatic
signing); read the archived `main.jsbundle` for the store key;
`xcodebuild -exportArchive` with `method app-store-connect`,
`destination upload` and the API key when configured, verdict read from
the log; commit `Build N` with `--no-verify` (one line, code already
gated in CI at that commit), rebase, push.

## One-time account setup

These actions require the owner's Expo and Apple accounts and cannot be
completed from an anonymous build environment:

1. Enrol in the Apple Developer Program and confirm that `com.fitherfitness.app` is
   available to the owner's team. If it is not, change it once before the
   first uploaded build and update the release validator in the same commit.
2. From `app/`, authenticate with EAS CLI and run `eas init`. Commit only the
   generated EAS project ID in app config; credentials and tokens stay out of
   git.
3. Create the `development`, `preview`, and `production` EAS environments.
   Client-side `EXPO_PUBLIC_` values are public in the shipped binary. Service
   tokens used only by a build job belong in sensitive or secret EAS values.
4. Let EAS manage signing credentials. Do not export certificates or
   provisioning profiles into this repository.

## Build commands

Run these from `app/` with a compatible EAS CLI; `app/eas.json` enforces the
minimum supported CLI version.

```sh
eas build --platform ios --profile development-simulator
eas build --platform ios --profile development
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

The EAS profiles above are kept for a future CI-driven build; the
shipping path today is `pnpm ship`.

The app version is `1.0.0`. The store build number lives in
`app/app.json` (`ios.buildNumber`) and `pnpm ship` owns it; under EAS the
production profile would increment it remotely instead.
