// Recipient page copy. Every string here is user-facing and passes
// the fither-voice rules: second person, no dashes, nothing
// from the forbidden list, ten minutes is complete.
//
// Sources: docs/growth/treatments.md (between_meetings, away_from_home,
// quiet_house), docs/growth/pilot-brief.md (friends_week, including the
// consent line under the button), docs/design/mockups/recipient-page.html
// (session). `week` has no written brief yet; its copy below follows the
// same shape and is the copy-writer's to revise.
//
// Owner cut (2026-09-07, mockup review): the sentence "Yours would be
// built for yours" is gone and must not come back. One thought per line.
//
// Figures are movement ids from data/movements.json, pre-tinted by
// web/scripts/build-assets.py into web/assets/figures. Keep FIGURES in
// sync with that script.

export const FIGURES = Object.freeze([
  "sit-to-stand",
  "wall-push-up",
  "glute-bridge",
  "air-squat",
  "kneeling-push-up",
  "split-squat",
  "standing-hip-hinge",
]);

export const FACTS = Object.freeze([
  "10, 20 or 30 minutes. Your call, every day.",
  "Four taps, then you move.",
  "Works offline, anywhere.",
]);

export const FINE_PRINT = "Free to download. First session included. No account needed.";

// Shown instead of the button and the fine print while the owner has not
// set APP_STORE_URL (web/src/app.js). Never a placeholder destination.
export const COMING = "Coming to the App Store.";

// The listing this page sends her to. One constant, read by the build
// (scripts/build-page.mjs, so it is in the served HTML) and by the
// browser entry (app.js). They must agree, or a crawler reads a page
// the recipient never sees. The App Store id exists as soon as the app
// record does, well before the listing goes live. Only an
// https://apps.apple.com/ URL is accepted; anything else counts as
// unset and the page falls back to COMING.
export const APP_STORE_URL = "https://apps.apple.com/app/id6808850285";

export const GENERIC = Object.freeze({
  caption: "",
  headline: "A workout that fits today.",
  line: "Ten minutes, no equipment, built for the day you're having.",
  button: "Try your first session",
  figure: "air-squat",
});

// The allowlist. Keys are the only scenario ids the page will ever read
// back; ADR-0024 §3 names the same ids for `scenario_entry` on the phone.
export const SCENARIOS = Object.freeze({
  friends_week: Object.freeze({
    caption: "An invitation",
    headline: "Three sessions this week, with a friend.",
    line: "Each on your own schedule. 10, 20 or 30 minutes, built for the day you're having.",
    button: "Try your first session",
    // docs/growth/pilot-brief.md, "Participant consent": informed before
    // she taps anything, and it names what neither side sees.
    consent:
      "A friend sent you this. She won't see what you do here, and you won't see her sessions. Your week is yours.",
    figure: "split-squat",
  }),
  between_meetings: Object.freeze({
    caption: "Between meetings",
    headline: "Ten minutes between meetings.",
    line: "A chair and the floor. Ten minutes, complete.",
    button: "Try 10 minutes",
    figure: "sit-to-stand",
  }),
  away_from_home: Object.freeze({
    caption: "Hotel room",
    headline: "Just you and the floor.",
    line: "Any room is enough. 10, 20 or 30 minutes, no equipment, built for today.",
    button: "Try 20 minutes",
    figure: "wall-push-up",
  }),
  quiet_house: Object.freeze({
    caption: "A quiet house",
    headline: "Every movement stays quiet.",
    line: "Someone's asleep. Answer one question and the session is built for that.",
    button: "Try a quiet session",
    figure: "glute-bridge",
  }),
  session: Object.freeze({
    caption: "A friend's session",
    headline: "Ten minutes. No equipment. Done.",
    line: "A friend just finished a session built for the room she was in.",
    button: "Try 10 minutes",
    figure: "kneeling-push-up",
  }),
  week: Object.freeze({
    caption: "A friend's week",
    headline: "Sessions that fit the week.",
    line: "A friend just finished her week. Each session was built for the day she was having.",
    button: "Try your first session",
    figure: "standing-hip-hinge",
  }),
});
