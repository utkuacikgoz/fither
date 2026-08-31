# ADR-0002: Progression cadence, pattern set, pricing, ops stack

- Status: accepted
- Date: 2026-08-31

## Context

Four decisions blocked the next sessions (movement library, engine,
paywall, launch ops). Resolved by the owner in Q&A; recorded here so no
future session re-litigates them.

## Decision

1. **Tier advance: 3 clean sessions** at the current tier per pattern
   (clean = all of that pattern's blocks completed without "struggled").
   ~1.5 weeks per tier at 2×/week, ~5 days at 4×/week — consistent with
   Gate 1 (push tier 4 by week 12 for the 4×/week persona).
2. **Patterns: push, pull, squat, hinge, core.** Five ladders × six tiers
   = 30 of the 60 movement slots; the rest are variants. Hinge stays
   separate from squat so posterior-chain work can't be crowded out.
3. **Pricing: £5.99/month, £39.99/year, 7-day free trial** (GBP
   reference; other storefronts via Apple price tiers). Annual is the
   lead plan on the paywall.
4. **Ops stack: Sentry** (error monitoring, wired before first
   TestFlight), **PostHog** (analytics, typed event module, offline
   queue, forbidden-list-clean payloads), **Resend** (transactional
   email from our domain), **Canny** (feedback board).

## Consequences

engine-spec.md, movement-schema.md, fither-domain (pricing) and
fither-code (ops stack) updated; the corresponding DECIDE/PROPOSED
markers removed. Still open: daily prompt wording (Brief 3), point
values (Brief 5), regression thresholds (PROPOSED in engine-spec),
state library (zustand PROPOSED).
