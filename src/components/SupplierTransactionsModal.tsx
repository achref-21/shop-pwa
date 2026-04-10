import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { apiFetch } from "@/api/client";
import type { SupplierSummary } from "@/api/summary";
import type { EntryType, PaymentStatus } from "@/api/payments";
import {
  formatAmount,
  formatDateDDMMYYYY,
  getCreditExpectedDate,
  getEntryTypeLabel,
  getRemainingAmount,
  groupPaymentsByCreditThread,
  inferEntryType,
} from "@/utils/paymentDisplay";
import { parseLocalDate, todayLocalDate } from "@/utils/localDate";
import "./SupplierTransactionsModal.css";

type Props = {
  supplier: SupplierSummary;
  start: string;
  end: string;
  onClose: () => void;
};

type Transaction = {
  id: number;
  supplier?: string;
  date: string;
  amount: number;
  status: PaymentStatus;
  note?: string;
  expected_payment_date?: string | null;
  credit_payment_id?: number | null;
  entry_type?: EntryType | null;
  original_credit_amount?: number | null;
  remaining_amount?: number | null;
  credit_opened_date?: string | null;
  credit_expected_payment_date?: string | null;
  credit_settled_date?: string | null;
};

function normalizeIsoDate(dateStr?: string | null): string | null {
  if (!dateStr) {
    return null;
  }

  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }

  return dateStr;
}

function getBadgeTone(
  row: Transaction
): { tone: "success" | "warning" | "danger" | "info"; emphasize?: boolean } {
  const entryType = inferEntryType(row);

  if (entryType === "DIRECT_PAID" || entryType === "CREDIT_SETTLED") {
    return { tone: "success" };
  }

  const remainingAmount = getRemainingAmount(row);
  if (remainingAmount === 0 || Boolean(row.credit_settled_date)) {
    return { tone: "success" };
  }

  const expectedDate = normalizeIsoDate(getCreditExpectedDate(row));
  if (!expectedDate) {
    return { tone: "info" };
  }

  const today = todayLocalDate();
  if (expectedDate < today) {
    return { tone: "danger" };
  }

  if (expectedDate === today) {
    return { tone: "warning", emphasize: true };
  }

  const dayDiff = Math.round(
    (parseLocalDate(expectedDate).getTime() - parseLocalDate(today).getTime()) / 86400000
  );
  if (dayDiff <= 3) {
    return { tone: "warning" };
  }

  return { tone: "info" };
}

export default function SupplierTransactionsModal({ supplier, start, end, onClose }: Props) {
  const isOnline = useOnline();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState("");

  const dateKey = `supplier_trans_${supplier.supplier_id}_${start}_${end}`;

  const fetchTransactions = useCallback(
    () =>
      apiFetch<Transaction[]>(
        `/suppliers/${supplier.supplier_id}/transactions?start_date=${start}&end_date=${end}`
      ),
    [end, start, supplier.supplier_id]
  );

  const transactionData = useDateAwareCachedData({
    isOnline,
    dateKey,
    fetchData: fetchTransactions,
  });

  const threads = useMemo(() => groupPaymentsByCreditThread(rows), [rows]);

  useEffect(() => {
    if (transactionData.data) {
      setRows(transactionData.data);
      setLoadError("");
      return;
    }

    if (transactionData.error) {
      setRows([]);
      setLoadError(transactionData.error.message);
    }
  }, [transactionData.data, transactionData.error]);

  return (
    <div className="modal-backdrop">
      <div className="modal large transactions-modal">
        <h2>
          {supplier.supplier} - {start} {"->"} {end}
        </h2>

        {loadError && <div className="transactions-error">Erreur: {loadError}</div>}

        {!loadError && rows.length === 0 && (
          <div className="transactions-empty">Aucune transaction sur cette periode.</div>
        )}

        {!loadError && rows.length > 0 && (
          <div className="transactions-list">
            {threads.map((thread) => (
              <div className="payment-thread" key={thread.key}>
                {thread.creditRootId && (
                  <div className="thread-header">Chaine credit #{thread.creditRootId}</div>
                )}

                {thread.items.map((row) => {
                  const expectedDate = getCreditExpectedDate(row);
                  const remainingAmount = getRemainingAmount(row);
                  const entryType = inferEntryType(row);
                  const badgeTone = getBadgeTone(row);
                  const rowDate = normalizeIsoDate(row.date);
                  const settledDate = normalizeIsoDate(row.credit_settled_date);
                  const hasSettledDateDetail =
                    entryType === "CREDIT_SETTLED" &&
                    settledDate &&
                    settledDate !== rowDate;

                  const detailItems: string[] = [];
                  if (entryType === "CREDIT_OPEN" && expectedDate) {
                    detailItems.push(`Prevu le: ${formatDateDDMMYYYY(expectedDate)}`);
                  }
                  if (entryType === "CREDIT_PARTIAL_PAYMENT" && remainingAmount !== null) {
                    detailItems.push(`Restant apres paiement: ${formatAmount(remainingAmount)}`);
                  }
                  if (hasSettledDateDetail) {
                    detailItems.push(`Regle le: ${formatDateDDMMYYYY(settledDate)}`);
                  }
                  if (row.note) {
                    detailItems.push(`Note: ${row.note}`);
                  }

                  return (
                    <div
                      key={row.id}
                      className={`transaction-row ${row.status.toLowerCase()} ${
                        thread.creditRootId && thread.root?.id !== row.id ? "child-row" : ""
                      }`}
                    >
                      <div className="transaction-headline">
                        <strong>{formatDateDDMMYYYY(row.date)}</strong>
                        <span className="transaction-amount">{formatAmount(row.amount)}</span>
                        <span
                          className={`badge entry-badge ${badgeTone.tone} ${
                            badgeTone.emphasize ? "emphasis" : ""
                          }`}
                        >
                          {getEntryTypeLabel(row)}
                        </span>
                      </div>

                      {detailItems.length > 0 && (
                        <div className="transaction-details">
                          {detailItems.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <button className="secondary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
