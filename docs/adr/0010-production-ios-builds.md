# ADR-0010: Production iOS builds

- **Status:** accepted
- **Date:** 2026-09-01

## Context

The Expo app had no source-controlled EAS configuration, native development
client, store build-number policy, or machine check protecting its release
identity. A local Expo Go session was sufficient for UI work but could not
prove that native dependencies, signing, internal distribution, and App Store
builds share a deliberate configuration.

## Decision

- Version 1 is iOS-only and starts at app version `1.0.0`, native build `1`.
- `com.fither.app` was the intended identifier; `com.fitherfitness.app` is the one registered (2026-09-08, `com.fither.app` was taken), subject to the
  owner's final Apple-team availability check before the first upload.
- EAS provides four profiles: simulator development, physical-device
  development, internal preview, and production store distribution.
- Each profile selects its matching named EAS environment. Environment values
  and credentials are not committed in `eas.json`.
- EAS owns build numbers remotely; production builds auto-increment them so two
  machines cannot upload the same build number.
- `expo-dev-client` is part of the app so native SDK integrations can be tested
  before TestFlight rather than relying on Expo Go.
- `pnpm release:check` protects this configuration locally and in CI.

## Consequences

The repository can now produce consistent build variants once the owner links
an Expo project and Apple team. Account linking, signing, identity assets, and
the first cloud build remain deliberate external gates; none is simulated or
stored in git. Adding an Android target is a later product decision and will
require extending both the build profiles and release validator.
