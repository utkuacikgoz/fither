import { render } from "@testing-library/react-native";
import { useLinkingURL } from "expo-linking";

import { clearRecordedEvents, recordedEvents } from "../dev-analytics";
import { deepLinkPath, useDeepLinkTracking } from "../deep-link";

const mockedUrl = jest.mocked(useLinkingURL);

function Probe() {
  useDeepLinkTracking();
  return null;
}

beforeEach(() => {
  clearRecordedEvents();
  mockedUrl.mockReturnValue(null);
});

describe("deepLinkPath", () => {
  it.each([
    ["fither://unlock?token=abc#x", "/unlock"],
    ["fither://", "/"],
    ["fither:///", "/"],
    ["https://fither.app/today?utm=x", "/today"],
    ["https://fither.app", "/"],
    ["fither://today/", "/today"],
  ])("%s → %s", (url, path) => {
    expect(deepLinkPath(url)).toBe(path);
  });

  it("ignores the dev client's launch URLs and garbage", () => {
    expect(deepLinkPath("fither://expo-development-client/?url=http%3A%2F%2Flocalhost")).toBeNull();
    expect(deepLinkPath("exp+fither://expo-development-client/?url=x")).toBeNull();
    expect(deepLinkPath("not a url")).toBeNull();
  });
});

describe("useDeepLinkTracking", () => {
  it("sends nothing on a plain launch", () => {
    render(<Probe />);
    expect(recordedEvents()).toEqual([]);
  });

  it("sends the path of the launch URL once, then each new URL once", () => {
    mockedUrl.mockReturnValue("fither://unlock?token=secret");
    const view = render(<Probe />);
    view.rerender(<Probe />);
    expect(recordedEvents()).toEqual([
      { name: "deep_link_open", properties: { path: "/unlock" } },
    ]);

    mockedUrl.mockReturnValue("https://fither.app/today");
    view.rerender(<Probe />);
    expect(recordedEvents()).toHaveLength(2);
    expect(recordedEvents()[1]).toEqual({
      name: "deep_link_open",
      properties: { path: "/today" },
    });
  });

  it("never sends a query string", () => {
    mockedUrl.mockReturnValue("fither://today?email=her@example.com");
    render(<Probe />);
    expect(JSON.stringify(recordedEvents())).not.toContain("example.com");
  });
});
