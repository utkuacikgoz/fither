// The public destination a share may point at (wave 3, web/README.md).
// Build configuration, never a remote value:
//
//   EXPO_PUBLIC_SHARE_BASE_URL = "https://fither.pro"
//
// Unset means there is NO URL: the share text carries the card line
// alone and the card shows no host. A placeholder destination would be
// a lie the recipient pays for, so anything that is not an https origin
// is treated as unset. Read at call time so a build variable and a test
// can both set it.

/** The recipient pages app-generated shares may use from the web allowlist. */
export type ShareLinkKind =
  | "session"
  | "week"
  | "away_from_home"
  | "between_meetings";

const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i;

/** The configured origin without a trailing slash, or null when unset or not https. */
export function shareBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_SHARE_BASE_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return HTTPS_ORIGIN.test(trimmed) ? trimmed : null;
}

/** The recipient URL for a kind of share, or null when no destination is configured. */
export function shareUrl(kind: ShareLinkKind): string | null {
  const base = shareBaseUrl();
  return base === null ? null : `${base}/s/${kind}`;
}

/** The host the card prints ("fither.pro"), or null when no destination is configured. */
export function shareUrlHost(): string | null {
  const base = shareBaseUrl();
  return base === null ? null : base.replace(/^https:\/\//i, "");
}
