import { render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
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
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

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
        {
          id: 8,
          supplier_id: 5,
          supplier: "Supplier Cancelled",
          amount: 80,
          status: "CANCELLED",
          date: "2026-03-11",
          entry_type: "DIRECT_PAID",
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

  function renderWithMantine() {
    return render(
      <MantineProvider>
        <DailySummary />
      </MantineProvider>
    );
  }

  it("shows date selector, KPI cards, and threaded transactions", async () => {
    renderWithMantine();

    expect(await screen.findByLabelText("Date du journalier")).toBeInTheDocument();
    expect(await screen.findByText(/Cha.*cr.*dit #7/i)).toBeInTheDocument();
    expect(screen.getByText("RECETTES")).toBeInTheDocument();
    expect(screen.getByText(/PAY/i)).toBeInTheDocument();
    expect(screen.getByText(/CR.*DIT OUVERT/i)).toBeInTheDocument();
    expect(screen.getByText(/CASH RESTANT/i)).toBeInTheDocument();
    expect(screen.getByText(/1 .*ntr.*\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText("0 transaction(s)")).toBeInTheDocument();
    expect(screen.getAllByText("250.00").length).toBeGreaterThan(1);
  });

  it("filters cancelled payments before rendering transaction rows", async () => {
    renderWithMantine();

    await waitFor(() => {
      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });

    expect(screen.queryByText("Supplier Cancelled")).not.toBeInTheDocument();
  });
});
