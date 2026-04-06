import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Payment } from "@/api/payments";
import DashboardNext from "./DashboardNext";
import { DASHBOARD_NEXT_MODE_KEY } from "./dashboardNextUtils";

const mockGetDailySummary = vi.fn();
const mockGetPeriodSummary = vi.fn();
const mockSearchPayments = vi.fn();
const mockSettleCredit = vi.fn();
const mockPartialCreditPayment = vi.fn();
const mockGetDailyLimitSettingValue = vi.fn();
const mockSetDailyLimitSettingValue = vi.fn();

vi.mock("@/hooks/useOnline", () => ({
  useOnline: () => true,
}));

vi.mock("@/utils/localDate", async () => {
  const actual = await vi.importActual<object>("@/utils/localDate");
  return {
    ...actual,
    todayLocalDate: () => "2026-03-24",
  };
});

vi.mock("@/api/summary", () => ({
  getDailySummary: (...args: unknown[]) => mockGetDailySummary(...args),
  getPeriodSummary: (...args: unknown[]) => mockGetPeriodSummary(...args),
}));

vi.mock("@/api/settings", () => ({
  getDailyLimitByDate: vi.fn(),
  getDailyLimitSettingValue: (...args: unknown[]) =>
    mockGetDailyLimitSettingValue(...args),
  setDailyLimitSettingValue: (...args: unknown[]) =>
    mockSetDailyLimitSettingValue(...args),
}));

vi.mock("@/api/payments", () => ({
  searchPayments: (...args: unknown[]) => mockSearchPayments(...args),
  settleCredit: (...args: unknown[]) => mockSettleCredit(...args),
  partialCreditPayment: (...args: unknown[]) => mockPartialCreditPayment(...args),
}));

function creditFactory(overrides: Partial<Payment> = {}): Payment {
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

describe("DashboardNext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    mockGetDailySummary.mockResolvedValue({
      paid: 50,
    });
    mockGetPeriodSummary.mockResolvedValue({
      revenue: 500,
      net_cash: 120,
      period_start: "2026-03-23",
      period_end: "2026-03-29",
      aggregation_basis: "date",
    });
    mockSearchPayments.mockResolvedValue([
      creditFactory({
        id: 11,
        supplier: "Alpha",
        expected_payment_date: "2026-03-24",
        remaining_amount: 60,
        original_credit_amount: 100,
      }),
      creditFactory({
        id: 12,
        supplier: "Bravo",
        expected_payment_date: "2026-03-25",
      }),
      creditFactory({
        id: 13,
        supplier: "Charlie",
        expected_payment_date: "2026-03-20",
        amount: 70,
      }),
    ]);
    mockSettleCredit.mockResolvedValue({});
    mockPartialCreditPayment.mockResolvedValue({
      message: "ok",
      credit_payment_id: 11,
      remaining_amount: 0,
      is_fully_settled: true,
      settled_on: "2026-03-24",
    });
    mockGetDailyLimitSettingValue.mockResolvedValue(100);
    mockSetDailyLimitSettingValue.mockImplementation(
      async (value: number | null) => value
    );
  });

  it("renders scheduled breakdown rows for today and tomorrow", async () => {
    render(<DashboardNext />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("A payer: 60.00")).toBeInTheDocument();
    expect(screen.getByText("Original: 100.00")).toBeInTheDocument();
  });

  it("opens payment modal when clicking a bloc 1 payment row", async () => {
    const user = userEvent.setup();
    render(<DashboardNext />);

    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: /Alpha/i }));

    expect(await screen.findByText("Paiement credit #11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regler tout le credit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paiement partiel" })).toBeInTheDocument();
  });

  it("opens payment modal when clicking an overdue row in bloc 2", async () => {
    const user = userEvent.setup();
    render(<DashboardNext />);

    await screen.findByText("Detail des credits en retard");
    await user.click(screen.getByRole("button", { name: /Charlie/i }));

    expect(await screen.findByText("Paiement credit #13")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regler tout le credit" })).toBeInTheDocument();
  });

  it("opens settle-date modal and sends date payload when settling", async () => {
    const user = userEvent.setup();
    render(<DashboardNext />);

    await screen.findByText("Alpha");
    await user.click(screen.getByRole("button", { name: /Alpha/i }));
    await user.click(screen.getByRole("button", { name: "Regler tout le credit" }));
    await user.click(await screen.findByRole("button", { name: "Valider le reglement" }));

    await waitFor(() =>
      expect(mockSettleCredit).toHaveBeenCalledWith(11, { settle_date: "2026-03-24" })
    );
  });

  it("saves and clears the daily limit from modal", async () => {
    const user = userEvent.setup();
    render(<DashboardNext />);

    await screen.findByText("Depense du jour vs limite");

    await user.click(screen.getByRole("button", { name: "Parametres limite quotidienne" }));
    const input = screen.getByRole("spinbutton", { name: "Limite de depense" });
    expect(input).toHaveValue(100);
    await user.clear(input);
    await user.type(input, "200");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(mockSetDailyLimitSettingValue).toHaveBeenCalledWith(200)
    );
    expect(await screen.findByText(/Pourcentage:/)).toHaveTextContent("25.00%");

    await user.click(screen.getByRole("button", { name: "Parametres limite quotidienne" }));
    await user.click(screen.getByRole("button", { name: "Supprimer limite" }));

    await waitFor(() =>
      expect(mockSetDailyLimitSettingValue).toHaveBeenLastCalledWith(null)
    );
    expect(await screen.findByText("Limite non definie.")).toBeInTheDocument();
  });

  it("switches bloc 2 mode and refetches period summary with month range", async () => {
    const user = userEvent.setup();
    render(<DashboardNext />);

    await waitFor(() =>
      expect(mockGetPeriodSummary).toHaveBeenCalledWith("2026-03-23", "2026-03-29", "WEEK")
    );

    await user.click(screen.getByRole("button", { name: "Parametres mode bloc 2" }));
    await user.selectOptions(screen.getByLabelText("Mode periode"), "MONTH");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() =>
      expect(mockGetPeriodSummary).toHaveBeenLastCalledWith("2026-03-01", "2026-03-31", "MONTH")
    );
    expect(localStorage.getItem(DASHBOARD_NEXT_MODE_KEY)).toBe("MONTH");
  });

  it("shows unavailable states when backend data is missing", async () => {
    mockGetDailySummary.mockRejectedValueOnce(new Error("daily down"));
    mockGetPeriodSummary.mockRejectedValueOnce(new Error("period down"));
    mockSearchPayments.mockRejectedValueOnce(new Error("credits down"));

    render(<DashboardNext />);

    expect(await screen.findAllByText("Indisponible (backend non pret).")).not.toHaveLength(0);
    expect(screen.getByText("Somme credits restants")).toBeInTheDocument();
    expect(screen.getByText("Somme paiements en retard")).toBeInTheDocument();
  });
});
