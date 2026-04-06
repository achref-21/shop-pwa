import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import {
  getPeriodSummary,
  getSupplierBreakdown,
  type PeriodSummaryResponse,
  type SupplierBreakdownResponse,
  type SupplierSummary,
} from "@/api/summary";
import { formatAmount } from "@/utils/paymentDisplay";
import {
  monthIdentifier,
  monthRangeCalendar,
  todayLocalDate,
  weekIdentifier,
  weekRangeMondaySunday,
} from "@/utils/localDate";
import SupplierTransactionsModal from "@/components/SupplierTransactionsModal";
import CreditsLifecycleModal from "@/components/CreditsLifecycleModal";
import "./PeriodSummary.css";

export default function PeriodSummary() {
  const isOnline = useOnline();

  const [mode, setMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [date, setDate] = useState(todayLocalDate());
  const [summary, setSummary] = useState<PeriodSummaryResponse | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);

  const range = useMemo(
    () => (mode === "WEEK" ? weekRangeMondaySunday(date) : monthRangeCalendar(date)),
    [date, mode]
  );

  const periodKey = useMemo(() => {
    if (mode === "WEEK") {
      return `WEEK_${weekIdentifier(date)}`;
    }

    return `MONTH_${monthIdentifier(date)}`;
  }, [date, mode]);

  const fetchSummary = useCallback(
    () => getPeriodSummary(range.start, range.end, mode),
    [mode, range.end, range.start]
  );

  const fetchBreakdown = useCallback(
    () => getSupplierBreakdown(range.start, range.end, mode),
    [mode, range.end, range.start]
  );

  const summaryData = useDateAwareCachedData({
    isOnline,
    dateKey: `summary_${periodKey}`,
    fetchData: fetchSummary,
  });

  const breakdownData = useDateAwareCachedData({
    isOnline,
    dateKey: `breakdown_${periodKey}`,
    fetchData: fetchBreakdown,
  });

  useEffect(() => {
    if (summaryData.data) {
      setSummary(summaryData.data);
      setLoadError("");
      return;
    }

    if (summaryData.error) {
      setSummary(null);
      setLoadError(summaryData.error.message);
    }
  }, [summaryData.data, summaryData.error]);

  useEffect(() => {
    if (breakdownData.data) {
      const data = breakdownData.data as SupplierBreakdownResponse;
      setSuppliers(data.suppliers);
      return;
    }

    if (breakdownData.error) {
      setSuppliers([]);
    }
  }, [breakdownData.data, breakdownData.error]);

  const totals = useMemo(() => {
    const amount = suppliers.reduce((sum, supplier) => sum + supplier.total_amount, 0);
    const paidFromSuppliers = suppliers.reduce((sum, supplier) => sum + supplier.total_paid, 0);
    const creditFromSuppliers = suppliers.reduce((sum, supplier) => sum + supplier.total_credit, 0);

    return {
      amount,
      paid: summary?.paid ?? paidFromSuppliers,
      credit: summary?.credit ?? creditFromSuppliers,
    };
  }, [summary, suppliers]);

  return (
    <section className="period-summary-page">
      <div className="top-bar">
        <div className="controls-section">
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <label>
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "WEEK" | "MONTH")}
            >
              <option value="WEEK">Hebdomadaire</option>
              <option value="MONTH">Mensuelle</option>
            </select>
          </label>
        </div>

        {loadError && <div className="period-error">Erreur: {loadError}</div>}

        {!loadError && summary && (
          <div className="totals-card">
            <div className="total revenue">
              <span>Recettes</span>
              <strong>{formatAmount(summary.revenue)}</strong>
            </div>
            <div className="total paid">
              <span>Paye</span>
              <strong>{formatAmount(summary.paid)}</strong>
            </div>
            <div className="total credit">
              <span>Credit restant fin periode</span>
              <strong>{formatAmount(summary.credit)}</strong>
            </div>
            <div className="total net">
              <span>Cash net</span>
              <strong>{formatAmount(summary.net_cash)}</strong>
            </div>
          </div>
        )}
      </div>

      {summary && (
        <div className="card period-meta-card">
          <div className="period-meta-list">
            <p className="period-meta-line">
              Periode backend: <strong>{summary.period_start}</strong> {"->"}{" "}
              <strong>{summary.period_end}</strong>
            </p>
            <p className="period-meta-line">
              Base d&apos;aggregation: <strong>{summary.aggregation_basis}</strong>
            </p>
          </div>
          <button className="secondary lifecycle-trigger" onClick={() => setIsLifecycleOpen(true)}>
            Voir cycle des credits
          </button>
        </div>
      )}

      {summary && (
        <div className="card credit-metrics-card">
          <h2>Mouvement des credits</h2>

          <div className="credit-metrics-grid">
            <div className="credit-metric-item">
              <span>Credit ouvert dans la periode</span>
              <strong>{formatAmount(summary.credit_opened_in_period)}</strong>
            </div>

            <div className="credit-metric-item">
              <span>Credit paye dans la periode (credits ouverts dans la periode)</span>
              <strong>{formatAmount(summary.credit_paid_in_period_for_period_opens)}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Detail par fournisseur</h2>

        {breakdownData.isLoading && suppliers.length === 0 ? (
          <div className="empty-state">Chargement...</div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">Aucune donnee fournisseur pour cette periode.</div>
        ) : (
          <div className="suppliers-list">
            {suppliers.map((supplier) => (
              <div
                key={supplier.supplier_id}
                className="supplier-summary-item"
                onClick={() => setSelectedSupplier(supplier)}
              >
                <div className="supplier-name">
                  <strong>{supplier.supplier}</strong>
                </div>

                <div className="supplier-amounts">
                  <div className="amount-cell">
                    <span className="amount-label">Total</span>
                    <span className="amount-value">{formatAmount(supplier.total_amount)}</span>
                  </div>

                  <div className="amount-cell">
                    <span className="amount-label">Paye</span>
                    <span className="amount-value">{formatAmount(supplier.total_paid)}</span>
                  </div>

                  <div className="amount-cell">
                    <span className="amount-label">Credit</span>
                    <span className="amount-value">{formatAmount(supplier.total_credit)}</span>
                  </div>
                </div>
              </div>
            ))}

            {(summary || suppliers.length > 0) && (
              <div className="supplier-summary-item grand-total static-row">
                <div className="supplier-name">
                  <strong>TOTAL</strong>
                </div>

                <div className="supplier-amounts">
                  <div className="amount-cell">
                    <span className="amount-label">Total</span>
                    <span className="amount-value">{formatAmount(totals.amount)}</span>
                  </div>

                  <div className="amount-cell">
                    <span className="amount-label">Paye</span>
                    <span className="amount-value">{formatAmount(totals.paid)}</span>
                  </div>

                  <div className="amount-cell">
                    <span className="amount-label">Credit</span>
                    <span className="amount-value">{formatAmount(totals.credit)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSupplier && (
        <SupplierTransactionsModal
          supplier={selectedSupplier}
          start={range.start}
          end={range.end}
          onClose={() => setSelectedSupplier(null)}
        />
      )}

      {isLifecycleOpen && (
        <CreditsLifecycleModal
          startDate={range.start}
          endDate={range.end}
          mode={mode}
          onClose={() => setIsLifecycleOpen(false)}
        />
      )}
    </section>
  );
}
