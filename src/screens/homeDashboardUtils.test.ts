import { describe, expect, it } from "vitest";
import {
  formatCompactAmount,
  getObjectiveStatusClassName,
  orderCreditStatusBreakdown,
  resolveHomeDashboardSearchState,
  toHomeDashboardSearchParams,
} from "./homeDashboardUtils";

describe("home dashboard utils", () => {
  it("resolves missing query params to defaults", () => {
    const state = resolveHomeDashboardSearchState(new URLSearchParams(""), "2026-03-21");
    expect(state).toEqual({
      as_of: "2026-03-21",
      mode: "WEEK",
      anchor_date: "2026-03-21",
    });
  });

  it("normalizes invalid values and returns canonical search params", () => {
    const state = resolveHomeDashboardSearchState(
      new URLSearchParams("as_of=2026-13-40&mode=INVALID&anchor_date=2026-03-20"),
      "2026-03-21"
    );
    expect(state).toEqual({
      as_of: "2026-03-21",
      mode: "WEEK",
      anchor_date: "2026-03-20",
    });

    expect(toHomeDashboardSearchParams(state).toString()).toBe(
      "as_of=2026-03-21&mode=WEEK&anchor_date=2026-03-20"
    );
  });

  it("maps objective statuses to CSS classes", () => {
    expect(getObjectiveStatusClassName("ON_TRACK")).toBe("on-track");
    expect(getObjectiveStatusClassName("AT_RISK")).toBe("at-risk");
    expect(getObjectiveStatusClassName("OFF_TRACK")).toBe("off-track");
  });

  it("always orders credit status as OPEN -> DUE_SOON -> OVERDUE -> SETTLED", () => {
    const ordered = orderCreditStatusBreakdown([
      { status: "SETTLED", amount: 2, count: 2 },
      { status: "OVERDUE", amount: 3, count: 3 },
      { status: "OPEN", amount: 4, count: 4 },
    ]);

    expect(ordered.map((row) => row.status)).toEqual([
      "OPEN",
      "DUE_SOON",
      "OVERDUE",
      "SETTLED",
    ]);
    expect(ordered[1]).toMatchObject({ status: "DUE_SOON", amount: 0, count: 0 });
  });

  it("formats compact amounts with K and M suffixes", () => {
    expect(formatCompactAmount(900)).toBe("900.00");
    expect(formatCompactAmount(1200)).toBe("1.20K");
    expect(formatCompactAmount(2_500_000)).toBe("2.50M");
    expect(formatCompactAmount(-1500)).toBe("-1.50K");
  });
});
