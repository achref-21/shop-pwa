import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import {
  getPeriodSummary,
  getSupplierBreakdown,
} from "@/api/summary";
import type { SupplierSummary } from "@/api/summary";
import SupplierTransactionsModal from "@/components/SupplierTransactionsModal";
import "./PeriodSummary.css";

/* ─────────────────────────────
   Helpers
───────────────────────────── */

function getWeekRange(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  if (day !== 1) d.setHours(-24 * (day - 1));
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function getMonthRange(dateStr: string) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/* ─────────────────────────────
   Component
───────────────────────────── */

export default function PeriodSummary() {
  const isOnline = useOnline();

  const [mode, setMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [summary, setSummary] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loadError, setLoadError] = useState<string>("");

  const [selectedSupplier, setSelectedSupplier] =
    useState<SupplierSummary | null>(null);

  /* ─────────────────────────────
     Range calculation
  ───────────────────────────── */

  const range = useMemo(() => {
    return mode === "WEEK"
      ? getWeekRange(date)
      : getMonthRange(date);
  }, [mode, date]);

  // Create a stable date key that represents the period
  // This ensures stale data is cleared when mode or period changes
  const dateKey = useMemo(() => {
    if (mode === "WEEK") {
      const d = new Date(date);
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 4);
      const jan4 = target.valueOf();
      const msPerWeek = 604800000;
      const weekNum = Math.round((firstThursday - jan4) / msPerWeek) + 1;
      const year = d.getFullYear();
      return `WEEK_${year}_W${String(weekNum).padStart(2, "0")}`;
    } else {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `MONTH_${year}_M${month}`;
    }
  }, [date, mode]);

  /* ─────────────────────────────
     Data loading with date-aware caching
  ───────────────────────────── */

  // Memoize fetchData functions to prevent infinite loops
  const fetchSummary = useCallback(
    () => getPeriodSummary(range.start, range.end, mode),
    [range.start, range.end, mode]
  );

  const fetchBreakdown = useCallback(
    () => getSupplierBreakdown(range.start, range.end, mode),
    [range.start, range.end, mode]
  );

  const summaryData = useDateAwareCachedData({
    isOnline,
    dateKey,
    fetchData: fetchSummary,
  });

  const breakdownData = useDateAwareCachedData({
    isOnline,
    dateKey,
    fetchData: fetchBreakdown,
  });

  // Update UI when summary data changes
  useEffect(() => {
    if (summaryData.data) {
      setSummary(summaryData.data);
      setLoadError("");
    } else if (summaryData.error) {
      setSummary(null);
      setLoadError(summaryData.error.message);
    }
  }, [summaryData.data, summaryData.error]);

  // Update UI when breakdown data changes
  useEffect(() => {
    if (breakdownData.data) {
      setSuppliers(breakdownData.data.suppliers);
    } else if (breakdownData.error) {
      setSuppliers([]);
    }
  }, [breakdownData.data, breakdownData.error]);

  /* ─────────────────────────────
     Sorting
  ───────────────────────────── */

 /* function sortBy(column: keyof SupplierSummary) {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }

    const sorted = [...suppliers].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      if (column === "supplier") {
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }

      return sortAsc
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });

    setSuppliers(sorted);
  }*/

  const totals = useMemo(() => ({
    amount: suppliers.reduce((a, b) => a + b.total_amount, 0),
    paid: suppliers.reduce((a, b) => a + b.total_paid, 0),
    credit: suppliers.reduce((a, b) => a + b.total_credit, 0),
  }), [suppliers]);

  /* ─────────────────────────────
     Render
  ───────────────────────────── */

  return (
    <section className="period-summary-page">

      {/* ───────────────── Top Bar ───────────────── */}
      <div className="top-bar">
        <div className="controls-section">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <select
            value={mode}
            onChange={e =>
              setMode(e.target.value as "WEEK" | "MONTH")
            }
          >
            <option value="WEEK">Hebdomadaire</option>
            <option value="MONTH">Mensuelle</option>
          </select>
        </div>

        {loadError && (
          <div style={{
            padding: "0.8rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.85rem",
            marginTop: "0.5rem"
          }}>
            ⚠️ {loadError}
          </div>
        )}

        {!loadError && summary && (
          <div className="totals-card">
            <div className="total revenue">
              <span>Recettes</span>
              <strong>{summary.revenue.toFixed(2)}</strong>
            </div>
            <div className="total paid">
              <span>Payé</span>
              <strong>{summary.paid.toFixed(2)}</strong>
            </div>
            <div className="total credit">
              <span>Crédit</span>
              <strong>{summary.credit.toFixed(2)}</strong>
            </div>
            <div className="total net">
              <span>Cash net</span>
              <strong>{summary.net_cash.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────── Period Info Card ───────────────── */}
      {summary && (
        <div className="card">
          <p className="period-range">
            Période : <strong>{range.start}</strong> → <strong>{range.end}</strong>
          </p>
        </div>
      )}

      {/* ───────────────── Supplier Breakdown ───────────────── */}
      <div className="card">
        <h2>Détail par fournisseur</h2>

        <div className="suppliers-list">
          {suppliers.map((s) => (
            <div
              key={s.supplier}
              className="supplier-summary-item"
              onClick={() => setSelectedSupplier(s)}
            >
              <div className="supplier-name">
                <strong>{s.supplier}</strong>
              </div>

              <div className="supplier-amounts">
                <span className="amount-label">Total</span>
                <span className="amount-value">{s.total_amount.toFixed(2)}</span>

                <span className="amount-label">Payé</span>
                <span className="amount-value">{s.total_paid.toFixed(2)}</span>

                <span className="amount-label">Crédit</span>
                <span className="amount-value">{s.total_credit.toFixed(2)}</span>
              </div>
            </div>
          ))}

          {/* Grand Total */}
          {summary && (
            <div className="supplier-summary-item grand-total">
              <div className="supplier-name">
                <strong>TOTAL</strong>
              </div>

              <div className="supplier-amounts">
                <span className="amount-label">Total</span>
                <span className="amount-value">{totals.amount.toFixed(2)}</span>

                <span className="amount-label">Payé</span>
                <span className="amount-value">{totals.paid.toFixed(2)}</span>

                <span className="amount-label">Crédit</span>
                <span className="amount-value">{totals.credit.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────── Supplier Transactions Modal ───────────────── */}
      {selectedSupplier && (
        <SupplierTransactionsModal
          supplier={selectedSupplier}
          start={range.start}
          end={range.end}
          onClose={() => setSelectedSupplier(null)}
        />
      )}

    </section>
  );
}
