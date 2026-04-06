import type { Payment } from "@/api/payments";
import {
  getEntryTypeLabel,
  groupPaymentsByCreditThread,
  isOpenCreditRoot,
} from "./paymentDisplay";

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 1,
    supplier: "Supplier A",
    supplier_id: 10,
    date: "2026-03-10",
    amount: 100,
    status: "PAID",
    ...overrides,
  };
}

describe("paymentDisplay helpers", () => {
  it("groups credit chains with root first and linked children", () => {
    const rows = [
      payment({
        id: 11,
        status: "CREDIT",
        entry_type: "CREDIT_OPEN",
        amount: 1000,
        remaining_amount: 1000,
      }),
      payment({
        id: 12,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 11,
        amount: 400,
        date: "2026-03-12",
      }),
      payment({
        id: 13,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 11,
        amount: 600,
        date: "2026-03-15",
        remaining_amount: 0,
      }),
    ];

    const threads = groupPaymentsByCreditThread(rows);
    expect(threads).toHaveLength(1);
    expect(threads[0].creditRootId).toBe(11);
    expect(threads[0].hasRoot).toBe(true);
    expect(threads[0].isSettled).toBe(true);
    expect(threads[0].items.map((item) => item.id)).toEqual([11, 12, 13]);
  });

  it("builds cross-date chain from child rows when root is missing", () => {
    const rows = [
      payment({
        id: 101,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 77,
        date: "2026-03-20",
        original_credit_amount: 900,
        remaining_amount: 500,
        credit_opened_date: "2026-03-10",
      }),
      payment({
        id: 102,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 77,
        date: "2026-03-21",
        original_credit_amount: 900,
        remaining_amount: 0,
        credit_opened_date: "2026-03-10",
      }),
    ];

    const threads = groupPaymentsByCreditThread(rows);
    expect(threads).toHaveLength(1);
    expect(threads[0].creditRootId).toBe(77);
    expect(threads[0].hasRoot).toBe(false);
    expect(threads[0].root).toBeNull();
    expect(threads[0].items.map((item) => item.id)).toEqual([101, 102]);
    expect(threads[0].isSettled).toBe(true);
  });

  it("marks a root-only chain as settled when root has settled signal", () => {
    const rows = [
      payment({
        id: 210,
        status: "CREDIT",
        entry_type: "CREDIT_SETTLED",
        amount: 800,
        remaining_amount: 0,
        credit_settled_date: "2026-04-05",
      }),
    ];

    const threads = groupPaymentsByCreditThread(rows);
    expect(threads).toHaveLength(1);
    expect(threads[0].creditRootId).toBe(210);
    expect(threads[0].hasRoot).toBe(true);
    expect(threads[0].isSettled).toBe(true);
  });

  it("handles missing fields and still infers entry label safely", () => {
    const row = payment({
      id: 21,
      status: "PAID",
      entry_type: null,
      credit_payment_id: null,
      original_credit_amount: null,
      remaining_amount: null,
    });

    expect(() => getEntryTypeLabel(row)).not.toThrow();
    expect(getEntryTypeLabel(row)).toBe("Paiement direct");
  });

  it("detects eligible open credit roots only", () => {
    const rootOpen = payment({
      id: 31,
      status: "CREDIT",
      entry_type: "CREDIT_OPEN",
    });
    const partial = payment({
      id: 32,
      status: "PAID",
      entry_type: "CREDIT_PARTIAL_PAYMENT",
      credit_payment_id: 31,
    });

    expect(isOpenCreditRoot(rootOpen)).toBe(true);
    expect(isOpenCreditRoot(partial)).toBe(false);
  });
});
