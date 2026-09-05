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
6. **The store trial is the trial** (owner, 2026-09-05). The free week
   is the introductory offer on BOTH subscription products (so "Start my
   free week" is true whichever plan she picks), started from the
   paywall. The app keeps two facts and no calendar arithmetic: whether
   a session has ever completed (the paywall never blocks the first
   session — ADR-0009 §2 stands), and whether the store entitles her (a
   trial in progress is a purchase record with `trial: true`). After the
   first completed session and until `fither_pro` is active, the day is
   gated with the pre-trial letter; a lapsed trial gates with the expired
   letter, never a second free-week promise. The app-side record stays
   canonical and offline; the launch surface asks the store once per
   launch and adopts its word (grant or revoke) when it has one, so a
   lapse is learned online and airplane mode never locks her out.

## Consequences

- The app-side "7 days from the first completed session" gate is gone
  (`entitlement.ts` reads no clock). The persisted `trialStartDate` key
  keeps its name and now means only "first completed session".
- The lifetime trigger is live wherever the store adapter is: it reads
  `periodType === "TRIAL" && willRenew === false` from customer info.
- Two native modules (`react-native-purchases`, `react-native-purchases-ui`)
  and one (`expo-apple-authentication`, for the sign-in adapter that
  follows): the next build is a rebuild.
- `fither-domain` §Pricing and `fither-voice`'s paywall example carry
  the new prices; the audit's §0 rows 4 and 5 (trial model) are resolved.
