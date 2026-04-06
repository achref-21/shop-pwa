import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

import PeriodSummary from "./screens/PeriodSummary";
import PaymentsSearch from "./screens/PaymentsSearch";
import Suppliers from "./screens/Suppliers";
import Revenue from "./screens/Revenue";
import Payments from "./screens/Payments";
import DailySummary from "./screens/Daily";
import Recurrence from "./screens/recurrence";
import HomeDashboardPage from "./screens/HomeDashboard";
import DashboardNext from "./screens/DashboardNext";

export const appRoutes = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeDashboardPage /> },
      { path: "dashboard-next", element: <DashboardNext /> },
      { path: "recherche-paiements", element: <PaymentsSearch /> },
      { path: "fournisseurs", element: <Suppliers /> },
      { path: "recette", element: <Revenue /> },
      { path: "resume-journalier", element: <DailySummary /> },
      { path: "recurrences", element: <Recurrence /> },
      { path: "synthese-periodique", element: <PeriodSummary /> },
      { path: "paiements", element: <Payments /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes, {
  basename: "/shop-pwa/",
});
