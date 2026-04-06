import { apiFetch } from "./client";

export type DashboardMode = "WEEK" | "MONTH";

export type ObjectiveStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type NavigationPriority = "HIGH" | "MEDIUM" | "LOW";
export type CreditStatus = "OPEN" | "DUE_SOON" | "OVERDUE" | "SETTLED";

export type HomeDashboardPeriod = {
  start: string;
  end: string;
  effective_end: string;
  label: string;
};

export type HomeDashboardKpis = {
  revenue: number;
  paid: number;
  credit_outstanding: number;
  net_cash: number;
  credit_opened_in_period: number;
  credit_collected_in_period: number;
};

export type HomeDashboardObjective = {
  key: string;
  label: string;
  value: number;
  target: number;
  progress_pct: number;
  status: ObjectiveStatus;
};

export type HomeDashboardRisk = {
  overdue_amount: number;
  overdue_count: number;
  due_soon_amount: number;
  due_soon_count: number;
  due_soon_window_days: number;
};

export type NetCashTrendPoint = {
  period_key: string;
  start: string;
  end: string;
  value: number;
};

export type CreditStatusBreakdownRow = {
  status: CreditStatus;
  amount: number;
  count: number;
};

export type TopSupplierByCreditRow = {
  supplier_id: number;
  supplier: string;
  credit_amount: number;
  share_pct: number;
};

export type HomeDashboardNavigationItem = {
  route: string;
  label: string;
  badge_count: number;
  badge_amount: number;
  priority: NavigationPriority;
};

export type CreditResourceItem = {
  credit_payment_id: number;
  supplier_id: number;
  supplier: string;
  expected_payment_date: string | null;
  remaining_amount: number;
  due_in_days: number | null;
};

export type WatchSupplierItem = {
  supplier_id: number;
  supplier: string;
  credit_amount: number;
  share_pct: number;
};

export type HomeDashboardResources = {
  urgent_overdue_credits: CreditResourceItem[];
  due_soon_credits: CreditResourceItem[];
  watch_suppliers: WatchSupplierItem[];
};

export type HomeDashboardCharts = {
  net_cash_trend: NetCashTrendPoint[];
  credit_status_breakdown: CreditStatusBreakdownRow[];
  top_suppliers_by_credit: TopSupplierByCreditRow[];
};

export type HomeDashboardResponse = {
  as_of: string;
  mode: DashboardMode;
  timezone: string;
  period: HomeDashboardPeriod;
  kpis: HomeDashboardKpis;
  objectives: HomeDashboardObjective[];
  risk: HomeDashboardRisk;
  charts: HomeDashboardCharts;
  navigation: HomeDashboardNavigationItem[];
  resources: HomeDashboardResources;
};

export type FetchHomeDashboardParams = {
  as_of: string;
  mode: DashboardMode;
  anchor_date: string;
  signal?: AbortSignal;
};

function buildHomeDashboardQuery(params: Omit<FetchHomeDashboardParams, "signal">): string {
  const query = new URLSearchParams();
  query.set("as_of", params.as_of);
  query.set("mode", params.mode);
  query.set("anchor_date", params.anchor_date);
  return query.toString();
}

export function fetchHomeDashboard(params: FetchHomeDashboardParams) {
  const query = buildHomeDashboardQuery({
    as_of: params.as_of,
    mode: params.mode,
    anchor_date: params.anchor_date,
  });

  return apiFetch<HomeDashboardResponse>(`/dashboard/home?${query}`, {
    signal: params.signal,
  });
}

export const __dashboardTestUtils = {
  buildHomeDashboardQuery,
};

