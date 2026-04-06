import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import {
  getDailySummary,
  type CreditLifecycleStatus,
  type DailyCreditLifecycleItem,
  type DailyPayment,
} from "@/api/summary";
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
import { todayLocalDate } from "@/utils/localDate";
import "./Daily.css";

type Totals = {
  revenue: string;
  paid: string;
  credit: string;
  cash: string;
};

const LIFECYCLE_STATUS_LABELS: Record<CreditLifecycleStatus, string> = {
  OPEN: "Ouvert",
  SETTLED: "Regle",
  OVERDUE: "En retard",
  DUE_SOON: "Echeance proche",
};

function dueInDaysLabel(value: number | null): string {
  if (value === null) {
    return "Sans echeance";
  }

  if (value > 0) {
    return `Dans ${value} j`;
  }

  if (value === 0) {
    return "Echeance aujourd'hui";
  }

  return `${Math.abs(value)} j de retard`;
}

export default function DailySummary() {
  const isOnline = useOnline();

  const [date, setDate] = useState(todayLocalDate());
  const [totals, setTotals] = useState<Totals>({
    revenue: "0.00",
    paid: "0.00",
    credit: "0.00",
    cash: "0.00",
  });
  const [payments, setPayments] = useState<DailyPayment[]>([]);
  const [lifecycleRows, setLifecycleRows] = useState<DailyCreditLifecycleItem[]>([]);
  const [aggregationBasis, setAggregationBasis] = useState("date");
  const [backendDate, setBackendDate] = useState("");
  const [loadError, setLoadError] = useState("");

  const asOfDate = todayLocalDate();

  const fetchDaily = useCallback(() => getDailySummary(date, asOfDate), [asOfDate, date]);

  const dailyData = useDateAwareCachedData({
    isOnline,
    dateKey: `daily_${date}_asof_${asOfDate}`,
    fetchData: fetchDaily,
  });

  const threadedPayments = useMemo(() => {
    const rowsWithIds = payments.map((payment, index) => ({
      ...payment,
      id: payment.id ?? -1 * (index + 1),
      supplier_id: payment.supplier_id ?? 0,
      date: payment.date ?? date,
      status: payment.status === "PAID" || payment.status === "CREDIT" ? payment.status : "PAID",
    }));

    return groupPaymentsByCreditThread(rowsWithIds);
  }, [date, payments]);

  useEffect(() => {
    if (dailyData.data) {
      setTotals({
        revenue: formatAmount(dailyData.data.revenue),
        paid: formatAmount(dailyData.data.paid),
        credit: formatAmount(dailyData.data.credit),
        cash: formatAmount(dailyData.data.cash_remaining),
      });
      setPayments(dailyData.data.payments);
      setLifecycleRows(dailyData.data.credit_lifecycle);
      setAggregationBasis(dailyData.data.aggregation_basis || "date");
      setBackendDate(dailyData.data.date || date);
      setLoadError("");
      return;
    }

    if (dailyData.error) {
      setTotals({
        revenue: "0.00",
        paid: "0.00",
        credit: "0.00",
        cash: "0.00",
      });
      setPayments([]);
      setLifecycleRows([]);
      setAggregationBasis("date");
      setBackendDate("");
      setLoadError(dailyData.error.message);
    }
  }, [dailyData.data, dailyData.error, date]);

  return (
    <section className="daily-page">
      <div className="top-bar">
        <div className="date-control">
          <label>Date</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>

        {loadError ? (
          <div className="daily-error">Erreur: {loadError}</div>
        ) : (
          <div className="totals-card">
            <div className="total revenue">
              <span>Recettes</span>
              <strong>{totals.revenue}</strong>
            </div>
            <div className="total paid">
              <span>Paye</span>
              <strong>{totals.paid}</strong>
            </div>
            <div className="total credit">
              <span>Credit ouvert</span>
              <strong>{totals.credit}</strong>
            </div>
            <div className="total cash">
              <span>Cash restant</span>
              <strong>{totals.cash}</strong>
            </div>
          </div>
        )}
      </div>

      {!loadError && backendDate && (
        <div className="card daily-meta-card">
          <p>
            Date backend: <strong>{backendDate}</strong>
          </p>
          <p>
            Base d&apos;aggregation: <strong>{aggregationBasis}</strong>
          </p>
          <p>
            Statuts calcules au: <strong>{asOfDate}</strong>
          </p>
        </div>
      )}

      <div className="card">
        <h2>Transactions</h2>

        {dailyData.isLoading && !payments.length ? (
          <div className="empty-state">Chargement...</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">Aucun paiement</div>
        ) : (
          <div className="payments-list">
            {threadedPayments.map((thread) => (
              <div key={thread.key} className="payment-thread">
                {thread.creditRootId && (
                  <div className="thread-header">Chaine credit #{thread.creditRootId}</div>
                )}

                {thread.items.map((payment) => {
                  const expectedDate = getCreditExpectedDate(payment);
                  const originalAmount = getOriginalCreditAmount(payment);
                  const remainingAmount = getRemainingAmount(payment);

                  return (
                    <div
                      key={payment.id}
                      className={`payment-item ${payment.status.toLowerCase()} ${
                        thread.creditRootId && thread.root?.id !== payment.id ? "child-row" : ""
                      }`}
                    >
                      <div className="payment-main">
                        <strong>{payment.supplier}</strong>
                        <span className="amount">{formatAmount(payment.amount)}</span>
                      </div>

                      <div className="payment-meta">
                        <span className={`badge entry-badge ${getEntryTypeClassName(payment)}`}>
                          <span className="entry-icon">{getEntryTypeIcon(payment)}</span>
                          {getEntryTypeLabel(payment)}
                        </span>
                        <span className="badge status-badge">{payment.status}</span>
                        <span>Date: {formatDateDDMMYYYY(payment.date)}</span>
                        {thread.creditRootId && <span>Reference: #{thread.creditRootId}</span>}
                        {originalAmount !== null && (
                          <span>Original: {formatAmount(originalAmount)}</span>
                        )}
                        {remainingAmount !== null && (
                          <span>Restant: {formatAmount(remainingAmount)}</span>
                        )}
                        {payment.credit_opened_date && (
                          <span>
                            Ouvert le: {formatDateDDMMYYYY(payment.credit_opened_date)}
                          </span>
                        )}
                        {expectedDate && (
                          <span>Prevu le (contexte): {formatDateDDMMYYYY(expectedDate)}</span>
                        )}
                        {payment.credit_settled_date && (
                          <span>
                            Regle le: {formatDateDDMMYYYY(payment.credit_settled_date)}
                          </span>
                        )}
                        {payment.note && <span>Note: {payment.note}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Cycle de vie des credits (statuts calcules a aujourd&apos;hui)</h2>

        {dailyData.isLoading && lifecycleRows.length === 0 ? (
          <div className="empty-state">Chargement...</div>
        ) : lifecycleRows.length === 0 ? (
          <div className="empty-state">Aucun credit sur cette date.</div>
        ) : (
          <div className="daily-lifecycle-list">
            {lifecycleRows.map((item) => (
              <div className="daily-lifecycle-item" key={item.credit_payment_id}>
                <div className="daily-lifecycle-head">
                  <strong>{item.supplier}</strong>
                  <span
                    className={`badge lifecycle-status ${item.status
                      .toLowerCase()
                      .replace("_", "-")}`}
                  >
                    {LIFECYCLE_STATUS_LABELS[item.status]}
                  </span>
                </div>

                <div className="daily-lifecycle-meta">
                  <span>Credit #{item.credit_payment_id}</span>
                  <span>Ouvert le: {formatDateDDMMYYYY(item.opened_on)}</span>
                  {item.expected_payment_date && (
                    <span>
                      Date prevue (contexte): {formatDateDDMMYYYY(item.expected_payment_date)}
                    </span>
                  )}
                  <span>Original: {formatAmount(item.original_credit_amount)}</span>
                  <span>Paye avant aujourd&apos;hui: {formatAmount(item.paid_before_today)}</span>
                  <span>Paye aujourd&apos;hui: {formatAmount(item.paid_today)}</span>
                  <span>Restant apres aujourd&apos;hui: {formatAmount(item.remaining_after_today)}</span>
                  <span>Delai: {dueInDaysLabel(item.due_in_days)}</span>
                  {item.credit_settled_date && (
                    <span>Regle le: {formatDateDDMMYYYY(item.credit_settled_date)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
