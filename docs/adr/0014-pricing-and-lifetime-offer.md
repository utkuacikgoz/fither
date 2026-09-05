# ADR-0014: Pricing, the lifetime offer, and the store adapter

- Status: accepted
- Date: 2026-09-05
- Supersedes: ADR-0002 §3 (prices)

## Context

The owner set new prices during the audit-and-ship review and created
the RevenueCat project and Apple Developer account, which unblocks the
real billing adapter ADR-0009 §4 designed the port for. ADR-0002's
prices were GBP reference prices for a UK-first launch.

## Decision

1. **Prices (USD, App Store tiers localise elsewhere):** $59.99 a year
   (led, preselected), $12.99 a month, and a **$99 lifetime** purchase.
   The 7-day free trial is the yearly product's introductory offer.
2. **The lifetime plan is never on the paywall.** It is offered **once**,
   on **day 3 of the store's free trial**, only to someone who has
   **switched off auto-renew**. The store is the only source of that
   fact (`periodType === "TRIAL" && willRenew === false`); the app
   records only that it has asked, and writes that record before the
   screen mounts, so a crash can lose an ask but never repeat one.
3. **The store adapter** (`revenuecat-billing.ts`) implements the
   unchanged billing port. Entitlement `fither_pro`; products `yearly`,
   `monthly`, `lifetime`, matched by product id then package type. The
   app-side entitlement store stays canonical and offline-evaluated: a
   paying user in airplane mode is never locked out, and nothing on the
   training path waits on the store. The adapter is selected only when
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set; every test and any checkout
   without the key keeps the dev adapter.
4. **The paywall keeps its own letter.** RevenueCat's remote paywall
   templates are not used: the letter is decided copy on the single copy
   surface, audited for the forbidden list, and renders offline.
   Customer Center is used for "Manage subscription" in Settings, with
   Apple's subscriptions page as the fallback without the key.
5. **Closing the store sheet is not a failure.** The port distinguishes
   `cancelled` from `failed`; only a process failure shows the retry line.

## Consequences

- The trial model question is now live: the app-side trial (starts at
  the first completed session, gates on day 7 — ADR-0009 §2) and the
  store's introductory trial (starts at subscription) are two free
  weeks. **DECIDE (owner):** either the paywall's "Start my free week"
  starts the store trial and the app-side gate becomes "paywall when
  the store says so", or the app-side week stays and the store product
  has no introductory offer. The lifetime trigger needs a store trial to
  exist; until that decision it fires only in the dev previewer.
- Two native modules (`react-native-purchases`, `react-native-purchases-ui`)
  and one (`expo-apple-authentication`, for the sign-in adapter that
  follows): the next build is a rebuild.
- `fither-domain` §Pricing and `fither-voice`'s paywall example carry
  the new prices; the audit's §0 row 4 is resolved.
