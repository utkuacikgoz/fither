import type { BodyArea } from "@fither/engine";

/**
 * Presentation order for body-area pickers. The onboarding avoid-list
 * deliberately reuses the daily prompt's labels and order (draft-strings
 * §1) so the daily prompt feels familiar on day two.
 */
export const BODY_AREAS: readonly BodyArea[] = [
  "shoulders",
  "wrists",
  "elbows",
  "back",
  "hips",
  "knees",
  "ankles",
  "core",
];
