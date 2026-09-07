import { weekOf } from "@fither/engine";

import { formatWeekRange } from "../format-week";

// The recap's caption: day numbers off the ISO strings, month names from
// the platform locale, one form inside a month and one across two.

describe("formatWeekRange", () => {
  it("names the month once when the week stays inside it", () => {
    expect(formatWeekRange("2026-09-01", "2026-09-07")).toBe("1 to 7 September");
  });

  it("names both months when the week crosses one", () => {
    expect(formatWeekRange("2026-09-28", "2026-10-04")).toBe("28 September to 4 October");
  });

  it("crosses a year boundary the same way", () => {
    expect(formatWeekRange("2026-12-28", "2027-01-03")).toBe("28 December to 3 January");
  });

  it("never pads day numbers", () => {
    expect(formatWeekRange("2026-09-07", "2026-09-13")).toBe("7 to 13 September");
  });

  it("formats the engine's own week for any anchor date in it", () => {
    const week = weekOf("2026-09-07"); // a Monday
    expect(formatWeekRange(week.start, week.end)).toBe("7 to 13 September");
    const midweek = weekOf("2026-09-10");
    expect(formatWeekRange(midweek.start, midweek.end)).toBe("7 to 13 September");
  });
});
