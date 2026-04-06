import type { Payment } from "@/api/payments";
import {
  computeCreditCollections,
  computeDailyLimitUsage,
  getTomorrowDate,
  parseStoredDailyLimit,
  parseStoredMode,
} from "./dashboardNextUtils";

function paymentFactory(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    supplier: "Supplier A",
    supplier_id: 10,
    date: "2026-03-24",
    amount: 100,
    status: "CREDIT",
    ...overrides,
  };
}

describe("dashboardNextUtils", () => {
  it("builds scheduled and overdue collections from open credits", () => {
    const payments: Payment[] = [
      paymentFactory({
        id: 1,
        supplier: "Beta",
        amount: 100,
        expected_payment_date: "2026-03-24",
        remaining_amount: 60,
        original_credit_amount: 100,
      }),
      paymentFactory({
        id: 2,
        supplier: "Alpha",
        amount: 80,
        expected_payment_date: "2026-03-25",
      }),
      paymentFactory({
        id: 3,
        supplier: "Zeta",
        amount: 50,
        expected_payment_date: "2026-03-20",
      }),
      paymentFactory({
        id: 4,
        supplier: "Ignored paid",
        status: "PAID",
        expected_payment_date: "2026-03-24",
      }),
    ];

    const result = computeCreditCollections(payments, "2026-03-24", "2026-03-25");

    expect(result.todayScheduled).toHaveLength(1);
    expect(result.todayScheduled[0]).toMatchObject({
      paymentId: 1,
      supplier: "Beta",
      remainingAmount: 60,
      originalAmount: 100,
      isPartial: true,
    });

    expect(result.tomorrowScheduled).toHaveLength(1);
    expect(result.tomorrowScheduled[0]).toMatchObject({
      paymentId: 2,
      supplier: "Alpha",
    });

    expect(result.overdueLines).toHaveLength(1);
    expect(result.overdueLines[0]).toMatchObject({
      paymentId: 3,
      supplier: "Zeta",
    });

    expect(result.totalRemaining).toBe(190);
    expect(result.totalOverdue).toBe(50);
  });

  it("computes daily usage states", () => {
    expect(computeDailyLimitUsage(null, 100)).toEqual({ kind: "unavailable" });

    expect(computeDailyLimitUsage(40, null)).toEqual({
      kind: "limit_unset",
      spent: 40,
    });

    expect(computeDailyLimitUsage(120, 100)).toMatchObject({
      kind: "ready",
      spent: 120,
      limit: 100,
      percentage: 120,
      isOverLimit: true,
    });
  });

  it("parses settings values and tomorrow date", () => {
    expect(parseStoredDailyLimit("125.5")).toBe(125.5);
    expect(parseStoredDailyLimit("0")).toBeNull();
    expect(parseStoredDailyLimit(null)).toBeNull();

    expect(parseStoredMode("MONTH")).toBe("MONTH");
    expect(parseStoredMode("WEEK")).toBe("WEEK");
    expect(parseStoredMode("something-else")).toBe("WEEK");

    expect(getTomorrowDate("2026-03-24")).toBe("2026-03-25");
  });
});
