import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { apiFetch } from "@/api/client";
import "./SupplierTransactionsModal.css";
import type { SupplierSummary } from "@/api/summary";

type Props = {
  supplier: SupplierSummary;
  start: string;
  end: string;
  onClose: () => void;
};

type Transaction = {
  date: string;
  amount: number;
  status: string;
  expected_payment_date?: string;
  note?: string;
};

export default function SupplierTransactionsModal({
  supplier,
  start,
  end,
  onClose,
}: Props) {
  const isOnline = useOnline();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loadError, setLoadError] = useState<string>("");

  const dateKey = `supplier_trans_${supplier.supplier_id}_${start}_${end}`;

  // Memoize fetchData to prevent infinite loops
  const fetchTransactions = useCallback(
    () =>
      apiFetch<Transaction[]>(
        `/suppliers/${supplier.supplier_id}/transactions?start_date=${start}&end_date=${end}`
      ),
    [supplier.supplier_id, start, end]
  );

  const transactionData = useDateAwareCachedData({
    isOnline,
    dateKey,
    fetchData: fetchTransactions,
  });


  useEffect(() => {
    if (transactionData.data) {
      setRows(transactionData.data);
      setLoadError("");
    } else if (transactionData.error) {
      setRows([]);
      setLoadError(transactionData.error.message);
    }
  }, [transactionData.data, transactionData.error]);

  return (
    <div className="modal-backdrop">
      <div className="modal large">
        <h2>
          {supplier.supplier} — {start} → {end}
        </h2>

        {loadError && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.9rem"
          }}>
            ⚠️ {loadError}
          </div>
        )}

        {!loadError && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date prévue</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>{r.amount.toFixed(2)}</td>
                <td>{r.status}</td>
                <td>{r.expected_payment_date || ""}</td>
                <td>{r.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

        <button className="secondary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
