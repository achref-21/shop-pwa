import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreditsLifecycleModal from "./CreditsLifecycleModal";

const mockGetCreditsLifecycle = vi.fn();

vi.mock("@/hooks/useOnline", () => ({
  useOnline: () => true,
}));

vi.mock("@/api/summary", async () => {
  const actual = await vi.importActual<object>("@/api/summary");
  return {
    ...actual,
    getCreditsLifecycle: (...args: unknown[]) => mockGetCreditsLifecycle(...args),
  };
});

describe("CreditsLifecycleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders lifecycle rows and supports status/supplier filtering", async () => {
    mockGetCreditsLifecycle.mockResolvedValue({
      period_start: "2026-03-09",
      period_end: "2026-03-15",
      aggregation_basis: "date",
      credits: [
        {
          credit_payment_id: 1,
          supplier_id: 9,
          supplier: "Alpha",
          opened_on: "2026-03-09",
          expected_payment_date: "2026-03-18",
          original_credit_amount: 200,
          paid_before_start: 10,
          paid_in_period: 30,
          remaining_as_of_end: 160,
          credit_settled_date: null,
          status: "OPEN",
          due_in_days: 3,
        },
        {
          credit_payment_id: 2,
          supplier_id: 10,
          supplier: "Beta",
          opened_on: "2026-03-10",
          expected_payment_date: "2026-03-11",
          original_credit_amount: 300,
          paid_before_start: 0,
          paid_in_period: 0,
          remaining_as_of_end: 300,
          credit_settled_date: null,
          status: "OVERDUE",
          due_in_days: -2,
        },
      ],
    });

    render(
      <CreditsLifecycleModal
        startDate="2026-03-09"
        endDate="2026-03-15"
        mode="WEEK"
        onClose={() => undefined}
      />
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Statut"), "OVERDUE");

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Fournisseur"));
    await user.type(screen.getByLabelText("Fournisseur"), "zz");

    expect(screen.getByText("Aucun credit pour cette periode.")).toBeInTheDocument();
  });

  it("shows retry action after load error", async () => {
    mockGetCreditsLifecycle
      .mockRejectedValueOnce(new Error("backend down"))
      .mockResolvedValueOnce({
        period_start: "2026-03-09",
        period_end: "2026-03-15",
        aggregation_basis: "date",
        credits: [],
      });

    render(
      <CreditsLifecycleModal
        startDate="2026-03-09"
        endDate="2026-03-15"
        mode="WEEK"
        onClose={() => undefined}
      />
    );

    expect(await screen.findByText(/Erreur: backend down/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reessayer" }));

    await waitFor(() => {
      expect(mockGetCreditsLifecycle).toHaveBeenCalledTimes(2);
    });
  });
});
