import type { DashboardMode } from "@/api/dashboard";
import type { Payment } from "@/api/payments";
import { addDays, formatLocalDate, parseLocalDate } from "@/utils/localDate";
import {
  getCreditExpectedDate,
  getOriginalCreditAmount,
  getRemainingAmount,
  isOpenCreditRoot,
} from "@/utils/paymentDisplay";

export const DASHBOARD_NEXT_DAILY_LIMIT_KEY = "shop_pwa_dashboard_next_daily_limit";
export const DASHBOARD_NEXT_MODE_KEY = "shop_pwa_dashboard_next_period_mode";

export type DashboardNextCreditLine = {
  paymentId: number;
  supplier: string;
  expectedDate: string | null;
  originalAmount: number;
  remainingAmount: number;
  isPartial: boolean;
};

export type DashboardNextCreditCollections = {
  todayScheduled: DashboardNextCreditLine[];
  tomorrowScheduled: DashboardNextCreditLine[];
  overdueLines: DashboardNextCreditLine[];
  totalRemaining: number;
  totalOverdue: number;
};

export type DailyLimitUsage =
  | {
      kind: "unavailable";
    }
  | {
      kind: "limit_unset";
      spent: number;
    }
  | {
      kind: "ready";
      spent: number;
      limit: number;
      percentage: number;
      isOverLimit: boolean;
    };

function normalizeIsoDate(input: string | null): string | null {
  if (!input) return null;
  return input.includes("T") ? input.split("T")[0] : input;
}

function toLine(payment: Payment): DashboardNextCreditLine | null {
  if (!isOpenCreditRoot(payment)) {
    return null;
  }

  const expectedDate = normalizeIsoDate(getCreditExpectedDate(payment));
  const originalAmount = Number(getOriginalCreditAmount(payment) ?? payment.amount);
  const remainingAmount = Number(getRemainingAmount(payment) ?? payment.amount);

  return {
    paymentId: payment.id,
    supplier: payment.supplier,
    expectedDate,
    originalAmount,
    remainingAmount,
    isPartial: remainingAmount < originalAmount,
  };
}

function bySupplierAndId(left: DashboardNextCreditLine, right: DashboardNextCreditLine): number {
  const supplierCmp = left.supplier.localeCompare(right.supplier);
  if (supplierCmp !== 0) return supplierCmp;
  return left.paymentId - right.paymentId;
}

export function computeCreditCollections(
  payments: Payment[],
  today: string,
  tomorrow: string
): DashboardNextCreditCollections {
  const openCredits = payments
    .map(toLine)
    .filter((value): value is DashboardNextCreditLine => value !== null);

  const todayScheduled = openCredits
    .filter((line) => line.expectedDate === today)
    .sort(bySupplierAndId);
  const tomorrowScheduled = openCredits
    .filter((line) => line.expectedDate === tomorrow)
    .sort(bySupplierAndId);
  const overdueLines = openCredits
    .filter((line) => line.expectedDate !== null && line.expectedDate < today)
    .sort(bySupplierAndId);

  const totalRemaining = openCredits.reduce((sum, line) => sum + line.remainingAmount, 0);
  const totalOverdue = overdueLines.reduce((sum, line) => sum + line.remainingAmount, 0);

  return {
    todayScheduled,
    tomorrowScheduled,
    overdueLines,
    totalRemaining,
    totalOverdue,
  };
}

export function computeDailyLimitUsage(
  spentToday: number | null,
  dailyLimit: number | null
): DailyLimitUsage {
  if (spentToday === null) {
    return { kind: "unavailable" };
  }

  if (dailyLimit === null || dailyLimit <= 0) {
    return {
      kind: "limit_unset",
      spent: spentToday,
    };
  }

  const percentage = (spentToday / dailyLimit) * 100;
  return {
    kind: "ready",
    spent: spentToday,
    limit: dailyLimit,
    percentage,
    isOverLimit: percentage > 100,
  };
}

export function getTomorrowDate(today: string): string {
  return formatLocalDate(addDays(parseLocalDate(today), 1));
}

export function parseStoredDailyLimit(rawValue: string | null): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseStoredMode(rawValue: string | null): DashboardMode {
  return rawValue === "MONTH" ? "MONTH" : "WEEK";
}
