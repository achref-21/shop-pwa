import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Payment } from "@/api/payments";
import PaymentsSearch from "./PaymentsSearch";

const mockSearchPayments = vi.fn();
const mockSettleCredit = vi.fn();
const mockPartialCreditPayment = vi.fn();
const mockGetSuppliers = vi.fn();
const mockEvaluateDailyLimitForAmount = vi.fn();

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

vi.mock("@/api/suppliers", () => ({
  getSuppliers: (...args: unknown[]) => mockGetSuppliers(...args),
}));

vi.mock("@/api/payments", () => ({
  searchPayments: (...args: unknown[]) => mockSearchPayments(...args),
  settleCredit: (...args: unknown[]) => mockSettleCredit(...args),
  partialCreditPayment: (...args: unknown[]) => mockPartialCreditPayment(...args),
  isDateRangeWithinCache: () => true,
}));

vi.mock("@/services/dailyLimit", async () => {
  const actual = await vi.importActual<object>("@/services/dailyLimit");
  return {
    ...actual,
    evaluateDailyLimitForAmount: (...args: unknown[]) =>
      mockEvaluateDailyLimitForAmount(...args),
  };
});

function createRow(overrides: Partial<Payment>): Payment {
  return {
    id: 1,
    supplier: "Supplier A",
    supplier_id: 2,
    date: "2026-03-10",
    amount: 1000,
    status: "CREDIT",
    entry_type: "CREDIT_OPEN",
    credit_payment_id: null,
    remaining_amount: 1000,
    original_credit_amount: 1000,
    credit_expected_payment_date: "2026-03-16",
    ...overrides,
  };
}

describe("PaymentsSearch credit chains", () => {
  beforeEach(() => {
    mockSearchPayments.mockReset();
    mockSettleCredit.mockReset();
    mockPartialCreditPayment.mockReset();
    mockGetSuppliers.mockReset();
    mockEvaluateDailyLimitForAmount.mockReset();

    mockEvaluateDailyLimitForAmount.mockResolvedValue({
      decision: "OK",
      date: "2026-03-24",
      amount: 0,
      todaySpent: 100,
      dailyLimit: 1000,
      projectedSpent: 100,
      source: "api",
      bypassed: false,
    });
    mockGetSuppliers.mockResolvedValue([
      { id: 2, name: "Supplier A" },
      { id: 3, name: "Supplier B" },
    ]);

    mockSearchPayments.mockResolvedValue([
      createRow({ id: 1 }),
      createRow({
        id: 2,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 1,
        amount: 400,
        date: "2026-03-12",
        remaining_amount: 600,
      }),
      createRow({
        id: 3,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 1,
        amount: 200,
        date: "2026-03-15",
        remaining_amount: 400,
      }),
    ]);
  });

  it("renders grouped chain rows with entry-type labels", async () => {
    render(<PaymentsSearch />);

    expect(await screen.findByText("Chaine credit #1")).toBeInTheDocument();
    const resultsRegion = screen.getByText("Resultats (3)").closest(".results-card");
    expect(resultsRegion).not.toBeNull();
    expect(within(resultsRegion!).getByText(/en retard/i)).toBeInTheDocument();
    expect(within(resultsRegion!).getAllByText(/paiement partiel/i)).toHaveLength(2);
  });

  it("supports partial payment modal validation and submit", async () => {
    mockPartialCreditPayment.mockResolvedValue({
      message: "Paiement partiel enregistre",
      credit_payment_id: 1,
      remaining_amount: 600,
      is_fully_settled: false,
      settled_on: null,
    });

    render(<PaymentsSearch />);

    const user = userEvent.setup();
    const payPartButton = await screen.findByRole("button", {
      name: "Payer une partie",
    });

    await user.click(payPartButton);

    const amountInput = screen.getByLabelText("Montant");
    await user.clear(amountInput);
    await user.type(amountInput, "0");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(
      await screen.findByText("Le montant doit etre superieur a 0.")
    ).toBeInTheDocument();

    await user.clear(amountInput);
    await user.type(amountInput, "400");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));

    await waitFor(() => expect(mockPartialCreditPayment).toHaveBeenCalledTimes(1));
    expect(mockPartialCreditPayment.mock.calls[0][0]).toBe(1);
    expect(mockPartialCreditPayment.mock.calls[0][1]).toMatchObject({
      amount: 400,
    });
    expect(await screen.findByText(/Paiement partiel enregistre/i)).toBeInTheDocument();
  });

  it("requires explicit second confirmation when crossing the limit", async () => {
    mockEvaluateDailyLimitForAmount.mockResolvedValueOnce({
      decision: "CROSSING_LIMIT_CONFIRM_REQUIRED",
      date: "2026-03-24",
      amount: 1000,
      todaySpent: 950,
      dailyLimit: 1000,
      projectedSpent: 1950,
      source: "api",
      bypassed: false,
    });
    mockSettleCredit.mockResolvedValue({});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PaymentsSearch />);
    const user = userEvent.setup();

    const supplierRow = (await screen.findAllByText("Supplier A", {
      selector: ".supplier-inline strong",
    }))[0].closest(".payment-item");
    expect(supplierRow).not.toBeNull();
    const rowCheckbox = supplierRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(rowCheckbox).not.toBeNull();
    await user.click(rowCheckbox!);

    await user.click(screen.getByRole("button", { name: "Regler 1 credit" }));
    await user.click(await screen.findByRole("button", { name: "Valider le reglement" }));

    expect(
      await screen.findByText("Attention: depassement de limite quotidienne")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vous allez depasser la limite quotidienne pour le 2026-03-24.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmer quand meme" }));

    await waitFor(() => expect(mockSettleCredit).toHaveBeenCalledTimes(1));
    expect(mockSettleCredit).toHaveBeenCalledWith(1, { settle_date: "2026-03-24" });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockEvaluateDailyLimitForAmount).toHaveBeenCalledWith(1000, "2026-03-24");
  });

  it("shows already-over-limit notice and proceeds without extra blocking", async () => {
    mockEvaluateDailyLimitForAmount.mockResolvedValueOnce({
      decision: "ALREADY_OVER_LIMIT",
      date: "2026-03-24",
      amount: 1000,
      todaySpent: 1200,
      dailyLimit: 1000,
      projectedSpent: 2200,
      source: "api",
      bypassed: false,
    });
    mockSettleCredit.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PaymentsSearch />);
    const user = userEvent.setup();

    const supplierRow = (await screen.findAllByText("Supplier A", {
      selector: ".supplier-inline strong",
    }))[0].closest(".payment-item");
    const rowCheckbox = supplierRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(rowCheckbox).not.toBeNull();
    await user.click(rowCheckbox!);

    await user.click(screen.getByRole("button", { name: "Regler 1 credit" }));
    await user.click(await screen.findByRole("button", { name: "Valider le reglement" }));

    await waitFor(() => expect(mockSettleCredit).toHaveBeenCalledTimes(1));
    expect(mockSettleCredit).toHaveBeenCalledWith(1, { settle_date: "2026-03-24" });
    expect(
      await screen.findByText(/Limite quotidienne deja depassee/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/pour le 2026-03-24/i)).toBeInTheDocument();
  });

  it("uses one aggregate daily-limit check for batch settlements", async () => {
    mockSearchPayments.mockResolvedValueOnce([
      createRow({ id: 1, supplier: "Supplier A", remaining_amount: 600 }),
      createRow({
        id: 4,
        supplier: "Supplier B",
        supplier_id: 3,
        amount: 700,
        remaining_amount: 700,
      }),
    ]);
    mockSettleCredit.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PaymentsSearch />);
    const user = userEvent.setup();

    const rowA = (await screen.findAllByText("Supplier A", {
      selector: ".supplier-inline strong",
    }))[0].closest(".payment-item");
    const rowB = (await screen.findAllByText("Supplier B", {
      selector: ".supplier-inline strong",
    }))[0].closest(".payment-item");
    const checkA = rowA?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const checkB = rowB?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkA).not.toBeNull();
    expect(checkB).not.toBeNull();
    await user.click(checkA!);
    await user.click(checkB!);

    await user.click(screen.getByRole("button", { name: "Regler 2 credits" }));
    await user.click(await screen.findByRole("button", { name: "Valider le reglement" }));

    await waitFor(() => expect(mockSettleCredit).toHaveBeenCalledTimes(2));
    expect(mockSettleCredit).toHaveBeenNthCalledWith(1, 1, { settle_date: "2026-03-24" });
    expect(mockSettleCredit).toHaveBeenNthCalledWith(2, 4, { settle_date: "2026-03-24" });
    expect(mockEvaluateDailyLimitForAmount).toHaveBeenCalledTimes(1);
    expect(mockEvaluateDailyLimitForAmount).toHaveBeenCalledWith(1300, "2026-03-24");
  });

  it("collapses settled chains by default and lets user expand", async () => {
    mockSearchPayments.mockResolvedValueOnce([
      createRow({ id: 1 }),
      createRow({
        id: 2,
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 1,
        amount: 400,
        date: "2026-03-12",
        remaining_amount: 600,
      }),
      createRow({
        id: 3,
        status: "PAID",
        entry_type: "CREDIT_SETTLED",
        credit_payment_id: 1,
        amount: 600,
        date: "2026-03-15",
        remaining_amount: 0,
        credit_settled_date: "2026-03-15",
      }),
    ]);

    render(<PaymentsSearch />);
    const user = userEvent.setup();

    const chainToggle = await screen.findByRole("button", { name: /chaine credit #1/i });
    await waitFor(() => expect(chainToggle).toHaveAttribute("aria-expanded", "false"));
    expect(screen.queryByLabelText("Selectionner transaction 2")).not.toBeInTheDocument();

    await user.click(chainToggle);

    expect(await screen.findByText(/paiement partiel/i)).toBeInTheDocument();
    expect(chainToggle).toHaveAttribute("aria-expanded", "true");
  });

  it("defaults to transaction-date mode and filters locally by transaction dates", async () => {
    const rowA = createRow({ id: 1, supplier: "Supplier A", date: "2026-03-10" });
    const rowB = createRow({
      id: 2,
      supplier: "Supplier B",
      supplier_id: 3,
      status: "PAID",
      entry_type: "DIRECT_PAID",
      credit_payment_id: null,
      date: "2026-03-30",
      amount: 120,
      remaining_amount: null,
      original_credit_amount: null,
    });

    mockSearchPayments.mockResolvedValueOnce([rowA, rowB]);
    mockSearchPayments.mockResolvedValueOnce([rowA, rowB]);

    render(<PaymentsSearch />);
    const user = userEvent.setup();

    expect(await screen.findByText("Resultats (2)")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Date transaction debut/i), {
      target: { value: "2026-03-20" },
    });
    fireEvent.change(screen.getByLabelText(/Date transaction fin/i), {
      target: { value: "2026-03-31" },
    });

    await user.click(screen.getByRole("button", { name: "Rechercher" }));

    expect(await screen.findByText("Resultats (1)")).toBeInTheDocument();
    expect(screen.getByText("Supplier B", { selector: ".supplier-inline strong" })).toBeInTheDocument();
    expect(screen.queryByText("Supplier A", { selector: ".supplier-inline strong" })).not.toBeInTheDocument();

    const lastCall = mockSearchPayments.mock.calls[mockSearchPayments.mock.calls.length - 1]?.[0];
    expect(lastCall.start_expected_date).toBeUndefined();
    expect(lastCall.end_expected_date).toBeUndefined();
  });

  it("switches to expected-date mode and sends expected-date range to API", async () => {
    render(<PaymentsSearch />);
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "Date prevue credit" });

    await user.click(screen.getByRole("button", { name: "Date prevue credit" }));

    fireEvent.change(screen.getByLabelText(/Date prevue debut/i), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(screen.getByLabelText(/Date prevue fin/i), {
      target: { value: "2026-03-31" },
    });

    await user.click(screen.getByRole("button", { name: "Rechercher" }));

    const lastCall = mockSearchPayments.mock.calls[mockSearchPayments.mock.calls.length - 1]?.[0];
    expect(lastCall.start_expected_date).toBe("2026-03-01");
    expect(lastCall.end_expected_date).toBe("2026-03-31");
  });

  it("orders credit chains by latest transaction date", async () => {
    mockSearchPayments.mockResolvedValueOnce([
      createRow({
        id: 1,
        supplier: "Supplier A",
        date: "2025-01-05",
        amount: 1000,
        remaining_amount: 1000,
      }),
      createRow({
        id: 2,
        supplier: "Supplier A",
        status: "PAID",
        entry_type: "CREDIT_PARTIAL_PAYMENT",
        credit_payment_id: 1,
        date: "2026-04-05",
        amount: 300,
        remaining_amount: 700,
      }),
      createRow({
        id: 10,
        supplier: "Supplier B",
        supplier_id: 3,
        date: "2026-04-01",
        amount: 500,
        remaining_amount: 500,
      }),
    ]);

    render(<PaymentsSearch />);

    const headers = await screen.findAllByText(/Chaine credit #/i);
    expect(headers[0]).toHaveTextContent("Chaine credit #1");
    expect(headers[1]).toHaveTextContent("Chaine credit #10");
  });
});

