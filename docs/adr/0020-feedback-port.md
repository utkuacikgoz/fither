# ADR-0020: Feedback through a port to an endpoint the owner controls

- Status: accepted
- Date: 2026-09-07

## Context

The owner wants users to be able to write feedback in the app and to
receive it. The app has no backend and must work offline. The owner
chose an in-app form posting to a small endpoint over a mail composer,
Settings as the only entry point, and a dedicated address rather than a
personal one in the binary.

## Decision

1. **One port, two adapters** (`app/src/feedback/feedback.ts`): `send`
   resolves true when accepted, false otherwise, never throws. The HTTP
   adapter posts JSON to `EXPO_PUBLIC_FEEDBACK_URL` with a 10 s timeout;
   the dev adapter records in memory. The row exists in release builds
   only when the URL is set.
2. **A queue, not a spinner** (`app/src/state/feedback-store.ts`). A
   refused message persists in AsyncStorage and is retried on every
   foreground and before every later send, oldest first, so delivery
   order holds. She sees "sent" or "saved on this phone"; no error
   state unless the endpoint refuses while online.
3. **What travels**: her words, an email only if she typed one, the app
   version, OS and device name, the date. No account id, no anonymous
   analytics id, nothing about her training. Erase everything clears the
   queue like every other persisted store.
4. **The screen** is the approved mockup: title, field, optional email,
   Send; the sent state is the mark, one line, one soft line, Done.

## Consequences

- The endpoint is the owner's to run (docs/feedback-setup.md). The
  address never appears in the app.
- A message written offline may arrive days later; the `date` field says
  when it was written.
