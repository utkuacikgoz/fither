# ADR-0022: A backend on Supabase, shipped in the first update, never on the training path

- Status: accepted
- Date: 2026-09-07
- Refines: ADR-0011 (auth port, guest first), ADR-0020 (feedback port)
- Owner decision: Supabase; sync in the first update, not at launch

## Context

FITHER has no backend by design: the engine runs on the phone, RevenueCat
holds entitlements, PostHog and Sentry take telemetry, a form endpoint
takes feedback. That is right for launch and stays right for training.
What it cannot do: bring her history to a new phone, survive a reinstall,
or satisfy Apple's account-deletion rule once accounts are real. The
owner chose Supabase over Firebase or a custom API, and chose to launch
offline-only and ship sync in the first update.

## Decision

1. **Supabase, one project.** Postgres with row-level security, Supabase
   Auth (Apple and Google) behind the existing auth port, edge functions
   for the few server-side actions. No servers of our own.
2. **The phone stays the source of truth.** Session generation,
   progression, points and streaks never move server-side (CLAUDE.md hard
   rule; airplane mode must keep working). The backend is a copy, not an
   authority.
3. **Append-only sync.** After each committed session the app pushes the
   session record and the current profile, ledger and settings snapshot.
   On sign-in on a new phone it pulls them and rebuilds state through the
   same engine boundary (`applyResult` replay or snapshot restore, decided
   in the sync ADR). History only grows, so there is no merge logic. An
   offline queue like feedback's retries oldest first.
4. **Guest stays local.** No account, no sync, nothing sent. Sign-in is
   the only door to the backend, and it never gates training (ADR-0011).
5. **What is stored.** History entries, profile, ledger, settings, care
   notes only if the owner decides so in the sync ADR (default: no, they
   stay on the phone as promised). Never analytics ids, never anything on
   the forbidden list. Feedback moves onto the same project later.
6. **Account deletion** ships with sync: a Settings row, an edge function
   that deletes the auth user and every row, and the on-device erase.
7. **Owner dashboard** reads the database directly, owner only, after
   launch. Not part of the app.

## Order of work, each its own ADR and PR

1. Schema, RLS policies, migration script, a test that no user can read
   another's rows.
2. Auth adapter behind the port; account deletion function and row.
3. Sync adapter: push after commit, pull on sign-in, offline queue.
   Airplane mode test unchanged.
4. Feedback endpoint moved onto the project.
5. Dashboard.

## Consequences

- Launch is unchanged: no new dependency, no new network path. The
  sign-in copy keeps promising nothing until step 3 ships (ADR-0011 §5).
- The offline-lockout review re-runs when the Supabase SDK lands (same
  trigger as every ops SDK).
- Nothing in `packages/engine` changes for any of this.
