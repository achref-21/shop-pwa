import { useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDailyLimitGuard } from "@/hooks/useDailyLimitGuard";
import {
  isDateRangeWithinCache,
  partialCreditPayment,
  searchPayments,
  settleCredit,
  type Payment,
} from "@/api/payments";
import { getSuppliers, type Supplier } from "@/api/suppliers";
import DailyLimitCrossingModal from "@/components/DailyLimitCrossingModal";
import PartialPaymentModal from "@/components/PartialPaymentModal";
import SettleCreditModal from "@/components/SettleCreditModal";
import { todayLocalDate } from "@/utils/localDate";
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
  isOpenCreditRoot,
  isOverdueOpenCredit,
} from "@/utils/paymentDisplay";
import "./PaymentsSearch.css";

function formatStatus(status: string) {
  return status === "PAID" ? "Paye" : status === "CREDIT" ? "Credit" : status;
}

function parseStatus(display: string): "PAID" | "CREDIT" | undefined {
  if (display === "Paye") return "PAID";
  if (display === "Credit") return "CREDIT";
  return undefined;
}

export default function PaymentsSearch() {
  const isOnline = useOnline();
  const dailyLimitGuard = useDailyLimitGuard();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadError, setLoadError] = useState("");
  const [cacheWarning, setCacheWarning] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [partialTarget, setPartialTarget] = useState<Payment | null>(null);
  const [pendingSettleCredits, setPendingSettleCredits] = useState<Payment[] | null>(null);
  const [isSettlingCredits, setIsSettlingCredits] = useState(false);

  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [status, setStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [lastSearchedFilters, setLastSearchedFilters] = useState("");

  const currentFilterString = `${supplierId}_${status}_${startDate}_${endDate}_${overdueOnly}`;

  useEffect(() => {
    if (!isOnline && lastSearchedFilters && lastSearchedFilters !== currentFilterString) {
      setPayments([]);
      setLoadError("Les filtres ont change. Cliquez sur Rechercher pour actualiser.");
    }
  }, [currentFilterString, isOnline, lastSearchedFilters]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo(
    () => groupPaymentsByCreditThread(payments),
    [payments]
  );
  const canSettleSelection = useMemo(() => {
    if (!isOnline || selectedIds.length === 0) return false;
    const selectedPayments = payments.filter((payment) => selectedIds.includes(payment.id));
    return selectedPayments.length > 0 && selectedPayments.every(isOpenCreditRoot);
  }, [isOnline, payments, selectedIds]);

  async function handleSearch() {
    try {
      setLoadError("");
      setCacheWarning("");
      setActionError("");
      setActionSuccess("");

      if (!isOnline && !isDateRangeWithinCache(startDate, endDate)) {
        setCacheWarning(
          "Attention: hors ligne, seules les donnees des 90 derniers jours sont disponibles."
        );
      }

      const results = await searchPayments(
        {
          supplier_id: supplierId,
          status: parseStatus(status),
          start_expected_date: startDate || undefined,
          end_expected_date: endDate || undefined,
          overdue_only: overdueOnly,
        },
        isOnline
      );

      setPayments(results);
      setSelectedIds([]);
      setLastSearchedFilters(currentFilterString);
    } catch (error) {
      setPayments([]);
      setSelectedIds([]);
      setCacheWarning("");
      setLoadError(error instanceof Error ? error.message : "Erreur lors de la recherche");
    }
  }

  function toggleSelection(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  async function handleSettle() {
    if (!selectedIds.length || !isOnline) return;

    setActionError("");
    setActionSuccess("");
    dailyLimitGuard.clearAlreadyOverNotice();

    const selectedPayments = payments.filter((payment) => selectedIds.includes(payment.id));
    const validCredits = selectedPayments.filter(isOpenCreditRoot);
    const invalidSelections = selectedPayments.filter((payment) => !isOpenCreditRoot(payment));

    if (invalidSelections.length > 0) {
      setActionError(
        "La selection contient des lignes non regables. Choisissez uniquement des credits ouverts."
      );
      return;
    }

    if (!validCredits.length) return;
    setPendingSettleCredits(validCredits);
  }

  async function submitSettle(date: string) {
    if (!pendingSettleCredits || pendingSettleCredits.length === 0) return;

    const creditsToSettle = pendingSettleCredits;
    const totalAmount = creditsToSettle.reduce(
      (sum, payment) => sum + Number(getRemainingAmount(payment) ?? payment.amount),
      0
    );

    try {
      setIsSettlingCredits(true);
      const approvedForLimit = await dailyLimitGuard.requestApproval(totalAmount, date);
      if (!approvedForLimit) return;

      const confirmed = window.confirm(
        creditsToSettle.length === 1
          ? `Regler ce credit?\n\nFournisseur: ${creditsToSettle[0].supplier}\nMontant: ${formatAmount(
              getRemainingAmount(creditsToSettle[0]) ?? creditsToSettle[0].amount
            )}`
          : `Regler ${creditsToSettle.length} credits?\n\nMontant total: ${formatAmount(totalAmount)}`
      );
      if (!confirmed) {
        setPendingSettleCredits(null);
        return;
      }

      await Promise.all(
        creditsToSettle.map((payment) => settleCredit(payment.id, { settle_date: date }))
      );
      setPendingSettleCredits(null);
      await handleSearch();
      setSelectedIds([]);
      setActionSuccess(
        creditsToSettle.length === 1
          ? "Credit regle avec succes."
          : `${creditsToSettle.length} credits regles avec succes.`
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur lors du reglement.");
    } finally {
      setIsSettlingCredits(false);
    }
  }

  function resetFilters() {
    setSupplierId(undefined);
    setStatus("");
    setStartDate("");
    setEndDate("");
    setOverdueOnly(false);
    handleSearch();
  }

  return (
    <section className="payments-search-page">
      <div className="card">
        <div className="filters-header">
          <h2>Filtres</h2>
          <button
            className="collapse-button"
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            title={isFiltersCollapsed ? "Afficher les filtres" : "Masquer les filtres"}
          >
            {isFiltersCollapsed ? "v" : "^"}
          </button>
        </div>

        {!isFiltersCollapsed && (
          <div className="filters-grid">
            <div className="filter-field">
              <label>Fournisseur</label>
              <select
                value={supplierId ?? ""}
                onChange={(event) =>
                  setSupplierId(event.target.value ? Number(event.target.value) : undefined)
                }
              >
                <option value="">Tous</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Statut</label>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Tous</option>
                <option>Paye</option>
                <option>Credit</option>
              </select>
            </div>

            <div className="filter-field">
              <label>
                Dates prevues de paiement
                <br />
                <small>(credits ouverts)</small>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="filter-field">
              <label>
                Date fin
                <br />
                <small>(credits ouverts)</small>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="filter-field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(event) => setOverdueOnly(event.target.checked)}
                />
                <span>En retard seulement</span>
              </label>
            </div>
          </div>
        )}

        <div className="filter-actions">
          <button className="primary" onClick={handleSearch}>
            Rechercher
          </button>
          <button className="secondary" onClick={resetFilters}>
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Resultats ({payments.length})</h2>

        {cacheWarning && <div className="state-warning">{cacheWarning}</div>}
        {loadError && <div className="state-error">Erreur: {loadError}</div>}
        {actionError && <div className="state-error">Erreur: {actionError}</div>}
        {actionSuccess && <div className="state-success">{actionSuccess}</div>}
        {dailyLimitGuard.alreadyOverNotice && (
          <div className="state-warning">{dailyLimitGuard.alreadyOverNotice}</div>
        )}

        <div className="payments-list">
          {payments.length === 0 && !loadError ? (
            <div className="empty-state">Aucun resultat</div>
          ) : (
            threads.map((thread) => (
              <div className="payment-thread" key={thread.key}>
                {thread.creditRootId && (
                  <div className="thread-header">Chaine credit #{thread.creditRootId}</div>
                )}

                {thread.items.map((payment) => {
                  const isRoot = thread.root?.id === payment.id;
                  const expectedDateValue = getCreditExpectedDate(payment);
                  const isOpenRoot = isOpenCreditRoot(payment);
                  const originalAmount = getOriginalCreditAmount(payment);
                  const remainingAmount = getRemainingAmount(payment);

                  return (
                    <div
                      key={payment.id}
                      className={`payment-item ${payment.status.toLowerCase()} ${
                        thread.creditRootId && !isRoot ? "child-row" : ""
                      } ${isOverdueOpenCredit(payment) ? "overdue" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(payment.id)}
                        onChange={() => toggleSelection(payment.id)}
                      />

                      <div className="payment-main">
                        <div className="payment-info">
                          <strong>{payment.supplier}</strong>
                        </div>

                        <div className="payment-amount">{formatAmount(payment.amount)}</div>
                      </div>

                      <div className="payment-meta">
                        <span
                          className={`badge entry-badge ${getEntryTypeClassName(payment)}`}
                        >
                          <span className="entry-icon">{getEntryTypeIcon(payment)}</span>
                          {getEntryTypeLabel(payment)}
                        </span>
                        <span className="badge status-badge">
                          {formatStatus(payment.status)}
                        </span>
                        {isOverdueOpenCredit(payment) && (
                          <span className="overdue-badge">En retard</span>
                        )}
                        <span className="meta-line">
                          Date: {formatDateDDMMYYYY(payment.date)}
                        </span>
                        {thread.creditRootId && (
                          <span className="meta-line">Reference: #{thread.creditRootId}</span>
                        )}
                        {originalAmount !== null && (
                          <span className="meta-line">
                            Original: {formatAmount(originalAmount)}
                          </span>
                        )}
                        {remainingAmount !== null && (
                          <span className="meta-line">
                            Restant: {formatAmount(remainingAmount)}
                          </span>
                        )}
                        {payment.credit_opened_date && (
                          <span className="meta-line">
                            Ouvert le: {formatDateDDMMYYYY(payment.credit_opened_date)}
                          </span>
                        )}
                        {expectedDateValue && (
                          <span className="meta-line">
                            Prevu le: {formatDateDDMMYYYY(expectedDateValue)}
                          </span>
                        )}
                        {payment.credit_settled_date && (
                          <span className="meta-line">
                            Regle le: {formatDateDDMMYYYY(payment.credit_settled_date)}
                          </span>
                        )}

                        {isOpenRoot && (
                          <button
                            type="button"
                            className="secondary compact"
                            disabled={!isOnline}
                            onClick={() => setPartialTarget(payment)}
                          >
                            Payer une partie
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="action-bar">
        <button
          className="primary"
          disabled={!canSettleSelection}
          onClick={handleSettle}
        >
          {selectedIds.length === 0
            ? "Regler le credit"
            : selectedIds.length === 1
            ? "Regler 1 credit"
            : `Regler ${selectedIds.length} credits`}
        </button>
      </div>

      {partialTarget && (
        <PartialPaymentModal
          payment={partialTarget}
          onClose={() => setPartialTarget(null)}
          onBeforeSubmit={(partialAmount, referenceDate) =>
            dailyLimitGuard.requestApproval(partialAmount, referenceDate)
          }
          onSubmit={(payload) => partialCreditPayment(partialTarget.id, payload)}
          onSuccess={async (result) => {
            setActionSuccess(
              `${result.message} - restant ${formatAmount(result.remaining_amount)}`
            );
            await handleSearch();
          }}
        />
      )}

      {pendingSettleCredits && (
        <SettleCreditModal
          title={
            pendingSettleCredits.length === 1
              ? `Regler le credit #${pendingSettleCredits[0].id}`
              : `Regler ${pendingSettleCredits.length} credits`
          }
          description={
            pendingSettleCredits.length === 1
              ? `Fournisseur: ${pendingSettleCredits[0].supplier}`
              : `Montant total: ${formatAmount(
                  pendingSettleCredits.reduce(
                    (sum, payment) => sum + Number(getRemainingAmount(payment) ?? payment.amount),
                    0
                  )
                )}`
          }
          defaultDate={todayLocalDate()}
          isSubmitting={isSettlingCredits}
          error={actionError}
          onCancel={() => {
            setActionError("");
            setPendingSettleCredits(null);
          }}
          onConfirm={submitSettle}
        />
      )}

      {dailyLimitGuard.crossingWarning && (
        <DailyLimitCrossingModal
          evaluation={dailyLimitGuard.crossingWarning}
          onConfirm={dailyLimitGuard.confirmCrossing}
          onCancel={dailyLimitGuard.cancelCrossing}
        />
      )}
    </section>
  );
}
