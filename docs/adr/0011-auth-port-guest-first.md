# ADR-0011: Sign-in behind a port, guest-first

- Status: accepted
- Date: 2026-09-01

## Context

The owner directed a sign-in flow: Apple and Google sign-in only, plus a
guest path, all clickable for testing — with the same constraint as
ADR-0009's monetization: no third-party connection yet, the app-side
layer ready so wiring real providers later is mechanical. The product's
hard rules bound the design: the training loop is fully on-device and
must work in airplane mode, and nothing may spend Gate 3's
60-second budget.

## Decision

1. **Guest is first-class, not a fallback.** "Continue without an
   account" sits with equal visual dignity beside the provider buttons.
   Every feature the product has today works identically for a guest —
   training, progression, points, skills, trial, purchase. An account
   currently adds nothing functional; the flow exists so launch-day
   wiring is a swap, not a build.
2. **Apple and Google only.** No email/password, no magic links — no
   credentials for a solo developer to hold. Apple sign-in is mandatory
   for the App Store the moment any third-party sign-in ships, so the
   pair travels together.
3. **Auth behind a port.** `app/src/auth/auth.ts` defines the interface
   (current identity, signInWithApple, signInWithGoogle, continueAsGuest,
   signOut); `dev-auth.ts` is the only implementation for now —
   persisted locally, instant success, no network, no new dependencies.
   Real adapters later implement the same interface and nothing else
   changes.
4. **Sign-in never gates training.** The screen appears once in the
   first-run flow (before onboarding), and guest is one tap — the flow
   may cost Gate 3 at most that single tap. Signed-out later ≠ locked
   out: identity is not consulted on the training path, and entitlements
   remain on-device per ADR-0009. Airplane mode changes nothing.
5. **Honest copy about what an account does.** Until real sync exists,
   the screen must not promise cloud backup or cross-device progress.
   The copy-writer owns the words; the rule is: no feature promises
   ahead of the feature.
6. **No profile data collection.** Sign-in yields an identity token and
   nothing else. No name/photo prompts, no birthday, nothing the
   forbidden list even brushes against. The profile screen shows
   capability (tiers, skills, points), not identity.

## Consequences

- Installs that predate this decision (history exists, identity null)
  see the sign-in screen once on their next launch — deliberate: one
  guest tap, the resume decision still wins over it, and pre-launch
  there are no such users outside the build team.

- A future backend (sync, account deletion email flows per the launch
  checklist) plugs in behind the port; account deletion UI becomes
  mandatory (Apple rule) only once real accounts exist.
- The dev adapter must be excluded from release builds the same way
  dev-billing is handled, and the offline-lockout review re-runs when a
  real auth SDK lands (same trigger as the ops SDKs).
