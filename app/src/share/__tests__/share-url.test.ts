import { shareBaseUrl, shareUrl, shareUrlHost } from "../share-url";

const ENV = "EXPO_PUBLIC_SHARE_BASE_URL";

beforeEach(() => {
  delete process.env[ENV];
});

afterAll(() => {
  delete process.env[ENV];
});

describe("shareBaseUrl", () => {
  it("is null when the build names no destination: never a fake link", () => {
    expect(shareBaseUrl()).toBeNull();
    expect(shareUrl("session")).toBeNull();
    expect(shareUrl("week")).toBeNull();
    expect(shareUrlHost()).toBeNull();
  });

  it("reads the configured https origin, trimmed, without a trailing slash", () => {
    process.env[ENV] = " https://fither.app/ ";
    expect(shareBaseUrl()).toBe("https://fither.app");
    process.env[ENV] = "https://staging.fither.app:8443";
    expect(shareBaseUrl()).toBe("https://staging.fither.app:8443");
  });

  it("treats anything that is not an https origin as unset", () => {
    for (const value of [
      "",
      "   ",
      "fither.app",
      "http://fither.app",
      "https://",
      "https://fither.app/s/session",
      "javascript:alert(1)",
      "https://fither.app?x=1",
    ]) {
      process.env[ENV] = value;
      expect(shareBaseUrl()).toBeNull();
      expect(shareUrl("session")).toBeNull();
      expect(shareUrlHost()).toBeNull();
    }
  });

  it("builds the recipient path per kind, matching the web page's allowlist", () => {
    process.env[ENV] = "https://fither.app";
    expect(shareUrl("session")).toBe("https://fither.app/s/session");
    expect(shareUrl("week")).toBe("https://fither.app/s/week");
    expect(shareUrl("away_from_home")).toBe("https://fither.app/s/away_from_home");
    expect(shareUrl("between_meetings")).toBe("https://fither.app/s/between_meetings");
  });

  it("prints the host alone for the card", () => {
    process.env[ENV] = "https://fither.app";
    expect(shareUrlHost()).toBe("fither.app");
  });
});
