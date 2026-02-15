import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./layout/AppLayout";

import PeriodSummary from "./screens/PeriodSummary";
import PaymentsSearch from "./screens/PaymentsSearch";
import Suppliers from "./screens/Suppliers";
import Revenue from "./screens/Revenue";
import Payments from "./screens/Payments";
import DailySummary from "./screens/Daily";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <PeriodSummary /> },
      { path: "recherche-paiements", element: <PaymentsSearch /> },
      { path: "fournisseurs", element: <Suppliers /> },
      { path: "recette", element: <Revenue /> },
      { path: "resume-journalier", element: <DailySummary /> },
      { path: "synthese-periodique", element: <PeriodSummary /> },
      { path: "paiements", element: <Payments /> },
    ]
  }
]);
