const mockApiFetch = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("./client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/services/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

import { __summaryTestUtils, getCreditsLifecycle, getDailySummary } from "./summary";

describe("summary api normalization and cache semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes missing summary fields to safe defaults", () => {
    const normalized = __summaryTestUtils.normalizeDailySummaryResponse(
      {
        revenue: "42",
        payments: null,
      },
      "2026-03-11"
    );

    expect(normalized.date).toBe("2026-03-11");
    expect(normalized.aggregation_basis).toBe("date");
    expect(normalized.revenue).toBe(42);
    expect(normalized.paid).toBe(0);
    expect(normalized.payments).toEqual([]);
    expect(normalized.credit_lifecycle).toEqual([]);
  });

  it("uses as-of date in lifecycle cache keys for fetch success", async () => {
    mockApiFetch.mockResolvedValue({
      period_start: "2026-03-09",
      period_end: "2026-03-15",
      aggregation_basis: "date",
      credits: [],
    });

    await getCreditsLifecycle("2026-03-09", "2026-03-15", "2026-03-11", "WEEK");

    expect(mockCacheSet).toHaveBeenCalledTimes(1);
    expect(String(mockCacheSet.mock.calls[0][0])).toContain("asof_2026-03-11");
  });

  it("uses as-of date in lifecycle cache fallback", async () => {
    mockApiFetch.mockRejectedValue(new Error("offline"));
    mockCacheGet.mockReturnValue({
      period_start: "2026-03-09",
      period_end: "2026-03-15",
      aggregation_basis: "date",
      credits: [],
    });

    const response = await getCreditsLifecycle("2026-03-09", "2026-03-15", "2026-03-11", "WEEK");

    expect(response.period_start).toBe("2026-03-09");
    expect(mockCacheGet).toHaveBeenCalledTimes(1);
    expect(String(mockCacheGet.mock.calls[0][0])).toContain("asof_2026-03-11");
  });

  it("uses as-of date in daily summary cache key", async () => {
    mockApiFetch.mockRejectedValue(new Error("offline"));
    mockCacheGet.mockReturnValue({
      date: "2026-03-11",
      aggregation_basis: "date",
      revenue: 0,
      paid: 0,
      credit: 0,
      cash_remaining: 0,
      payments: [],
      credit_lifecycle: [],
    });

    await getDailySummary("2026-03-11", "2026-03-11");

    expect(String(mockCacheGet.mock.calls[0][0])).toContain("daily_summary_2026-03-11_asof_2026-03-11");
  });
});
