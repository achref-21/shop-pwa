import { render, screen, waitFor, within } from "@testing-library/react";
import PeriodSummary from "./PeriodSummary";

const mockGetPeriodSummary = vi.fn();
const mockGetSupplierBreakdown = vi.fn();

vi.mock("@/hooks/useOnline", () => ({
  useOnline: () => true,
}));

vi.mock("@/api/summary", async () => {
  const actual = await vi.importActual<object>("@/api/summary");
  return {
    ...actual,
    getPeriodSummary: (...args: unknown[]) => mockGetPeriodSummary(...args),
    getSupplierBreakdown: (...args: unknown[]) => mockGetSupplierBreakdown(...args),
  };
});

vi.mock("@/components/SupplierTransactionsModal", () => ({
  default: () => null,
}));

vi.mock("@/components/CreditsLifecycleModal", () => ({
  default: () => null,
}));

describe("PeriodSummary totals semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPeriodSummary.mockResolvedValue({
      period_start: "2026-03-09",
      period_end: "2026-03-15",
      aggregation_basis: "date",
      revenue: 1200,
      paid: 400,
      credit: 600,
      credit_opened_in_period: 300,
      credit_paid_in_period_for_period_opens: 120,
      credit_outstanding_as_of_end_for_period_opens: 180,
      net_cash: 800,
    });
    mockGetSupplierBreakdown.mockResolvedValue({
      suppliers: [
        {
          supplier_id: 1,
          supplier: "Supplier A",
          total_amount: 500,
          total_paid: 450,
          total_credit: 50,
        },
        {
          supplier_id: 2,
          supplier: "Supplier B",
          total_amount: 500,
          total_paid: 550,
          total_credit: 450,
        },
      ],
      total: 1000,
      total_paid: 1000,
      total_credit: 500,
    });
  });

  it("uses period summary paid/credit values for grand total row", async () => {
    const { container } = render(<PeriodSummary />);

    await waitFor(() => {
      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });

    const totalLabel = screen.getByText("TOTAL");
    const totalRow = totalLabel.closest(".supplier-summary-item");
    expect(totalRow).not.toBeNull();

    const totalSection = totalRow ? within(totalRow) : within(container);
    expect(totalSection.getByText("400.00")).toBeInTheDocument();
    expect(totalSection.getByText("600.00")).toBeInTheDocument();
  });

  it("shows summary metadata and lifecycle trigger", async () => {
    render(<PeriodSummary />);

    expect(await screen.findByText(/Periode backend/i)).toBeInTheDocument();
    expect(screen.getByText(/Base d'aggregation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir cycle des credits" })).toBeInTheDocument();
  });
});
