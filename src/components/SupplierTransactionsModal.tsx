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
  getEntryTypeClassName,
  getEntryTypeIcon,
  getEntryTypeLabel,
  getOriginalCreditAmount,
  getRemainingAmount,
  groupPaymentsByCreditThread,
} from "@/utils/paymentDisplay";
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
                  const originalAmount = getOriginalCreditAmount(row);
                  const remainingAmount = getRemainingAmount(row);

                  return (
                    <div
                      key={row.id}
                      className={`transaction-row ${row.status.toLowerCase()} ${
                        thread.creditRootId && thread.root?.id !== row.id ? "child-row" : ""
                      }`}
                    >
                      <div className="transaction-headline">
                        <strong>{formatDateDDMMYYYY(row.date)}</strong>
                        <span>{formatAmount(row.amount)}</span>
                      </div>

                      <div className="transaction-badges">
                        <span className={`badge entry-badge ${getEntryTypeClassName(row)}`}>
                          <span className="entry-icon">{getEntryTypeIcon(row)}</span>
                          {getEntryTypeLabel(row)}
                        </span>
                        <span className="badge status-badge">{row.status}</span>
                      </div>

                      <div className="transaction-details">
                        {thread.creditRootId && <span>Reference credit: #{thread.creditRootId}</span>}
                        {originalAmount !== null && <span>Original: {formatAmount(originalAmount)}</span>}
                        {remainingAmount !== null && <span>Restant: {formatAmount(remainingAmount)}</span>}
                        {row.credit_opened_date && (
                          <span>Ouvert le: {formatDateDDMMYYYY(row.credit_opened_date)}</span>
                        )}
                        {expectedDate && (
                          <span>Prevu le (contexte): {formatDateDDMMYYYY(expectedDate)}</span>
                        )}
                        {row.credit_settled_date && (
                          <span>Regle le: {formatDateDDMMYYYY(row.credit_settled_date)}</span>
                        )}
                        {row.note && <span>Note: {row.note}</span>}
                      </div>
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
