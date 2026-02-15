import { apiFetch } from "./client";
import { cacheGet, cacheSet } from "@/services/cache";

/* ─────────────────────────────
   Cache key helpers
───────────────────────────── */

function getWeekIdentifier(dateStr: string): string {
  const d = new Date(dateStr);
  // ISO week number calculation
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 4);
  const jan4 = target.valueOf();
  const msPerWeek = 604800000;
  const weekNum = Math.round((firstThursday - jan4) / msPerWeek) + 1;
  const year = d.getFullYear();
  return `${year}_W${String(weekNum).padStart(2, '0')}`;
}

function getMonthIdentifier(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}_M${month}`;
}

/* ─────────────────────────────
   Types
───────────────────────────── */

export type DailyPayment = {
  supplier: string;
  amount: number;
  status: string;
  note: string;
};

export type DailySummaryResponse = {
  revenue: number;
  paid: number;
  credit: number;
  cash_remaining: number;
  payments: DailyPayment[];
};

/* ─────────────────────────────
   Daily summary
───────────────────────────── */

export function getDailySummary(date: string) {
  return apiFetch<DailySummaryResponse>(
    `/summary/daily/${date}`
  )
    .then(data => {
      cacheSet(`daily_summary_${date}`, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<DailySummaryResponse>(`daily_summary_${date}`);
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

/* ─────────────────────────────
   Period summary (future-proof)
───────────────────────────── */

export type PeriodSummaryResponse = {
  revenue: number;
  paid: number;
  credit: number;
  net_cash: number;
};

export function getPeriodSummary(
  startDate: string,
  endDate: string,
  mode?: "WEEK" | "MONTH"
) {
  // Determine cache key based on mode
  let cacheKey: string;
  if (mode === "WEEK") {
    cacheKey = `period_summary_week_${getWeekIdentifier(startDate)}`;
  } else if (mode === "MONTH") {
    cacheKey = `period_summary_month_${getMonthIdentifier(startDate)}`;
  } else {
    cacheKey = `period_summary_${startDate}_${endDate}`;
  }

  return apiFetch<PeriodSummaryResponse>(
    `/summary/period?start_date=${startDate}&end_date=${endDate}`
  )
    .then(data => {
      cacheSet(cacheKey, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<PeriodSummaryResponse>(cacheKey);
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

/* ─────────────────────────────
   Supplier breakdown (future-proof)
───────────────────────────── */

export type SupplierSummary = {
  supplier_id: number;
  supplier: string;
  total_amount: number;
  total_paid: number;
  total_credit: number;
};

export type SupplierBreakdownResponse = {
  suppliers: SupplierSummary[];
  total_paid: number;
  total_credit: number;
  total: number;
};

export function getSupplierBreakdown(
  startDate: string,
  endDate: string,
  mode?: "WEEK" | "MONTH"
) {
  // Determine cache key based on mode
  let cacheKey: string;
  if (mode === "WEEK") {
    cacheKey = `supplier_breakdown_week_${getWeekIdentifier(startDate)}`;
  } else if (mode === "MONTH") {
    cacheKey = `supplier_breakdown_month_${getMonthIdentifier(startDate)}`;
  } else {
    cacheKey = `supplier_breakdown_${startDate}_${endDate}`;
  }

  return apiFetch<SupplierBreakdownResponse>(
    `/summary/suppliers?start_date=${startDate}&end_date=${endDate}`
  )
    .then(data => {
      cacheSet(cacheKey, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<SupplierBreakdownResponse>(cacheKey);
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}
