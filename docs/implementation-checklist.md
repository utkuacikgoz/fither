# Growth waves: implementation checklist (owner brief 2026-09-07)

Durable record of the six-wave brief, the sequence, and what is done.
Status words: `planned`, `built` (on the feature branch, tests green),
`approved` (owner saw the screen), `validated` (device or human check
done), `live` (external flow reachable by a real user). Nothing below is
`live` until the store listing and domain exist.

## Sequence

1. **First use** (this increment). Guest by default; welcome promise on
   the equipment screen; restrictions asked once, with "remember these";
   preview explains the session from engine facts; funnel events.
2. **First session rewarding, weekly consistency.** Receipt on the finish;
   weekly intention (2, 3, none); week view on Home; weekly recap; share
   from receipts and recaps; streak pressure out of the CTA and reminders.
3. **Sharing loop and recipient page.** Share image with a chosen public
   context; recipient web page; scenario identifiers; universal links
   where infrastructure exists.
4. **Changing circumstances and workout usability.** Home/Hotel presets;
   quiet movements separate from coaching audio; floor-distance
   readability; calibration proposal for coach review; demo asset briefs.
5. **Monetization experiment.** One vs three qualifying free sessions,
   deterministic assignment, production default unchanged, dev preview.
6. **Measurement and pilot.** Typed funnel ADR, cohort definitions,
   friend pilot brief, three marketing treatments.

## Wave 1: first use

| item | status | where |
|---|---|---|
| Guest identity assigned automatically on first launch; existing identities preserved; Sign in with Apple in Settings → Account | built, awaiting screen approval | launch-screen, identity-store, account-section |
| Welcome promise on the equipment screen; welcome-only screen retired | built, awaiting screen approval | onboarding-screen |
| Restrictions once: first-session soreness step offers "Remember for every session"; onboarding avoid step retired for first use; nothing discarded | built, awaiting screen approval | onboarding-screen, daily-prompt-screen, settings-store |
| Preview explains the session from engine facts (minutes and blocks, avoided areas, energy, quiet, equipment, soft landing, stale focus, taste) | built, awaiting screen approval | session-preview-screen, engine adaptations (read only) |
| Funnel events: first_use_entry, onboarding_complete, session_preview, paywall_view, experiment_exposure (ADR-0024) | built | analytics/events.ts |
| Under-60-second first movement: no simulator in this environment, timing not measured here; the taps from first launch to the first movement are now: equipment, minutes, energy, quiet, All good, Start, Begin (7 taps, one screen fewer than before); five-user observation still owner's | not measured | docs/gate-3-protocol.md |

## Wave 2: layer built, screens awaiting approval

| item | status | where |
|---|---|---|
| Intention store (2, 3, none), week view over the engine's participation, receipts (completed, partial, hard, empty), weekly reminder bodies, streak pressure out of Home | built | state/intention-store, state/week-view, session/receipt, notifications/invitation-body |
| Home week tile, finish receipt, intention ask, weekly recap, share from receipt | mockups sent, awaiting approval | docs/design/mockups |

## Wave 3: recipient page built, in-app share awaiting approval

| item | status | where |
|---|---|---|
| Static recipient page, allowlisted scenarios, association template, README, 12 tests, previews | built (not live: domain, listing, collector are external) | web/ |
| scenario_entry event from /s/<id> links, allowlist in events.ts | built | analytics/deep-link.ts |
| Share image with chosen context, share from receipts and recaps, re-pick after install | mockup approved (share-receipt); build pending the finish receipt approval | |

## Wave 4: documents written, screens awaiting approval

| item | status | where |
|---|---|---|
| Where I train (Home, Hotel) preset, quiet movements separate from the voice, floor-distance work phase | mockups sent, awaiting approval | docs/design/mockups |
| Calibration proposal for coach review | written | docs/calibration-proposal.md |
| Demonstration asset briefs, first six | written | docs/demo-asset-briefs.md |

## Wave 5: monetization experiment (built early, no UI)

| item | status | where |
|---|---|---|
| Deterministic persistent assignment, `EXPO_PUBLIC_EXPERIMENT_FREE_SESSIONS` off by default, dev override | built | monetization/experiment.ts, state/experiment-store.ts |
| Allowance in the entitlement policy; qualifying count persisted, migrated, replay-safe; journal keeps the count | built | monetization/entitlement.ts, state/entitlement-store.ts, completion-journal.ts |
| Dev previewer for both variants | built | settings-dev-tools |
| ADR-0025 with qualification semantics and the evaluation plan | written | docs/adr/0025 |

## Wave 6: measurement (documents)

| item | status | where |
|---|---|---|
| Cohorts, queries, limits | written | docs/measurement.md |
| Friend pilot brief | written | docs/growth/pilot-brief.md |
| Three treatments with recipient copy and in-app scenario | written | docs/growth/treatments.md |

## Waves 2 to 6

Recorded in the sequence above; each opens with its own table when it
starts. Owner decisions taken so far that these waves must honour:
streak allowed but never threatened (ADR-0018); "Hard today" counts
(ADR-0023); backend only after launch (ADR-0022); no Google sign-in.

## Gates every increment runs

`pnpm typecheck`, `pnpm test`, `pnpm bundle:ios` when config or
dependencies change, `pnpm release:check`, the sim on any engine or data
change. Device and human checks are listed as not performed when this
environment cannot run them.
