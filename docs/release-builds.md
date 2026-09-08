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

Before the first production upload, replace the default Expo icon/splash with
the approved Brief 6 identity assets. Do not ship placeholder identity. The
production build also remains blocked on Sentry verification (the SDK is
wired behind the monitoring port, ADR-0016; the owner sets the DSN and the
`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` build variables per
docs/sentry-setup.md), real RevenueCat entitlements (ADR-0014; owner's
products and key), a Google sign-in adapter or the button staying hidden
(Apple is wired, ADR-0011), the coach review, and Reality Gates 2 and 3.

The app version is `1.0.0`. EAS owns the store build number remotely and the
production profile increments it for every build, preventing duplicate App
Store build numbers across machines.
