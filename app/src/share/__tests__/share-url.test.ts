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
    process.env[ENV] = " https://fither.pro/ ";
    expect(shareBaseUrl()).toBe("https://fither.pro");
    process.env[ENV] = "https://staging.fither.pro:8443";
    expect(shareBaseUrl()).toBe("https://staging.fither.pro:8443");
  });

  it("treats anything that is not an https origin as unset", () => {
    for (const value of [
      "",
      "   ",
      "fither.pro",
      "http://fither.pro",
      "https://",
      "https://fither.pro/s/session",
      "javascript:alert(1)",
      "https://fither.pro?x=1",
    ]) {
      process.env[ENV] = value;
      expect(shareBaseUrl()).toBeNull();
      expect(shareUrl("session")).toBeNull();
      expect(shareUrlHost()).toBeNull();
    }
  });

  it("builds the recipient path per kind, matching the web page's allowlist", () => {
    process.env[ENV] = "https://fither.pro";
    expect(shareUrl("session")).toBe("https://fither.pro/s/session");
    expect(shareUrl("week")).toBe("https://fither.pro/s/week");
    expect(shareUrl("away_from_home")).toBe("https://fither.pro/s/away_from_home");
    expect(shareUrl("between_meetings")).toBe("https://fither.pro/s/between_meetings");
  });

  it("prints the host alone for the card", () => {
    process.env[ENV] = "https://fither.pro";
    expect(shareUrlHost()).toBe("fither.pro");
  });
});
