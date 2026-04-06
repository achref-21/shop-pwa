import { render, screen } from "@testing-library/react";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import { appRoutes } from "./router";

vi.mock("./layout/AppLayout", () => ({
  default: () => (
    <div>
      <Outlet />
    </div>
  ),
}));

vi.mock("./screens/HomeDashboard", () => ({
  default: () => <div>HOME_DASHBOARD_SCREEN</div>,
}));

vi.mock("./screens/DashboardNext", () => ({
  default: () => <div>DASHBOARD_NEXT_SCREEN</div>,
}));

vi.mock("./screens/PeriodSummary", () => ({ default: () => <div /> }));
vi.mock("./screens/PaymentsSearch", () => ({ default: () => <div /> }));
vi.mock("./screens/Suppliers", () => ({ default: () => <div /> }));
vi.mock("./screens/Revenue", () => ({ default: () => <div /> }));
vi.mock("./screens/Payments", () => ({ default: () => <div /> }));
vi.mock("./screens/Daily", () => ({ default: () => <div /> }));
vi.mock("./screens/recurrence", () => ({ default: () => <div /> }));

describe("router config", () => {
  it("renders current dashboard on /", async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("HOME_DASHBOARD_SCREEN")).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD_NEXT_SCREEN")).not.toBeInTheDocument();
  });

  it("renders beta dashboard on /dashboard-next", async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ["/dashboard-next"] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("DASHBOARD_NEXT_SCREEN")).toBeInTheDocument();
    expect(screen.queryByText("HOME_DASHBOARD_SCREEN")).not.toBeInTheDocument();
  });
});
