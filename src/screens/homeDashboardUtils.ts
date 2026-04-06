import type {
  CreditStatus,
  CreditStatusBreakdownRow,
  DashboardMode,
  ObjectiveStatus,
} from "@/api/dashboard";
import { parseLocalDate } from "@/utils/localDate";

export type HomeDashboardSearchState = {
  as_of: string;
  mode: DashboardMode;
  anchor_date: string;
};

const DASHBOARD_MODES: DashboardMode[] = ["WEEK", "MONTH"];

export const CREDIT_STATUS_ORDER: CreditStatus[] = ["OPEN", "DUE_SOON", "OVERDUE", "SETTLED"];

export function isValidDashboardMode(value: string | null): value is DashboardMode {
  return value !== null && DASHBOARD_MODES.includes(value as DashboardMode);
}

export function isValidIsoDate(value: string | null): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function resolveHomeDashboardSearchState(
  input: URLSearchParams,
  today: string
): HomeDashboardSearchState {
  const mode = isValidDashboardMode(input.get("mode")) ? input.get("mode") : "WEEK";
  const as_of = isValidIsoDate(input.get("as_of")) ? input.get("as_of") : today;
  const anchor_date = isValidIsoDate(input.get("anchor_date")) ? input.get("anchor_date") : today;

  return {
    as_of: as_of ?? today,
    mode,
    anchor_date: anchor_date ?? today,
  };
}

export function toHomeDashboardSearchParams(state: HomeDashboardSearchState): URLSearchParams {
  const query = new URLSearchParams();
  query.set("as_of", state.as_of);
  query.set("mode", state.mode);
  query.set("anchor_date", state.anchor_date);
  return query;
}

export function getObjectiveStatusClassName(status: ObjectiveStatus): string {
  if (status === "ON_TRACK") return "on-track";
  if (status === "AT_RISK") return "at-risk";
  return "off-track";
}

export function orderCreditStatusBreakdown(
  rows: CreditStatusBreakdownRow[]
): CreditStatusBreakdownRow[] {
  const map = new Map<CreditStatus, CreditStatusBreakdownRow>();

  for (const row of rows) {
    map.set(row.status, row);
  }

  return CREDIT_STATUS_ORDER.map((status) => {
    const existing = map.get(status);
    if (existing) return existing;
    return {
      status,
      amount: 0,
      count: 0,
    };
  });
}

export function formatDueInDaysLabel(value: number | null): string {
  if (value === null) return "Sans echeance";
  if (value === 0) return "Echeance aujourd'hui";
  if (value > 0) return `Dans ${value} j`;
  return `${Math.abs(value)} j de retard`;
}

export function formatCompactAmount(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}
