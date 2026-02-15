import { apiFetch } from "./client";
import { cacheGet, cacheSet } from "@/services/cache";

export type PaymentStatus = "PAID" | "CREDIT" | "INSTALLMENTS";

export type Payment = {
  id: number;
  supplier: string;
  supplier_id: number;
  date: string; 
  amount: number;
  status: PaymentStatus;
  note?: string;
  expected_payment_date?: string | null;
  created_at?: string; // Payment creation date (for 90-day caching)
};

export type PaymentsSearchFilters = {
  supplier_id?: number;
  status?: "PAID" | "CREDIT";
  start_expected_date?: string;
  end_expected_date?: string;
  overdue_only?: boolean;
};

/* ─────────────────────────────
   90-Day Cache Management
───────────────────────────── */
const CACHE_KEY_LAST_90_DAYS = "payments:last90days";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Gets the oldest date in the 90-day window (today - 90 days)
 */
function get90DaysAgoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split("T")[0];
}

/**
 * Filters payments to only include those created in the last 90 days
 */
function filterLast90Days(payments: Payment[]): Payment[] {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);
  return payments.filter(p => {
    const createdDate = new Date(p.created_at || p.date);
    return createdDate >= ninetyDaysAgo;
  });
}

/**
 * Local filtering function - mirrors backend behavior as closely as possible
 */
export function filterPaymentsLocal(
  payments: Payment[],
  filters: PaymentsSearchFilters
): Payment[] {
  let filtered = [...payments];

  // Filter by supplier
  if (filters.supplier_id) {
    filtered = filtered.filter(p => p.supplier_id === filters.supplier_id);
  }

  // Filter by status
  if (filters.status) {
    filtered = filtered.filter(p => p.status === filters.status);
  }

  // Filter by expected payment date range (only applies to CREDIT payments)
  // The date pickers are specifically for credit payment dates
  if (filters.start_expected_date) {
    const startDate = filters.start_expected_date;
    filtered = filtered.filter(p =>
      p.status !== "CREDIT" || !p.expected_payment_date || p.expected_payment_date >= startDate
    );
  }

  if (filters.end_expected_date) {
    const endDate = filters.end_expected_date;
    filtered = filtered.filter(p =>
      p.status !== "CREDIT" || !p.expected_payment_date || p.expected_payment_date <= endDate
    );
  }

  // Filter overdue only (only applies to CREDIT payments)
  if (filters.overdue_only) {
    const now = new Date();
    filtered = filtered.filter(p => {
      if (p.status !== "CREDIT" || !p.expected_payment_date) return false;
      return new Date(p.expected_payment_date) < now;
    });
  }

  return filtered;
}

/**
 * Stores payments in the 90-day cache, respecting the window
 */
function cachePayments90Days(payments: Payment[]): void {
  const filtered = filterLast90Days(payments);
  cacheSet(CACHE_KEY_LAST_90_DAYS, filtered);
}

/**
 * Retrieves cached payments from the 90-day window
 */
function getCachedPayments90Days(): Payment[] {
  return cacheGet<Payment[]>(CACHE_KEY_LAST_90_DAYS) || [];
}

/**
 * Checks if a date range is within the cached 90-day window
 */
export function isDateRangeWithinCache(
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate && !endDate) return true; // No filter = always within window

  const ninetyDaysAgo = get90DaysAgoDate();
  const today = new Date().toISOString().split("T")[0];

  if (startDate && startDate < ninetyDaysAgo) return false;
  if (endDate && endDate > today) return false;

  return true;
}

export type PaymentListResponse = {
  payments: Payment[];
  total_paid: number;
  total_credit: number;
};

export function getPaymentsByDate(date: string) {
  return apiFetch<PaymentListResponse>(`/payments/date/${date}`)
    .then(data => {
      cacheSet(`payments_date_${date}`, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<PaymentListResponse>(`payments_date_${date}`);
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

export function getPayment(id: number) {
  return apiFetch<Payment>(`/payments/${id}`)
    .then(data => {
      cacheSet(`payment_${id}`, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<Payment>(`payment_${id}`);
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

export function createPayment(data: {
  supplier_id: number;
  date: string;
  amount: number;
  status: PaymentStatus;
  note?: string;
  expected_payment_date?: string | null;
}) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePayment(
  id: number,
  data: {
    supplier_id: number;
    date: string;
    amount: number;
    status: PaymentStatus;
    note?: string;
    expected_payment_date?: string | null;
  }
) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePayment(id: number) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/payments/${id}`, { method: "DELETE" });
}

export function settleCredit(id: number) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/payments/${id}/settle`, { method: "POST" });
}


/**
 * Searches payments with full offline support.
 * - When ONLINE: calls API and caches results in 90-day window
 * - When OFFLINE: uses cached 90-day data with local filtering
 */
export function searchPayments(
  params: PaymentsSearchFilters,
  isOnline: boolean
): Promise<Payment[]> {
  const query = new URLSearchParams();

  if (params.supplier_id)
    query.append("supplier_id", String(params.supplier_id));

  if (params.status)
    query.append("status", params.status);

  if (params.start_expected_date)
    query.append("start_expected_date", params.start_expected_date);

  if (params.end_expected_date)
    query.append("end_expected_date", params.end_expected_date);

  if (params.overdue_only)
    query.append("overdue_only", "true");

  // If offline, use local filtering
  if (!isOnline) {
    const cachedPayments = getCachedPayments90Days();
    if (cachedPayments.length > 0) {
      return Promise.resolve(filterPaymentsLocal(cachedPayments, params));
    }
    // No cache available
    return Promise.reject(
      new Error("Aucune donnée en cache. Connectez-vous pour charger les paiements.")
    );
  }

  // Online: call API
  return apiFetch<Payment[]>(
    `/payments/search/filter?${query.toString()}`
  )
    .then(data => {
      // Cache the full result (will be filtered to 90-day window)
      cachePayments90Days(data);
      return data;
    })
    .catch(() => {
      // API error: try to use cached data
      const cachedPayments = getCachedPayments90Days();
      if (cachedPayments.length > 0) {
        return filterPaymentsLocal(cachedPayments, params);
      }
      throw new Error("Données non disponibles hors ligne");
    });
}

