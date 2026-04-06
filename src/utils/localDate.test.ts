import {
  formatLocalDate,
  monthIdentifier,
  monthRangeCalendar,
  parseLocalDate,
  weekIdentifier,
  weekRangeMondaySunday,
} from "./localDate";

describe("localDate", () => {
  it("keeps date round-trip stable without UTC drift", () => {
    const parsed = parseLocalDate("2026-03-01");
    expect(formatLocalDate(parsed)).toBe("2026-03-01");
  });

  it("returns Monday-Sunday range for a mid-week day", () => {
    const range = weekRangeMondaySunday("2026-03-11");
    expect(range).toEqual({
      start: "2026-03-09",
      end: "2026-03-15",
    });
  });

  it("returns full calendar month boundaries", () => {
    expect(monthRangeCalendar("2026-02-12")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });

    expect(monthRangeCalendar("2024-02-12")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });

  it("produces stable week and month identifiers", () => {
    expect(weekIdentifier("2026-03-09")).toBe(weekIdentifier("2026-03-15"));
    expect(weekIdentifier("2026-03-09")).not.toBe(weekIdentifier("2026-03-16"));

    expect(monthIdentifier("2026-03-01")).toBe("2026_M03");
    expect(monthIdentifier("2026-12-31")).toBe("2026_M12");
  });
});
