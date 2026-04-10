import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { DateInput } from "@mantine/dates";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { getDailySummary, type DailyPayment } from "@/api/summary";
import SupplierAvatar from "@/components/SupplierAvatar";
import StatusBadge from "@/components/StatusBadge";
import {
  formatAmount,
  formatDateDDMMYYYY,
  getOriginalCreditAmount,
  getRemainingAmount,
  groupPaymentsByCreditThread,
  inferEntryType,
  isOverdueOpenCredit,
} from "@/utils/paymentDisplay";
import { todayLocalDate } from "@/utils/localDate";
import "./Daily.css";

type Totals = {
  revenue: string;
  paid: string;
  credit: string;
  cash: string;
};

type BadgeStatus = ComponentProps<typeof StatusBadge>["status"];

type NormalizedDailyPayment = DailyPayment & {
  id: number;
  supplier_id: number;
  date: string;
  status: "PAID" | "CREDIT" | "CANCELLED";
};

function normalizeStatus(status: DailyPayment["status"]): "PAID" | "CREDIT" | "CANCELLED" {
  if (status === "CREDIT" || status === "CANCELLED") {
    return status;
  }

  return "PAID";
}

function getRowBadgeStatus(
  payment: NormalizedDailyPayment,
  options: { isRoot: boolean; isSettledChain: boolean }
): BadgeStatus {
  if (options.isRoot && options.isSettledChain && payment.status === "CREDIT") {
    return "CREDIT_SETTLED";
  }

  if (isOverdueOpenCredit(payment)) {
    return "OVERDUE";
  }

  const entryType = inferEntryType(payment);
  if (entryType === "CREDIT_OPEN") return "CREDIT_OPEN";
  if (entryType === "CREDIT_PARTIAL_PAYMENT") return "CREDIT_PARTIAL_PAYMENT";
  if (entryType === "CREDIT_SETTLED") return "CREDIT_SETTLED";
  return "DIRECT_PAID";
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
  const [loadError, setLoadError] = useState("");

  const asOfDate = todayLocalDate();

  const fetchDaily = useCallback(() => getDailySummary(date, asOfDate), [asOfDate, date]);

  const dailyData = useDateAwareCachedData({
    isOnline,
    dateKey: `daily_${date}_asof_${asOfDate}`,
    fetchData: fetchDaily,
  });

  const visiblePayments = useMemo<NormalizedDailyPayment[]>(() => {
    const rowsWithIds = payments.map((payment, index) => ({
      ...payment,
      id: payment.id ?? -1 * (index + 1),
      supplier: payment.supplier || "Inconnu",
      supplier_id: payment.supplier_id ?? 0,
      date: payment.date ?? date,
      status: normalizeStatus(payment.status),
    }));

    return rowsWithIds.filter((payment) => payment.status !== "CANCELLED");
  }, [date, payments]);

  const threadedPayments = useMemo(
    () => groupPaymentsByCreditThread(visiblePayments),
    [visiblePayments]
  );

  const entryCount = visiblePayments.length;
  const paidTransactionCount = visiblePayments.filter((payment) => payment.status === "PAID").length;
  const creditTransactionCount = visiblePayments.filter(
    (payment) => payment.status === "CREDIT"
  ).length;
  const hasRows = threadedPayments.length > 0;

  const onDateChange = (value: string | null) => {
    if (value) {
      setDate(value);
    }
  };

  useEffect(() => {
    if (dailyData.data) {
      setTotals({
        revenue: formatAmount(dailyData.data.revenue),
        paid: formatAmount(dailyData.data.paid),
        credit: formatAmount(dailyData.data.credit),
        cash: formatAmount(dailyData.data.cash_remaining),
      });
      setPayments(dailyData.data.payments);
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
      setLoadError(dailyData.error.message);
    }
  }, [dailyData.data, dailyData.error]);

  return (
    <section className="daily-page">
      
      <div className="daily-top-shell">
        <div className="daily-date-control">
          <DateInput
            label="Date"
            aria-label="Date du journalier"
            value={date}
            onChange={onDateChange}
            valueFormat="DD-MM-YYYY"
            clearable={false}
            placeholder="DD-MM-YYYY"
          />
        </div>

        {!loadError && (
          <div className="daily-kpi-grid">
            <div className="daily-kpi-card revenue-card">
              <span className="kpi-label">RECETTES</span>
              <strong className="kpi-amount">{totals.revenue}</strong>
            </div>

            <div className="daily-kpi-card paid-card">
              <span className="kpi-label">{"PAY\u00c9"}</span>
              <strong className="kpi-amount">{totals.paid}</strong>
              <small className="kpi-sub">{paidTransactionCount} transaction(s)</small>
            </div>

            <div className="daily-kpi-card credit-card">
              <span className="kpi-label">{"CR\u00c9DIT OUVERT"}</span>
              <strong className="kpi-amount">{totals.credit}</strong>
              <small className="kpi-sub">{creditTransactionCount} transaction(s)</small>
            </div>

            <div className="daily-kpi-card cash-card">
              <span className="kpi-label">CASH RESTANT</span>
              <strong className="kpi-amount">{totals.cash}</strong>
              <small className="kpi-sub">Fin de {"journ\u00e9e"}</small>
            </div>
          </div>
        )}
      </div>

      {loadError && (
        <div className="state-error" role="alert">
          Erreur: {loadError}
        </div>
      )}

      <div className="daily-card">
        <div className="daily-section-title">
          <h2>Transactions</h2>
          <span className="daily-section-meta">{threadedPayments.length} groupe(s)</span>
        </div>

        {dailyData.isLoading && !hasRows && (
          <div className="state-empty" role="status">
            Chargement...
          </div>
        )}

        {!dailyData.isLoading && !hasRows && !loadError && (
          <div className="state-empty" role="status">
            Aucune transaction pour cette date
          </div>
        )}

        {hasRows && (
          <div className="daily-payments-list">
            {threadedPayments.map((thread) => {
              const isChain = thread.creditRootId !== null;
              const isCrossDateChain = isChain && !thread.hasRoot;
              const headerSource = thread.root ?? thread.items[0] ?? null;
              const originalCreditAmount = headerSource
                ? getOriginalCreditAmount(headerSource)
                : null;

              const chainContextParts: string[] = [];
              if (headerSource?.supplier) {
                chainContextParts.push(headerSource.supplier);
              }
              if (headerSource?.credit_opened_date) {
                chainContextParts.push(
                  `Ouvert le ${formatDateDDMMYYYY(headerSource.credit_opened_date)}`
                );
              }
              if (originalCreditAmount !== null) {
                chainContextParts.push(`Original: ${formatAmount(originalCreditAmount)}`);
              }

              return (
                <div
                  className={`daily-payment-thread ${
                    thread.isSettled ? "settled-chain" : "unsettled-chain"
                  }`}
                  key={thread.key}
                >
                  {isChain && (
                    <div className={`daily-thread-header ${thread.isSettled ? "settled" : "unsettled"}`}>
                      <div className="daily-thread-header-line">
                        <span className="daily-thread-title">
                          {`Cha\u00eene cr\u00e9dit #${thread.creditRootId}`}
                        </span>
                        {thread.isSettled && <StatusBadge status="CREDIT_SETTLED" />}
                      </div>
                      {isCrossDateChain && chainContextParts.length > 0 && (
                        <div className="daily-thread-context">{chainContextParts.join(" \u00b7 ")}</div>
                      )}
                    </div>
                  )}

                  {thread.items.map((payment) => {
                    const isRoot = Boolean(thread.hasRoot && thread.root?.id === payment.id);
                    const remainingAmount = getRemainingAmount(payment);
                    const statusBadge = getRowBadgeStatus(payment, {
                      isRoot,
                      isSettledChain: thread.isSettled,
                    });
                    const referenceId = thread.creditRootId ?? payment.id;

                    const detailParts = [
                      formatDateDDMMYYYY(payment.date),
                      `Ref #${referenceId}`,
                      remainingAmount !== null ? `Restant ${formatAmount(remainingAmount)}` : null,
                    ].filter(Boolean) as string[];

                    return (
                      <div
                        key={payment.id}
                        className={`daily-payment-item ${
                          payment.status === "PAID" ? "paid-row" : "credit-row"
                        }`}
                      >
                        <div className="daily-payment-avatar" title={payment.supplier}>
                          <SupplierAvatar name={payment.supplier} size={36} />
                        </div>

                        <div className="daily-payment-main">
                          <div className="daily-payment-headline">
                            <div className="daily-supplier-inline">
                              <strong>{payment.supplier}</strong>
                              <StatusBadge status={statusBadge} />
                            </div>
                          </div>
                          <div className="daily-payment-details">{detailParts.join(" \u00b7 ")}</div>
                        </div>

                        <span className="daily-amount">{formatAmount(payment.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
