import { apiFetch } from "./client";
import { cacheGet, cacheSet } from "@/services/cache";

export type Revenue = {
  date: string;
  amount: number;
  note?: string;
};

export function getRevenue(date: string) {
  return apiFetch<Revenue | null>(`/revenue/${date}`)
    .then(data => {
      cacheSet(`revenue_${date}`, data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<Revenue | null>(`revenue_${date}`);
      if (cached !== null) return cached;
      return null;
    });
}

export function saveRevenue(payload: {
  date: string;
  amount: string;
  note: string;
}) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch("/revenue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
