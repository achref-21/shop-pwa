import { apiFetch } from "./client";
import { cacheGet, cacheSet } from "@/services/cache";
import { monthIdentifier, todayLocalDate, weekIdentifier } from "@/utils/localDate";
import type { EntryType, PaymentStatus } from "./payments";

export type SummaryAggregationBasis = "date" | string;

export type CreditLifecycleStatus = "OPEN" | "SETTLED" | "OVERDUE" | "DUE_SOON";

const LIFECYCLE_STATUSES: CreditLifecycleStatus[] = [
  "OPEN",
  "SETTLED",
  "OVERDUE",
  "DUE_SOON",
];

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toArray<T>(value: unknown, mapper: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(mapper);
}

function normalizeLifecycleStatus(value: unknown): CreditLifecycleStatus {
  if (typeof value === "string" && LIFECYCLE_STATUSES.includes(value as CreditLifecycleStatus)) {
    return value as CreditLifecycleStatus;
  }
  return "OPEN";
}

function periodCacheKey(
  prefix: string,
  startDate: string,
  endDate: string,
  mode?: "WEEK" | "MONTH"
): string {
  if (mode === "WEEK") {
    return `${prefix}_week_${weekIdentifier(startDate)}`;
  }

  if (mode === "MONTH") {
    return `${prefix}_month_${monthIdentifier(startDate)}`;
  }

  return `${prefix}_${startDate}_${endDate}`;
}

function lifecycleCacheKey(
  startDate: string,
  endDate: string,
  asOfDate: string,
  mode?: "WEEK" | "MONTH"
): string {
  if (mode === "WEEK") {
    return `credits_lifecycle_week_${weekIdentifier(startDate)}_asof_${asOfDate}`;
  }

  if (mode === "MONTH") {
    return `credits_lifecycle_month_${monthIdentifier(startDate)}_asof_${asOfDate}`;
  }

  return `credits_lifecycle_${startDate}_${endDate}_asof_${asOfDate}`;
}

export type DailyPayment = {
  id?: number;
  supplier_id?: number;
  supplier: string;
  amount: number;
  status: PaymentStatus | string;
  note?: string;
  date?: string;
  expected_payment_date?: string | null;
  credit_payment_id?: number | null;
  entry_type?: EntryType | null;
  original_credit_amount?: number | null;
  remaining_amount?: number | null;
  credit_opened_date?: string | null;
  credit_expected_payment_date?: string | null;
  credit_settled_date?: string | null;
};

function normalizeDailyPayment(payload: unknown): DailyPayment {
  const raw = toRecord(payload);

  return {
    id: toOptionalNumber(raw.id),
    supplier_id: toOptionalNumber(raw.supplier_id),
    supplier: toStringValue(raw.supplier, "Inconnu"),
    amount: toNumber(raw.amount),
    status: toStringValue(raw.status, "PAID"),
    note: typeof raw.note === "string" ? raw.note : undefined,
    date: typeof raw.date === "string" ? raw.date : undefined,
    expected_payment_date: toNullableString(raw.expected_payment_date),
    credit_payment_id: toNullableNumber(raw.credit_payment_id),
    entry_type: (raw.entry_type as EntryType | null | undefined) ?? undefined,
    original_credit_amount: toNullableNumber(raw.original_credit_amount),
    remaining_amount: toNullableNumber(raw.remaining_amount),
    credit_opened_date: toNullableString(raw.credit_opened_date),
    credit_expected_payment_date: toNullableString(raw.credit_expected_payment_date),
    credit_settled_date: toNullableString(raw.credit_settled_date),
  };
}

export type DailyCreditLifecycleItem = {
  credit_payment_id: number;
  supplier_id: number;
  supplier: string;
  opened_on: string;
  expected_payment_date: string | null;
  original_credit_amount: number;
  paid_before_today: number;
  paid_today: number;
  remaining_after_today: number;
  status: CreditLifecycleStatus;
  due_in_days: number | null;
  credit_settled_date: string | null;
};

function normalizeDailyLifecycleItem(payload: unknown): DailyCreditLifecycleItem {
  const raw = toRecord(payload);

  return {
    credit_payment_id: toNumber(raw.credit_payment_id),
    supplier_id: toNumber(raw.supplier_id),
    supplier: toStringValue(raw.supplier, "Inconnu"),
    opened_on: toStringValue(raw.opened_on),
    expected_payment_date: toNullableString(raw.expected_payment_date),
    original_credit_amount: toNumber(raw.original_credit_amount),
    paid_before_today: toNumber(raw.paid_before_today),
    paid_today: toNumber(raw.paid_today),
    remaining_after_today: toNumber(raw.remaining_after_today),
    status: normalizeLifecycleStatus(raw.status),
    due_in_days: toNullableNumber(raw.due_in_days),
    credit_settled_date: toNullableString(raw.credit_settled_date),
  };
}

export type DailySummaryResponse = {
  date: string;
  aggregation_basis: SummaryAggregationBasis;
  revenue: number;
  paid: number;
  credit: number;
  cash_remaining: number;
  payments: DailyPayment[];
  credit_lifecycle: DailyCreditLifecycleItem[];
};

function normalizeDailySummaryResponse(payload: unknown, fallbackDate: string): DailySummaryResponse {
  const raw = toRecord(payload);

  return {
    date: toStringValue(raw.date, fallbackDate),
    aggregation_basis: toStringValue(raw.aggregation_basis, "date"),
    revenue: toNumber(raw.revenue),
    paid: toNumber(raw.paid),
    credit: toNumber(raw.credit ?? raw.credit_outstanding_as_of_end_for_period_opens),
    cash_remaining: toNumber(raw.cash_remaining),
    payments: toArray(raw.payments, normalizeDailyPayment),
    credit_lifecycle: toArray(raw.credit_lifecycle, normalizeDailyLifecycleItem),
  };
}

export function getDailySummary(date: string, asOfDate = todayLocalDate()) {
  const cacheKey = `daily_summary_${date}_asof_${asOfDate}`;

  return apiFetch<unknown>(`/summary/daily/${date}`)
    .then((data) => {
      const normalized = normalizeDailySummaryResponse(data, date);
      cacheSet(cacheKey, normalized);
      return normalized;
    })
    .catch(() => {
      const cached = cacheGet<DailySummaryResponse>(cacheKey);
      if (cached) {
        return cached;
      }
      throw new Error("Donnees non disponibles hors ligne");
    });
}

export type PeriodSummaryResponse = {
  period_start: string;
  period_end: string;
  aggregation_basis: SummaryAggregationBasis;
  revenue: number;
  paid: number;
  credit: number;
  credit_opened_in_period: number;
  credit_paid_in_period_for_period_opens: number;
  credit_outstanding_as_of_end_for_period_opens: number;
  net_cash: number;
};

function normalizePeriodSummaryResponse(
  payload: unknown,
  startDate: string,
  endDate: string
): PeriodSummaryResponse {
  const raw = toRecord(payload);

  return {
    period_start: toStringValue(raw.period_start, startDate),
    period_end: toStringValue(raw.period_end, endDate),
    aggregation_basis: toStringValue(raw.aggregation_basis, "date"),
    revenue: toNumber(raw.revenue),
    paid: toNumber(raw.paid),
    credit: toNumber(raw.credit ?? raw.credit_outstanding_as_of_end_for_period_opens),
    credit_opened_in_period: toNumber(raw.credit_opened_in_period),
    credit_paid_in_period_for_period_opens: toNumber(raw.credit_paid_in_period_for_period_opens),
    credit_outstanding_as_of_end_for_period_opens: toNumber(
      raw.credit_outstanding_as_of_end_for_period_opens
    ),
    net_cash: toNumber(raw.net_cash),
  };
}

export function getPeriodSummary(startDate: string, endDate: string, mode?: "WEEK" | "MONTH") {
  const cacheKey = periodCacheKey("period_summary", startDate, endDate, mode);

  return apiFetch<unknown>(`/summary/period?start_date=${startDate}&end_date=${endDate}`)
    .then((data) => {
      const normalized = normalizePeriodSummaryResponse(data, startDate, endDate);
      cacheSet(cacheKey, normalized);
      return normalized;
    })
    .catch(() => {
      const cached = cacheGet<PeriodSummaryResponse>(cacheKey);
      if (cached) {
        return cached;
      }
      throw new Error("Donnees non disponibles hors ligne");
    });
}

export type SupplierSummary = {
  supplier_id: number;
  supplier: string;
  total_amount: number;
  total_paid: number;
  total_credit: number;
};

function normalizeSupplierSummary(payload: unknown): SupplierSummary {
  const raw = toRecord(payload);

  return {
    supplier_id: toNumber(raw.supplier_id),
    supplier: toStringValue(raw.supplier, "Inconnu"),
    total_amount: toNumber(raw.total_amount),
    total_paid: toNumber(raw.total_paid),
    total_credit: toNumber(raw.total_credit),
  };
}

export type SupplierBreakdownResponse = {
  suppliers: SupplierSummary[];
  total_paid: number;
  total_credit: number;
  total: number;
};

function normalizeSupplierBreakdownResponse(payload: unknown): SupplierBreakdownResponse {
  const raw = toRecord(payload);

  return {
    suppliers: toArray(raw.suppliers, normalizeSupplierSummary),
    total_paid: toNumber(raw.total_paid),
    total_credit: toNumber(raw.total_credit),
    total: toNumber(raw.total),
  };
}

export function getSupplierBreakdown(startDate: string, endDate: string, mode?: "WEEK" | "MONTH") {
  const cacheKey = periodCacheKey("supplier_breakdown", startDate, endDate, mode);

  return apiFetch<unknown>(`/summary/suppliers?start_date=${startDate}&end_date=${endDate}`)
    .then((data) => {
      const normalized = normalizeSupplierBreakdownResponse(data);
      cacheSet(cacheKey, normalized);
      return normalized;
    })
    .catch(() => {
      const cached = cacheGet<SupplierBreakdownResponse>(cacheKey);
      if (cached) {
        return cached;
      }
      throw new Error("Donnees non disponibles hors ligne");
    });
}

export type PeriodCreditLifecycleItem = {
  credit_payment_id: number;
  supplier_id: number;
  supplier: string;
  opened_on: string;
  expected_payment_date: string | null;
  original_credit_amount: number;
  paid_before_start: number;
  paid_in_period: number;
  remaining_as_of_end: number;
  credit_settled_date: string | null;
  status: CreditLifecycleStatus;
  due_in_days: number | null;
};

function normalizePeriodLifecycleItem(payload: unknown): PeriodCreditLifecycleItem {
  const raw = toRecord(payload);

  return {
    credit_payment_id: toNumber(raw.credit_payment_id),
    supplier_id: toNumber(raw.supplier_id),
    supplier: toStringValue(raw.supplier, "Inconnu"),
    opened_on: toStringValue(raw.opened_on),
    expected_payment_date: toNullableString(raw.expected_payment_date),
    original_credit_amount: toNumber(raw.original_credit_amount),
    paid_before_start: toNumber(raw.paid_before_start),
    paid_in_period: toNumber(raw.paid_in_period),
    remaining_as_of_end: toNumber(raw.remaining_as_of_end),
    credit_settled_date: toNullableString(raw.credit_settled_date),
    status: normalizeLifecycleStatus(raw.status),
    due_in_days: toNullableNumber(raw.due_in_days),
  };
}

export type CreditsLifecycleResponse = {
  period_start: string;
  period_end: string;
  aggregation_basis: SummaryAggregationBasis;
  credits: PeriodCreditLifecycleItem[];
};

function normalizeCreditsLifecycleResponse(
  payload: unknown,
  startDate: string,
  endDate: string
): CreditsLifecycleResponse {
  const raw = toRecord(payload);

  return {
    period_start: toStringValue(raw.period_start, startDate),
    period_end: toStringValue(raw.period_end, endDate),
    aggregation_basis: toStringValue(raw.aggregation_basis, "date"),
    credits: toArray(raw.credits, normalizePeriodLifecycleItem),
  };
}

export function getCreditsLifecycle(
  startDate: string,
  endDate: string,
  asOfDate = todayLocalDate(),
  mode?: "WEEK" | "MONTH"
) {
  const cacheKey = lifecycleCacheKey(startDate, endDate, asOfDate, mode);

  return apiFetch<unknown>(
    `/summary/credits/lifecycle?start_date=${startDate}&end_date=${endDate}`
  )
    .then((data) => {
      const normalized = normalizeCreditsLifecycleResponse(data, startDate, endDate);
      cacheSet(cacheKey, normalized);
      return normalized;
    })
    .catch(() => {
      const cached = cacheGet<CreditsLifecycleResponse>(cacheKey);
      if (cached) {
        return cached;
      }
      throw new Error("Donnees non disponibles hors ligne");
    });
}

export const __summaryTestUtils = {
  normalizeDailySummaryResponse,
  normalizePeriodSummaryResponse,
  normalizeCreditsLifecycleResponse,
  lifecycleCacheKey,
};
