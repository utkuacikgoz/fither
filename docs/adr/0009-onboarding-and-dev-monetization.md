# ADR-0009: Onboarding flow and development-mode monetization

- Status: accepted
- Date: 2026-09-01

## Context

The owner directed the onboarding and monetization build to start, with
one constraint: no third-party connections yet — everything clickable,
the app-side layer ready so wiring the real provider later is mechanical.
Brief 8 (monetization) does not exist; placement rules are derived from
the decided truth: Gate 3 (first movement in under 60 seconds), the
paywall-as-honest-letter rules, pricing from ADR-0002, and the hard rule
that a paying user offline is never locked out.

## Decision

1. **Onboarding = the drafted three screens** from
   `docs/copy/draft-strings.md` (welcome/tagline, equipment, persistent
   avoid-list), one decision per screen, then straight into the daily
   prompt with the drafted eyebrow handoff. No account, no email, no
   paywall before the first movement — nothing may spend Gate 3 budget
   but those taps. Onboarding runs once; completing it is persisted
   state.
2. **The paywall never blocks the first session.** The 7-day free trial
   starts at the first COMPLETED session (not install — an unused
   install spends no trial). Trial state lives on device.
3. **After trial expiry, the paywall gates generating NEW sessions.**
   History, points, skills and settings remain fully visible forever —
   her record is hers. Restore purchases is always available from the
   paywall and settings.
4. **Billing behind a port.** `app/src/monetization/billing.ts` defines
   the interface (offerings, purchase, restore, current entitlement);
   the only implementation for now is `dev-billing.ts` — in-memory +
   persisted, instant success, no network, no new dependencies. The
   RevenueCat adapter later implements the same interface and nothing
   else changes. Entitlement state is persisted locally and evaluated
   offline; the adapter is consulted opportunistically, never on the
   training path (airplane-mode rule).
5. **Trial/entitlement evaluation is engine-free.** This is app-layer
   policy, not training logic — it must NOT leak into `packages/engine`.
   The one date read uses the same local-date source as the daily
   prompt.

## Consequences

TestFlight-ready flows without any SDK; the RevenueCat wiring (Phase 4)
becomes: implement the adapter, add keys via config, re-run the
offline-lockout review (standing requirement). Paywall copy comes from
docs/copy/draft-strings.md verbatim; any placement change later (e.g.
trial-from-install) is a new ADR.
