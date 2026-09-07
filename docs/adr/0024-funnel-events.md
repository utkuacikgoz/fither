# ADR-0024: The funnel, as events named for what the platform observed

- Status: accepted
- Date: 2026-09-07
- Extends: ADR-0015 (analytics port and PostHog)

## Context

ADR-0015 shipped four events: arrive, start, finish, try. The growth
waves (docs/implementation-checklist.md) need to see where a fresh
install is lost before the first session and whether the paywall was
ever on screen, and later whether a share was started and a scenario
entered. Every rule from ADR-0015 stands: anonymous, offline queue,
never blocking, closed unions only, nothing the forbidden list can be
written in.

## Decision

1. **Wave 1 adds four events**: `first_use_entry` (a fresh install
   reached its first decision screen), `onboarding_complete`
   (`equipment: floor | chair`), `session_preview` (`minutes`, `blocks`),
   `paywall_view` (`surface: gate | expired | settings`). Sent once per
   occurrence, from the screen that showed it.
2. **Names say what was observed.** A paywall shown is `paywall_view`,
   never "considered" or "seen"; a share sheet opened will be
   `share_start`, never "shared", because iOS does not report delivery.
3. **Reserved for later waves**, added here only when their wave lands
   (so the schema and this ADR stay the single source): `weekly_intention_set`
   (`target: 2 | 3 | none`), `purchase_outcome` (`result: purchased |
   cancelled | failed`, `plan`), `share_eligible` (`source: finish | receipt
   | recap`), `share_start` (`source`, `context: home | hotel | meetings |
   none`), `scenario_entry` (`scenario`: an allowlisted identifier),
   `experiment_exposure` (`experiment`, `variant`), added with ADR-0025 the same day.
4. **Never**: URLs, query strings, identifiers, restrictions, notes,
   locations, device models. Low-cardinality scenario ids only.

## Consequences

- The event list in `app/src/analytics/events.ts` is the schema; its
  test pins the names in funnel order and scans the module for the
  forbidden list.
- docs/posthog-setup.md, docs/feature-set.md and the App Privacy sheet in
  docs/store/listing.md name the same eight events.
- Wave 6 writes the cohort definitions against these names.
