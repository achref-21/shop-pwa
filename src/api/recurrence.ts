import { apiFetch } from "./client";

export type RecurrenceFrequency =
  | "WEEKLY"
  | "MONTHLY"
  | "TRIMESTER"
  | "YEARLY";

export type RecurringExpense = {
  id: number;
  expense_category_id: number;
  category_name: string;
  name: string;
  amount: number;
  recurrence_type: RecurrenceFrequency;
  start_date: string;
  weekday?: number | null;
  day_of_month?: number | null;
  is_active: boolean;
  created_at?: string;
};

export type CreateRecurringPayload = {
  expense_category_id: number;
  label: string;
  amount: number;
  frequency: RecurrenceFrequency;
  start_date: string;
  due_day_of_week?: number | null;
  due_day_of_month?: number | null;
  months_interval?: number | null;
};

/* ─────────────────────────────
   CRUD
───────────────────────────── */

export function getRecurringExpenses() {
  return apiFetch<RecurringExpense[]>("/recurring/expenses");
}

export function getRecurringExpense(id: number) {
  return apiFetch<RecurringExpense>(`/recurring/expenses/${id}`);
}

export function createRecurringExpense(data: CreateRecurringPayload) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }

  return apiFetch<RecurringExpense>("/recurring/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRecurringExpense(
  id: number,
  data: CreateRecurringPayload
) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }

  return apiFetch<RecurringExpense>(`/recurring/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteRecurringExpense(id: number) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }

  return apiFetch(`/recurring/expenses/${id}`, {
    method: "DELETE",
  });
}

export function toggleRecurringExpense(id: number) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }

  return apiFetch<RecurringExpense>(
    `/recurring/expenses/${id}/toggle`,
    { method: "PATCH" }
  );
}

export function triggerRecurringGeneration() {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }

  return apiFetch<{ generated: number }>(
    "/recurring/generate",
    { method: "POST" }
  );
}
