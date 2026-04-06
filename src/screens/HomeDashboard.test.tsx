import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiHttpError } from "@/api/client";
import type { HomeDashboardResponse } from "@/api/dashboard";
import HomeDashboardPage from "./HomeDashboard";

const mockFetchHomeDashboard = vi.fn();

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<object>("@/api/dashboard");
  return {
    ...actual,
    fetchHomeDashboard: (...args: unknown[]) => mockFetchHomeDashboard(...args),
  };
});

vi.mock("recharts", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Null = () => null;

  return {
    ResponsiveContainer: Wrapper,
    LineChart: Wrapper,
    BarChart: Wrapper,
    CartesianGrid: Null,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    Legend: Null,
    Line: Null,
    Bar: Wrapper,
    LabelList: Null,
    ReferenceLine: Null,
  };
});

function buildPayload(overrides: Partial<HomeDashboardResponse> = {}): HomeDashboardResponse {
  return {
    as_of: "2026-03-21",
    mode: "WEEK",
    timezone: "Africa/Tunis",
    period: {
      start: "2026-03-16",
      end: "2026-03-22",
      effective_end: "2026-03-21",
      label: "Week 2026-03-16 to 2026-03-22",
    },
    kpis: {
      revenue: 5400,
      paid: 3200,
      credit_outstanding: 1800,
      net_cash: 2200,
      credit_opened_in_period: 1200,
      credit_collected_in_period: 700,
    },
    objectives: [
      {
        key: "cash_protection",
        label: "Protect cash",
        value: 40.74,
        target: 20,
        progress_pct: 100,
        status: "ON_TRACK",
      },
      {
        key: "overdue_reduction",
        label: "Reduce overdue credit",
        value: 27.78,
        target: 25,
        progress_pct: 90,
        status: "AT_RISK",
      },
    ],
    risk: {
      overdue_amount: 500,
      overdue_count: 2,
      due_soon_amount: 650,
      due_soon_count: 3,
      due_soon_window_days: 7,
    },
    charts: {
      net_cash_trend: [
        { period_key: "2026-03-16", start: "2026-03-16", end: "2026-03-16", value: 250 },
        { period_key: "2026-03-21", start: "2026-03-21", end: "2026-03-21", value: 900 },
      ],
      credit_status_breakdown: [
        { status: "OPEN", amount: 650, count: 4 },
        { status: "DUE_SOON", amount: 650, count: 3 },
        { status: "OVERDUE", amount: 500, count: 2 },
        { status: "SETTLED", amount: 0, count: 6 },
      ],
      top_suppliers_by_credit: [
        { supplier_id: 3, supplier: "Supplier C", credit_amount: 550, share_pct: 30.56 },
      ],
    },
    navigation: [
      {
        route: "/recherche-paiements",
        label: "Paiements en retard",
        badge_count: 2,
        badge_amount: 500,
        priority: "HIGH",
      },
    ],
    resources: {
      urgent_overdue_credits: [
        {
          credit_payment_id: 14,
          supplier_id: 3,
          supplier: "Supplier C",
          expected_payment_date: "2026-03-12",
          remaining_amount: 350,
          due_in_days: -9,
        },
      ],
      due_soon_credits: [
        {
          credit_payment_id: 21,
          supplier_id: 2,
          supplier: "Supplier B",
          expected_payment_date: "2026-03-24",
          remaining_amount: 250,
          due_in_days: 3,
        },
      ],
      watch_suppliers: [
        { supplier_id: 3, supplier: "Supplier C", credit_amount: 550, share_pct: 30.56 },
      ],
    },
    ...overrides,
  };
}

function renderDashboard(initialEntry = "/") {
  const router = createMemoryRouter([{ path: "/", element: <HomeDashboardPage /> }], {
    initialEntries: [initialEntry],
  });

  return render(<RouterProvider router={router} />);
}

describe("HomeDashboardPage visual refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchHomeDashboard.mockResolvedValue(buildPayload());
  });

  it("renders refreshed sections and omits navigation priorities", async () => {
    renderDashboard();

    expect(await screen.findByText("Indicateurs essentiels")).toBeInTheDocument();
    expect(screen.getByText("Progression des objectifs")).toBeInTheDocument();
    expect(screen.getByText("Risque credit")).toBeInTheDocument();
    expect(screen.getByText("Tendance cash net")).toBeInTheDocument();
    expect(screen.getByText("Top fournisseurs par credit")).toBeInTheDocument();
    expect(screen.getByText("Repartition des statuts credit")).toBeInTheDocument();
    expect(screen.getByText("Ressources de suivi")).toBeInTheDocument();
    expect(screen.queryByText("Priorites de navigation")).not.toBeInTheDocument();
  });

  it("renders only 4 primary KPIs and toggles detailed KPIs", async () => {
    renderDashboard();

    await screen.findByTestId("kpi-primary-net-cash");
    expect(screen.getByTestId("kpi-primary-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-primary-credit-outstanding")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-primary-overdue-amount")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-detailed-paid")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Afficher KPIs detailles" }));

    expect(screen.getByTestId("kpi-detailed-paid")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-detailed-opened")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-detailed-collected")).toBeInTheDocument();
  });

  it("refetches exactly once per control change", async () => {
    renderDashboard();

    await screen.findByText("Indicateurs essentiels");
    await waitFor(() => expect(mockFetchHomeDashboard).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Mode"), "MONTH");
    await waitFor(() => expect(mockFetchHomeDashboard).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Date d'ancrage"), { target: { value: "2026-03-20" } });
    await waitFor(() => expect(mockFetchHomeDashboard).toHaveBeenCalledTimes(3));
  });

  it("shows inline validation for 400 and keeps previous data", async () => {
    mockFetchHomeDashboard
      .mockResolvedValueOnce(buildPayload())
      .mockRejectedValueOnce(new ApiHttpError(400, "invalid period", "Bad Request"));

    renderDashboard();
    expect(await screen.findByTestId("kpi-primary-revenue")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Arrete au"), { target: { value: "2026-03-20" } });

    expect(await screen.findByText(/Erreur: invalid period/i)).toBeInTheDocument();
    expect(screen.getByTestId("kpi-primary-revenue")).toBeInTheDocument();
  });

  it("opens KPI tooltip and keeps placeholder buttons non-functional", async () => {
    renderDashboard();
    await screen.findByText("Indicateurs essentiels");

    const infoButton = screen.getByRole("button", { name: "Infos Recettes" });
    fireEvent.focus(infoButton);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: "Parametres indicateurs" });
    expect(settingsButton).toHaveAttribute("aria-disabled", "true");
  });

  it("renders section-level empty states", async () => {
    mockFetchHomeDashboard.mockResolvedValueOnce(
      buildPayload({
        objectives: [],
        charts: {
          net_cash_trend: [],
          credit_status_breakdown: [],
          top_suppliers_by_credit: [],
        },
        resources: {
          urgent_overdue_credits: [],
          due_soon_credits: [],
          watch_suppliers: [],
        },
      })
    );

    renderDashboard();

    expect(await screen.findByText("Aucun objectif retourne.")).toBeInTheDocument();
    expect(screen.getByText("Aucune tendance disponible.")).toBeInTheDocument();
    expect(screen.getByText("Aucun fournisseur expose.")).toBeInTheDocument();
    expect(screen.getAllByText("Aucun element.").length).toBeGreaterThanOrEqual(2);
  });
});
