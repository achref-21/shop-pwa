import { type ComponentProps, useEffect, useMemo, useState } from "react";
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
import SupplierAvatar from "@/components/SupplierAvatar";
import StatusBadge from "@/components/StatusBadge";
import { todayLocalDate } from "@/utils/localDate";
import {
  formatAmount,
  formatDateDDMMYYYY,
  getCreditExpectedDate,
  getOriginalCreditAmount,
  getRemainingAmount,
  groupPaymentsByCreditThread,
  inferEntryType,
  isOpenCreditRoot,
  isOverdueOpenCredit,
} from "@/utils/paymentDisplay";
import "./PaymentsSearch.css";

type DateFilterMode = "TRANSACTION" | "EXPECTED";
type BadgeStatus = ComponentProps<typeof StatusBadge>["status"];

type SearchState = {
  supplierId?: number;
  status: string;
  startDate: string;
  endDate: string;
  overdueOnly: boolean;
  dateFilterMode: DateFilterMode;
};

const INITIAL_SEARCH_STATE: SearchState = {
  supplierId: undefined,
  status: "",
  startDate: "",
  endDate: "",
  overdueOnly: false,
  dateFilterMode: "TRANSACTION",
};

function getRowBadgeStatus(
  payment: Payment,
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

function parseStatus(display: string): "PAID" | "CREDIT" | undefined {
  if (display === "Paye") return "PAID";
  if (display === "Credit") return "CREDIT";
  return undefined;
}

function buildSearchStateKey(filters: SearchState): string {
  return [
    filters.supplierId ?? "",
    filters.status,
    filters.startDate,
    filters.endDate,
    filters.overdueOnly ? "1" : "0",
    filters.dateFilterMode,
  ].join("_");
}

function normalizeIsoDate(value?: string | null): string {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
}

function matchesDateRange(value: string, startDate: string, endDate: string): boolean {
  if (!value) return false;
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function applyTransactionDateFilter(
  rows: Payment[],
  startDate: string,
  endDate: string
): Payment[] {
  if (!startDate && !endDate) {
    return rows;
  }

  return rows.filter((payment) =>
    matchesDateRange(normalizeIsoDate(payment.date), startDate, endDate)
  );
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
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("TRANSACTION");
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [lastSearchedFilters, setLastSearchedFilters] = useState("");
  const [collapsedByThreadKey, setCollapsedByThreadKey] = useState<Record<string, boolean>>({});

  const currentSearchState: SearchState = useMemo(
    () => ({
      supplierId,
      status,
      startDate,
      endDate,
      overdueOnly,
      dateFilterMode,
    }),
    [supplierId, status, startDate, endDate, overdueOnly, dateFilterMode]
  );

  const currentFilterString = useMemo(
    () => buildSearchStateKey(currentSearchState),
    [currentSearchState]
  );

  useEffect(() => {
    if (!isOnline && lastSearchedFilters && lastSearchedFilters !== currentFilterString) {
      setPayments([]);
      setLoadError("Les filtres ont change. Cliquez sur Rechercher pour actualiser.");
    }
  }, [currentFilterString, isOnline, lastSearchedFilters]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  const threads = useMemo(() => groupPaymentsByCreditThread(payments), [payments]);

  useEffect(() => {
    setCollapsedByThreadKey((previous) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const thread of threads) {
        if (thread.creditRootId === null) continue;

        if (Object.prototype.hasOwnProperty.call(previous, thread.key)) {
          next[thread.key] = previous[thread.key];
        } else {
          next[thread.key] = thread.isSettled && thread.items.length > 1;
          changed = true;
        }
      }

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      if (previousKeys.length !== nextKeys.length) {
        changed = true;
      } else if (!changed) {
        for (const key of nextKeys) {
          if (previous[key] !== next[key]) {
            changed = true;
            break;
          }
        }
      }

      return changed ? next : previous;
    });
  }, [threads]);

  const canSettleSelection = useMemo(() => {
    if (!isOnline || selectedIds.length === 0) return false;
    const selectedPayments = payments.filter((payment) => selectedIds.includes(payment.id));
    return selectedPayments.length > 0 && selectedPayments.every(isOpenCreditRoot);
  }, [isOnline, payments, selectedIds]);

  async function runSearch(filters: SearchState) {
    try {
      setLoadError("");
      setCacheWarning("");
      setActionError("");
      setActionSuccess("");

      if (
        !isOnline &&
        (filters.startDate || filters.endDate) &&
        !isDateRangeWithinCache(filters.startDate, filters.endDate)
      ) {
        setCacheWarning(
          "Attention: hors ligne, seules les donnees des 90 derniers jours sont disponibles."
        );
      }

      const params = {
        supplier_id: filters.supplierId,
        status: parseStatus(filters.status),
        start_expected_date:
          filters.dateFilterMode === "EXPECTED" ? filters.startDate || undefined : undefined,
        end_expected_date:
          filters.dateFilterMode === "EXPECTED" ? filters.endDate || undefined : undefined,
        overdue_only: filters.overdueOnly,
      };

      const results = await searchPayments(params, isOnline);
      const filteredResults =
        filters.dateFilterMode === "TRANSACTION"
          ? applyTransactionDateFilter(results, filters.startDate, filters.endDate)
          : results;

      setPayments(filteredResults);
      setSelectedIds([]);
      setLastSearchedFilters(buildSearchStateKey(filters));
    } catch (error) {
      setPayments([]);
      setSelectedIds([]);
      setCacheWarning("");
      setLoadError(error instanceof Error ? error.message : "Erreur lors de la recherche");
    }
  }

  function handleSearch() {
    void runSearch(currentSearchState);
  }

  useEffect(() => {
    void runSearch(INITIAL_SEARCH_STATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelection(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function toggleThreadCollapsed(threadKey: string) {
    setCollapsedByThreadKey((previous) => ({
      ...previous,
      [threadKey]: !previous[threadKey],
    }));
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
      await runSearch(currentSearchState);
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
    setSupplierId(INITIAL_SEARCH_STATE.supplierId);
    setStatus(INITIAL_SEARCH_STATE.status);
    setStartDate(INITIAL_SEARCH_STATE.startDate);
    setEndDate(INITIAL_SEARCH_STATE.endDate);
    setOverdueOnly(INITIAL_SEARCH_STATE.overdueOnly);
    setDateFilterMode(INITIAL_SEARCH_STATE.dateFilterMode);
    void runSearch(INITIAL_SEARCH_STATE);
  }

  return (
    <section className="payments-search-page">
      <div className="card filters-card">
        <div className="filters-header">
          <div className="section-title">
            <h2>Filtres</h2>
            <span className="section-meta">
              {dateFilterMode === "TRANSACTION" ? "Transaction" : "Date prevue"}
            </span>
          </div>
          <button
            type="button"
            className="collapse-button"
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            title={isFiltersCollapsed ? "Afficher les filtres" : "Masquer les filtres"}
          >
            {isFiltersCollapsed ? "v" : "^"}
          </button>
        </div>

        {!isFiltersCollapsed && (
          <div className="filters-grid">
            <div className="filter-field full">
              <label>Mode de date</label>
              <div className="mode-toggle" role="radiogroup" aria-label="Mode de date">
                <button
                  type="button"
                  className={`mode-option ${dateFilterMode === "TRANSACTION" ? "active" : ""}`}
                  aria-pressed={dateFilterMode === "TRANSACTION"}
                  onClick={() => setDateFilterMode("TRANSACTION")}
                >
                  Date transaction
                </button>
                <button
                  type="button"
                  className={`mode-option ${dateFilterMode === "EXPECTED" ? "active" : ""}`}
                  aria-pressed={dateFilterMode === "EXPECTED"}
                  onClick={() => setDateFilterMode("EXPECTED")}
                >
                  Date prevue credit
                </button>
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="payments-search-supplier">Fournisseur</label>
              <select
                id="payments-search-supplier"
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
              <label htmlFor="payments-search-status">Statut</label>
              <select
                id="payments-search-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Tous</option>
                <option>Paye</option>
                <option>Credit</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="payments-search-start-date">
                {dateFilterMode === "TRANSACTION"
                  ? "Date transaction debut"
                  : "Date prevue debut"}
                <br />
                <small>
                  {dateFilterMode === "TRANSACTION"
                    ? "(historique complet)"
                    : "(credits ouverts)"}
                </small>
              </label>
              <input
                id="payments-search-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="payments-search-end-date">
                {dateFilterMode === "TRANSACTION" ? "Date transaction fin" : "Date prevue fin"}
                <br />
                <small>
                  {dateFilterMode === "TRANSACTION"
                    ? "(historique complet)"
                    : "(credits ouverts)"}
                </small>
              </label>
              <input
                id="payments-search-end-date"
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

            <p className="filter-note full">
              Le tri des groupes est toujours base sur la derniere transaction de chaque chaine.
            </p>
          </div>
        )}

        <div className="filter-actions">
          <button type="button" className="primary" onClick={handleSearch}>
            Rechercher
          </button>
          <button type="button" className="secondary" onClick={resetFilters}>
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="card results-card">
        <div className="section-title">
          <h2>Resultats ({payments.length})</h2>
          <div className="section-meta-group">
            <span className="section-meta">{threads.length} groupe(s)</span>
            <span className="section-meta">{selectedIds.length} selectionne(s)</span>
          </div>
        </div>

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
            threads.map((thread) => {
              const isChain = thread.creditRootId !== null;
              const isCrossDateChain = isChain && !thread.hasRoot;
              const isCollapsed = isChain ? Boolean(collapsedByThreadKey[thread.key]) : false;
              const headerSource = thread.root ?? thread.items[0] ?? null;
              const originalCreditAmount = headerSource
                ? getOriginalCreditAmount(headerSource)
                : null;

              const chainContextParts: string[] = [];
              if (headerSource?.supplier) {
                chainContextParts.push(headerSource.supplier);
              }
              if (headerSource?.credit_opened_date) {
                chainContextParts.push(`Ouvert le ${formatDateDDMMYYYY(headerSource.credit_opened_date)}`);
              }
              if (originalCreditAmount !== null) {
                chainContextParts.push(`Original: ${formatAmount(originalCreditAmount)}`);
              }

              return (
                <div
                  className={`payment-thread ${thread.isSettled ? "settled-chain" : "unsettled-chain"}`}
                  key={thread.key}
                >
                  {isChain && (
                    <button
                      type="button"
                      className={`thread-header thread-toggle ${thread.isSettled ? "settled" : "unsettled"}`}
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleThreadCollapsed(thread.key)}
                    >
                      <div className="thread-header-line">
                        <span className="thread-title">Chaine credit #{thread.creditRootId}</span>
                        <span className="thread-header-right">
                          {thread.isSettled && <StatusBadge status="CREDIT_SETTLED" />}
                          <span className={`thread-chevron ${isCollapsed ? "collapsed" : ""}`}>v</span>
                        </span>
                      </div>
                      {isCrossDateChain && chainContextParts.length > 0 && (
                        <div className="thread-context">{chainContextParts.join(" · ")}</div>
                      )}
                    </button>
                  )}

                  {!isCollapsed &&
                    thread.items.map((payment) => {
                      const isRoot = Boolean(thread.hasRoot && thread.root?.id === payment.id);
                      const isOpenRoot = isOpenCreditRoot(payment);
                      const remainingAmount = getRemainingAmount(payment);
                      const expectedPaymentDate = getCreditExpectedDate(payment);
                      const statusBadge = getRowBadgeStatus(payment, {
                        isRoot,
                        isSettledChain: thread.isSettled,
                      });

                      const detailParts = [
                        formatDateDDMMYYYY(payment.date),
                        thread.creditRootId ? `Ref #${thread.creditRootId}` : null,
                        remainingAmount !== null && (!thread.hasRoot || isRoot)
                          ? `Restant ${formatAmount(remainingAmount)}`
                          : null,
                        !thread.isSettled && expectedPaymentDate
                          ? `Date prevue ${formatDateDDMMYYYY(expectedPaymentDate)}`
                          : null,
                      ].filter(Boolean) as string[];

                      return (
                        <div
                          key={payment.id}
                          className={`payment-item ${payment.status === "PAID" ? "paid-row" : "credit-row"} ${
                            isRoot ? "root-row" : "child-row"
                          } ${isOverdueOpenCredit(payment) ? "overdue-row" : ""}`}
                        >
                          <input
                            className="payment-checkbox"
                            type="checkbox"
                            checked={selectedIds.includes(payment.id)}
                            aria-label={`Selectionner transaction ${payment.id}`}
                            onChange={() => toggleSelection(payment.id)}
                          />

                          <div className="payment-avatar" title={payment.supplier}>
                            <SupplierAvatar name={payment.supplier} size={36} />
                          </div>

                          <div className="payment-main">
                            <div className="payment-headline">
                              <div className="supplier-inline">
                                <strong>{payment.supplier}</strong>
                                <StatusBadge status={statusBadge} />
                              </div>
                              <span className="amount">{formatAmount(payment.amount)}</span>
                            </div>

                            <div className="payment-details">{detailParts.join(" · ")}</div>

                            {isOpenRoot && (
                              <button
                                type="button"
                                className="inline-secondary"
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
              );
            })
          )}
        </div>
      </div>

      <div className="action-bar">
        <p className="selection-hint">Selectionnez uniquement des credits ouverts.</p>
        <div className="action-buttons">
          <button
            type="button"
            className="solid-accent"
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
            await runSearch(currentSearchState);
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
