const mockGetDailyLimitByDate = vi.fn();

vi.mock("@/api/settings", () => ({
  getDailyLimitByDate: (...args: unknown[]) => mockGetDailyLimitByDate(...args),
}));

import {
  __dailyLimitTestUtils,
  computeDailyLimitDecision,
  evaluateDailyLimitForAmount,
} from "./dailyLimit";

describe("dailyLimit service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __dailyLimitTestUtils.clearSnapshots();
  });

  it("queries the endpoint with the payment reference date", async () => {
    mockGetDailyLimitByDate.mockResolvedValue({
      today_payments_total: 900,
      daily_limit: 1000,
    });

    await evaluateDailyLimitForAmount(100, "2026-03-24");
    expect(mockGetDailyLimitByDate).toHaveBeenCalledWith("2026-03-24");
  });

  it("returns OK when projected spent reaches limit exactly", async () => {
    mockGetDailyLimitByDate.mockResolvedValue({
      today_payments_total: 900,
      daily_limit: 1000,
    });

    const result = await evaluateDailyLimitForAmount(100, "2026-03-24");
    expect(result.decision).toBe("OK");
    expect(result.projectedSpent).toBe(1000);
    expect(result.source).toBe("api");
    expect(result.date).toBe("2026-03-24");
  });

  it("returns CROSSING_LIMIT_CONFIRM_REQUIRED when crossing from below", async () => {
    mockGetDailyLimitByDate.mockResolvedValue({
      today_payments_total: 950,
      daily_limit: 1000,
    });

    const result = await evaluateDailyLimitForAmount(100, "2026-03-24");
    expect(result.decision).toBe("CROSSING_LIMIT_CONFIRM_REQUIRED");
  });

  it("returns ALREADY_OVER_LIMIT when already over before payment", async () => {
    mockGetDailyLimitByDate.mockResolvedValue({
      today_payments_total: 1200,
      daily_limit: 1000,
    });

    const result = await evaluateDailyLimitForAmount(100, "2026-03-24");
    expect(result.decision).toBe("ALREADY_OVER_LIMIT");
  });

  it("handles no payments for the reference day", async () => {
    mockGetDailyLimitByDate.mockResolvedValue({
      today_payments_total: 0,
      daily_limit: 1000,
    });

    const result = await evaluateDailyLimitForAmount(250, "2026-03-24");
    expect(result.decision).toBe("OK");
    expect(result.todaySpent).toBe(0);
  });

  it("retries once then falls back to same-date snapshot", async () => {
    mockGetDailyLimitByDate.mockResolvedValueOnce({
      today_payments_total: 700,
      daily_limit: 1000,
    });
    await evaluateDailyLimitForAmount(100, "2026-03-24");

    mockGetDailyLimitByDate.mockRejectedValue(new Error("down"));
    const result = await evaluateDailyLimitForAmount(250, "2026-03-24");

    expect(result.source).toBe("snapshot_fallback");
    expect(result.decision).toBe("OK");
    expect(mockGetDailyLimitByDate).toHaveBeenCalledTimes(3);
  });

  it("proceeds without warnings when no same-date snapshot exists", async () => {
    mockGetDailyLimitByDate.mockRejectedValue(new Error("down"));

    const result = await evaluateDailyLimitForAmount(500, "2026-03-24");
    expect(result.decision).toBe("OK");
    expect(result.bypassed).toBe(true);
    expect(result.source).toBe("bypass_no_snapshot");
    expect(mockGetDailyLimitByDate).toHaveBeenCalledTimes(2);
  });

  it("does not reuse snapshot from another reference date", async () => {
    mockGetDailyLimitByDate.mockResolvedValueOnce({
      today_payments_total: 500,
      daily_limit: 1000,
    });
    await evaluateDailyLimitForAmount(100, "2026-03-24");

    mockGetDailyLimitByDate.mockRejectedValue(new Error("down"));
    const result = await evaluateDailyLimitForAmount(100, "2026-03-25");

    expect(result.source).toBe("bypass_no_snapshot");
    expect(result.bypassed).toBe(true);
  });

  it("keeps decision helper aligned with business rules", () => {
    expect(computeDailyLimitDecision(800, 1000, 950)).toBe("OK");
    expect(computeDailyLimitDecision(1000, 1000, 1001)).toBe(
      "CROSSING_LIMIT_CONFIRM_REQUIRED"
    );
    expect(computeDailyLimitDecision(1001, 1000, 1100)).toBe("ALREADY_OVER_LIMIT");
  });
});

