import { SegmentedControl } from "@mantine/core";
import { DateInput } from "@mantine/dates";
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
  addDays,
  formatLocalDate,
  monthRangeCalendar,
  parseLocalDate,
  todayLocalDate,
  weekRangeMondaySunday,
} from "@/utils/localDate";
import SupplierTransactionsModal from "@/components/SupplierTransactionsModal";
import CreditsLifecycleModal from "@/components/CreditsLifecycleModal";
import "./PeriodSummary.css";

type SummaryMode = "WEEK" | "MONTH";

function getRangeForMode(mode: SummaryMode, anchorDate: string) {
  if (mode === "WEEK") {
    return weekRangeMondaySunday(anchorDate);
  }

  return monthRangeCalendar(anchorDate);
}

function shiftRangeByMode(mode: SummaryMode, startDate: string, direction: -1 | 1) {
  const parsedStartDate = parseLocalDate(startDate);

  if (mode === "WEEK") {
    const shiftedAnchor = formatLocalDate(addDays(parsedStartDate, direction * 7));
    return weekRangeMondaySunday(shiftedAnchor);
  }

  const shiftedMonthStart = new Date(
    parsedStartDate.getFullYear(),
    parsedStartDate.getMonth() + direction,
    1
  );
  return monthRangeCalendar(formatLocalDate(shiftedMonthStart));
}

function formatPeriodChip(startDate: string, endDate: string): string {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const dayMonth = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  });
  const dayMonthYear = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (start.getFullYear() === end.getFullYear()) {
    return `${dayMonth.format(start)} -> ${dayMonthYear.format(end)}`;
  }

  return `${dayMonthYear.format(start)} -> ${dayMonthYear.format(end)}`;
}

export default function PeriodSummary() {
  const isOnline = useOnline();

  const [mode, setMode] = useState<SummaryMode>("WEEK");
  const [startDate, setStartDate] = useState(() => getRangeForMode("WEEK", todayLocalDate()).start);
  const [endDate, setEndDate] = useState(() => getRangeForMode("WEEK", todayLocalDate()).end);
  const [summary, setSummary] = useState<PeriodSummaryResponse | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);

  const range = useMemo(() => ({ start: startDate, end: endDate }), [endDate, startDate]);

  const periodKey = useMemo(() => `${mode}_${range.start}_${range.end}`, [mode, range.end, range.start]);
  const periodChip = useMemo(() => formatPeriodChip(range.start, range.end), [range.end, range.start]);

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

  function handleModeChange(value: string) {
    const nextMode = value as SummaryMode;
    setMode(nextMode);

    const nextRange = getRangeForMode(nextMode, todayLocalDate());
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  }

  function handlePeriodShift(direction: -1 | 1) {
    const nextRange = shiftRangeByMode(mode, startDate, direction);
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  }

  return (
    <section className="period-summary-page">
      <div className="card controls-card">
        <div className="section-title">
          <h2>Synthese de periode</h2>
          <span className="section-meta">{periodChip}</span>
        </div>

        <div className="period-selector">
          <SegmentedControl
            className="mode-segmented"
            value={mode}
            onChange={handleModeChange}
            data={[
              { label: "Hebdomadaire", value: "WEEK" },
              { label: "Mensuelle", value: "MONTH" },
            ]}
            fullWidth
          />

          <div className="period-navigation-row">
            <button
              type="button"
              className="period-nav-button"
              aria-label="Periode precedente"
              onClick={() => handlePeriodShift(-1)}
            >
              {"<"}
            </button>
            <DateInput
              label="Debut"
              placeholder="JJ-MM-AAAA"
              value={startDate}
              onChange={(value) => setStartDate(value ?? startDate)}
              valueFormat="DD-MM-YYYY"
            />
            <DateInput
              label="Fin"
              placeholder="JJ-MM-AAAA"
              value={endDate}
              onChange={(value) => setEndDate(value ?? endDate)}
              valueFormat="DD-MM-YYYY"
            />
            <button
              type="button"
              className="period-nav-button"
              aria-label="Periode suivante"
              onClick={() => handlePeriodShift(1)}
            >
              {">"}
            </button>
          </div>
        </div>
      </div>

      {loadError && <div className="period-error">Erreur: {loadError}</div>}

      {!loadError && summary && (
        <div className="totals-grid">
          <div className="kpi-card kpi-revenue">
            <span className="kpi-label">Revenus</span>
            <strong className="kpi-amount">{formatAmount(summary.revenue)}</strong>
          </div>

          <div className="kpi-card kpi-expenses">
            <span className="kpi-label">Depenses</span>
            <strong className="kpi-amount">{formatAmount(summary.paid)}</strong>
          </div>

          <div className="kpi-card kpi-debt">
            <span className="kpi-label">Dettes en cours</span>
            <strong className="kpi-amount">{formatAmount(summary.credit)}</strong>
            <small className="kpi-sub">sur credits ouverts dans la periode</small>
          </div>

          <div className={`kpi-card kpi-net ${summary.net_cash < 0 ? "negative" : "positive"}`}>
            <span className="kpi-label">Solde net</span>
            <strong className="kpi-amount">{formatAmount(summary.net_cash)}</strong>
          </div>
        </div>
      )}

      {summary && (
        <div className="card credit-metrics-card">
          <div className="section-title">
            <h2>Mouvement des credits</h2>
            <button
              className="link-ghost lifecycle-trigger"
              type="button"
              onClick={() => setIsLifecycleOpen(true)}
            >
              Voir cycle des credits
            </button>
          </div>

          <div className="credit-metrics-grid">
            <div className="credit-metric-item">
              <span className="metric-label">Credits ouverts</span>
              <strong className="metric-value">{formatAmount(summary.credit_opened_in_period)}</strong>
            </div>

            <div className="credit-metric-item">
              <span className="metric-label">Rembourse</span>
              <strong className="metric-value">
                {formatAmount(summary.credit_paid_in_period_for_period_opens)}
              </strong>
              <small className="metric-sub">sur credits de la periode</small>
            </div>
          </div>
        </div>
      )}

      <div className="card suppliers-card">
        <h2>Detail par fournisseur</h2>

        {breakdownData.isLoading && suppliers.length === 0 ? (
          <div className="empty-state">Chargement...</div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state">Aucune donnee fournisseur pour cette periode.</div>
        ) : (
          <div className="suppliers-list">
            <div className="supplier-summary-header">
              <span className="supplier-name">Fournisseur</span>
              <span className="amount-label">Total</span>
              <span className="amount-label">Paye</span>
              <span className="amount-label">Credit</span>
              <span className="chevron-placeholder" aria-hidden="true" />
            </div>

            {suppliers.map((supplier) => (
              <button
                type="button"
                key={supplier.supplier_id}
                className="supplier-summary-item"
                onClick={() => setSelectedSupplier(supplier)}
              >
                <div className="supplier-name">
                  <strong>{supplier.supplier}</strong>
                </div>
                <span className="amount-value">{formatAmount(supplier.total_amount)}</span>
                <span className="amount-value">{formatAmount(supplier.total_paid)}</span>
                <span className="amount-value">{formatAmount(supplier.total_credit)}</span>
                <span className="supplier-chevron" aria-hidden="true">
                  {"\u203A"}
                </span>
              </button>
            ))}

            {(summary || suppliers.length > 0) && (
              <div className="supplier-summary-item grand-total static-row">
                <div className="supplier-name">
                  <strong>TOTAL</strong>
                </div>
                <span className="amount-value">{formatAmount(totals.amount)}</span>
                <span className="amount-value">{formatAmount(totals.paid)}</span>
                <span className="amount-value">{formatAmount(totals.credit)}</span>
                <span className="chevron-placeholder" aria-hidden="true" />
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
