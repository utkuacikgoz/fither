# RevenueCat + App Store: wiring (ADR-0014)

The app already talks to billing through one port (`app/src/monetization/
billing.ts`). The store adapter (`revenuecat-billing.ts`) is selected
the moment the public key is present; without it every build and every
test uses the dev adapter. Nothing else in the app changes.

## What the adapter expects in your dashboards

| Where | Item | Value |
|---|---|---|
| App Store Connect → App | Bundle ID | `com.fitherfitness.app` |
| App Store Connect → Subscriptions | Subscription group | one group, e.g. `FITHER Pro` |
| ↳ product | **yearly** | $59.99 / 1 year, **introductory offer: 7 days free** |
| ↳ product | **monthly** | $12.99 / 1 month, **introductory offer: 7 days free** (so "Start my free week" is true for either plan) |
| App Store Connect → In-App Purchases | **lifetime** | non-consumable, $99 |
| RevenueCat → Project → Apps | iOS app | bundle id above; paste the App Store Connect API key (or shared secret) so RC can validate receipts |
| RevenueCat → Products | import | the three products above appear with ids `Yearly` (capital Y, as created in App Store Connect; ids are case-sensitive and permanent), `monthly`, `lifetime`. The Annual and Monthly packages in the current offering must be of type Annual and Monthly |
| RevenueCat → Entitlements | **fither_pro** | attach all three **App Store** products (the Apple icon), not only the Test Store ones |
| RevenueCat → Offerings | `default` (current) | three packages, one per product, each holding the **App Store** product as well as the Test Store one. Package identifiers can be anything (the adapter matches by product id, then by package type) |
| RevenueCat → API keys | iOS public key | `appl_…` for the real store; `test_…` for the Test Store |

Sandbox: App Store Connect → Users and Access → Sandbox Testers, one
tester Apple ID; sign into it on the device under Settings → App Store →
Sandbox Account. The `test_` key skips Apple entirely (RevenueCat's Test
Store) and is what the app is configured with today.

## The trap that cost two review rounds (2026-10-02)

A new RevenueCat project starts with a **Test Store** app, and the
products, entitlement and offering it seeds belong to it (the **RC**
icon). The `appl_` key reads only the **App Store** app's products (the
**Apple** icon). With an offering that held Test Store products alone,
the store returned nothing to every real build: the paywall fell back to
its reference prices ("$59.99/year" with the "$5.00 a month" line, never
a store price) and the purchase button failed before Apple's sheet
opened. App Review rejected it under 2.1(b).

Two signs, both in a TestFlight build on a real phone:

- **Store is answering**: the price is the store's own string in the
  device's currency (₺ on a Turkish account), and the "$5.00 a month"
  line is gone.
- **Store is silent**: "$59.99/year" with the note. Check the App Store
  products exist, are attached to `fither_pro`, sit in the current
  offering, App Store Connect lists each as at least Ready to Submit, and
  the Paid Apps Agreement is Active.

Since build 8 every one of these failures also reaches Sentry with
RevenueCat's own code (`billing.offerings`, `billing.purchase`).

## The key, in the app

The key is a public client key, but it still stays out of git.

- Locally: `app/.env` (gitignored) —
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY=test_…` (already written).
- EAS builds: `eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_… --environment production`
  (repeat for `preview`; leave `development` on the `test_` key or unset
  to keep the dev adapter).

Expo inlines `EXPO_PUBLIC_*` at bundle time: a build without the
variable ships the dev adapter, which is the honest fallback, never a
broken store.

## What is wired

- Purchase (yearly / monthly on the paywall; lifetime on the day-3
  offer), restore, entitlement check on `fither_pro`, customer-info
  cache, cancelled-vs-failed handling.
- The lifetime offer trigger: `periodType === "TRIAL"`, `willRenew ===
  false`, ≥ 3 days since the trial purchase — asked once, recorded before
  the screen shows.
- "Manage subscription" in Settings → Customer Center
  (`react-native-purchases-ui`), Apple's subscriptions page without the key.
- Not used on purpose: RevenueCat's remote paywall templates. The paywall
  is decided copy on the single copy surface and renders offline.

## The trial model (decided, ADR-0014 §6)

The store trial is the trial. "Start my free week" on the paywall
purchases the plan she picked with its 7 free days; the app gates new
sessions after her first completed session until `fither_pro` is active;
a lapsed trial shows the expired letter. The launch surface asks the
store once per launch and adopts its word. The lifetime offer fires for
real: trial, auto-renew off, day 3.

## Rebuild

Three native modules landed with this change (`react-native-purchases`,
`react-native-purchases-ui`, `expo-apple-authentication`):

```
git pull && rm -rf app/ios && cd app && npx expo run:ios
```

Settings → Developer tools → "[dev] Preview lifetime offer" walks the
day-3 screen against the dev adapter without any store.
