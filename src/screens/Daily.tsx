import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { getDailySummary } from "@/api/summary";
import "./Daily.css";

type Payment = {
  supplier: string;
  amount: number;
  status: string;
  note: string;
};

type Totals = {
  revenue: string;
  paid: string;
  credit: string;
  cash: string;
};

export default function DailySummary() {
  const isOnline = useOnline();

  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [totals, setTotals] = useState<Totals>({
    revenue: "0.00",
    paid: "0.00",
    credit: "0.00",
    cash: "0.00",
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadError, setLoadError] = useState<string>("");

  /* ─────────────────────────────
     Data loading with date-aware caching
  ───────────────────────────── */
  // Memoize fetchData to prevent infinite loops
  const fetchDaily = useCallback(
    () => getDailySummary(date),
    [date]
  );

  const dailyData = useDateAwareCachedData({
    isOnline,
    dateKey: date,
    fetchData: fetchDaily,
  });

  useEffect(() => {
    if (dailyData.data) {
      setTotals({
        revenue: formatAmount(dailyData.data.revenue),
        paid: formatAmount(dailyData.data.paid),
        credit: formatAmount(dailyData.data.credit),
        cash: formatAmount(dailyData.data.cash_remaining),
      });
      setPayments(dailyData.data.payments || []);
      setLoadError("");
    } else if (dailyData.error) {
      setTotals({
        revenue: "0.00",
        paid: "0.00",
        credit: "0.00",
        cash: "0.00",
      });
      setPayments([]);
      setLoadError(dailyData.error.message);
    }
  }, [dailyData.data, dailyData.error]);

  return (
    <section className="daily-page">

      {/* ───────────────── Top Bar ───────────────── */}
      <div className="top-bar">
        <div className="date-control">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {loadError ? (
          <div style={{
            padding: "0.8rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.85rem"
          }}>
            ⚠️ {loadError}
          </div>
        ) : (
          <div className="totals-card">
            <div className="total revenue">
              <span>Recettes</span>
              <strong>{totals.revenue}</strong>
            </div>
            <div className="total paid">
              <span>Payé</span>
              <strong>{totals.paid}</strong>
            </div>
            <div className="total credit">
              <span>Crédit</span>
              <strong>{totals.credit}</strong>
            </div>
            <div className="total cash">
              <span>Cash restant</span>
              <strong>{totals.cash}</strong>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────── Payments List ───────────────── */}
      <div className="card">
        <h2>Transactions</h2>

        {dailyData.isLoading && !payments.length ? (
          <div className="empty-state">Chargement...</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">Aucun paiement</div>
        ) : (
          <div className="payments-list">
            {payments.map((p, i) => (
              <div
                key={i}
                className={`payment-item ${p.status.toLowerCase()}`}
              >
                <div className="payment-main">
                  <strong>{p.supplier}</strong>
                  <span className="amount">
                    {formatAmount(p.amount)}
                  </span>
                </div>

                <div className="payment-meta">
                  <span className="badge">
                    {formatStatus(p.status)}
                  </span>
                  {p.note && <span className="note">{p.note}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}

/* ─────────────────────────────
   Helpers
───────────────────────────── */
function formatAmount(value: number | string) {
  return Number(value).toFixed(2);
}

function formatStatus(status: string) {
  switch (status) {
    case "paid":
      return "Payé";
    case "credit":
      return "Crédit";
    default:
      return status;
  }
}
