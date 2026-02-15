import { apiFetch } from "./client";
import { cacheGet, cacheSet } from "@/services/cache";

export type Supplier = {
  id: number;
  name: string;
  phone?: string;
  notes?: string;
};

export function getSuppliers() {
  return apiFetch<Supplier[]>("/suppliers")
    .then(data => {
      cacheSet("suppliers", data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<Supplier[]>("suppliers");
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

export type SupplierWithCredit = Supplier & {
  credit_total: number;
};

export function getSuppliersWithCredit() {
  return apiFetch<SupplierWithCredit[]>("/suppliers/with-credit")
    .then(data => {
      cacheSet("suppliers_with_credit", data);
      return data;
    })
    .catch(() => {
      const cached = cacheGet<SupplierWithCredit[]>("suppliers_with_credit");
      if (cached) return cached;
      throw new Error("Données non disponibles hors ligne");
    });
}

export function createSupplier(data: {
  name: string;
  phone?: string;
  notes?: string;
}) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch("/suppliers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSupplier(
  supplierId: number,
  data: { name: string; phone?: string; notes?: string }
) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/suppliers/${supplierId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteSupplier(supplierId: number) {
  if (!navigator.onLine) {
    return Promise.reject(new Error("Opération impossible hors ligne"));
  }
  return apiFetch(`/suppliers/${supplierId}`, {
    method: "DELETE",
  });
}

