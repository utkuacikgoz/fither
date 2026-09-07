# Feedback: her words reach you

Owner decision 2026-09-07: Settings → Account → Send feedback opens a
page with a text field, an optional email and Send. The app posts one
JSON document to an endpoint you own, which emails you. Nothing else
about her leaves the phone.

## What you set

`EXPO_PUBLIC_FEEDBACK_URL` in the build environment (EAS secrets or
`.env`), an `https://` URL. Without it the row does not exist in release
builds; dev builds show it backed by an in-memory adapter.

## What the endpoint receives

One `POST`, `Content-Type: application/json`:

```json
{
  "_subject": "FITHER feedback (1.0.0)",
  "message": "The rest timer is too short.",
  "email": "",
  "appVersion": "1.0.0",
  "device": "ios 18.0 iPhone",
  "date": "2026-09-07"
}
```

`email` is empty unless she typed one. `device` is OS, OS version and
the device name expo-constants reports; no identifier, no account, no
training data. A `2xx` means accepted; anything else, or no network,
keeps the message queued on the phone and it is retried on the next
foreground and the next send, oldest first.

## The simplest endpoint

Any form-to-email service that accepts JSON works with this shape as it
is. With Formspree: create a form pointed at the dedicated address you
chose, copy its endpoint (`https://formspree.io/f/<id>`), set it as
`EXPO_PUBLIC_FEEDBACK_URL`, rebuild. `_subject` becomes the email
subject. A Cloudflare Worker forwarding to Resend is the no-vendor
alternative; same body.

## Verify

Dev build: Settings → Send feedback → type → Send shows the sent state;
the dev adapter keeps the message in memory. Release build with the URL
set: send once from TestFlight and check the inbox; then send once in
airplane mode, reconnect, reopen the app, and check the queued message
arrived.
