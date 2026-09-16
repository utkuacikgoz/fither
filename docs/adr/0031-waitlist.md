# ADR-0031: The waitlist on fither.pro

- Status: accepted
- Date: 2026-09-16

## Context

The app is in App Store review and the landing page said only "Coming
to the App Store." Interest arriving before the listing is live had
nowhere to go. The owner asked for a waitlist with a first-class UI and
picked design W1 (the field in the hero, one fused pill) from two
rendered options.

## Decision

1. **The form posts to the site's own origin.** `/api/waitlist` is a
   Vercel function in the fither-web repository with no dependencies;
   the browser talks to nobody else, so the page's CSP stays
   `default-src 'none'` with `script-src`, `connect-src` and
   `form-action` opened to `'self'` only.
2. **Storage is Upstash Redis through Vercel's Storage tab.** The
   address, lowercased, once, with the moment it joined (`HSETNX`). The
   visitor's IP is never stored: a one-hour counter per connection lives
   under a hash of it and caps attempts at ten. A honeypot field answers
   "ok" and stores nothing. Without storage configured the answer is
   503, never a silent success.
3. **The owner reads the list as CSV** at `/api/waitlist?key=` with
   `WAITLIST_ADMIN_KEY`; any other key is a 404 (constant-time compare).
4. **Progressive enhancement.** `assets/waitlist.js` answers in place
   (success, invalid, rate-limited, unavailable); without JavaScript the
   form posts and lands on `/waitlist/thanks` or `/waitlist/check`.
   Nothing the visitor typed is ever put into markup.
5. **The promise is the copy**: "One email when it's live. Nothing
   else, ever." The privacy policy names Upstash, the one use, deletion
   within thirty days of that email, and the hashed counter. When the
   app is live the form becomes the App Store button and the list is
   sent once, then deleted.

## Consequences

- Two owner steps in Vercel, documented in fither-web/README.md: create
  the Upstash store and connect it; set `WAITLIST_ADMIN_KEY`.
- The site's test suite covers the function (fake Redis) and the page
  invariants; `npm test` in fither-web.
- Web analytics stay off; the list itself is the only measure of
  pre-launch interest.
