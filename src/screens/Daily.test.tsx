import { render, screen, waitFor } from "@testing-library/react";
import DailySummary from "./Daily";

const mockGetDailySummary = vi.fn();

vi.mock("@/hooks/useOnline", () => ({
  useOnline: () => true,
}));

vi.mock("@/api/summary", async () => {
  const actual = await vi.importActual<object>("@/api/summary");
  return {
    ...actual,
    getDailySummary: (...args: unknown[]) => mockGetDailySummary(...args),
  };
});

describe("Daily summary date-first semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDailySummary.mockResolvedValue({
      date: "2026-03-11",
      aggregation_basis: "date",
      revenue: 500,
      paid: 250,
      credit: 250,
      cash_remaining: 250,
      payments: [
        {
          id: 7,
          supplier_id: 9,
          supplier: "Supplier A",
          amount: 250,
          status: "CREDIT",
          date: "2026-03-11",
          expected_payment_date: "2026-03-01",
          entry_type: "CREDIT_OPEN",
        },
      ],
      credit_lifecycle: [
        {
          credit_payment_id: 7,
          supplier_id: 9,
          supplier: "Supplier A",
          opened_on: "2026-03-11",
          expected_payment_date: "2026-03-20",
          original_credit_amount: 250,
          paid_before_today: 0,
          paid_today: 0,
          remaining_after_today: 250,
          status: "DUE_SOON",
          due_in_days: 9,
          credit_settled_date: null,
        },
      ],
    });
  });

  it("shows metadata and lifecycle section from backend response", async () => {
    render(<DailySummary />);

    expect(await screen.findByText(/Date backend/i)).toBeInTheDocument();
    expect(screen.getByText(/Base d'aggregation/i)).toBeInTheDocument();
    expect(
      screen.getByText("Cycle de vie des credits (statuts calcules a aujourd'hui)")
    ).toBeInTheDocument();
    expect(screen.getByText("Echeance proche")).toBeInTheDocument();
  });

  it("does not flag transaction rows as overdue from expected payment date", async () => {
    const { container } = render(<DailySummary />);

    await waitFor(() => {
      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    expect(container.querySelector(".payment-item.overdue")).toBeNull();
  });
});
