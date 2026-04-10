import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Button,
  Checkbox,
  NumberInput,
  SegmentedControl,
  Select,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { useDailyLimitGuard } from "@/hooks/useDailyLimitGuard";
import "./payments.css";
import {
  createPayment,
  deletePayment,
  getPaymentsByDate,
  partialCreditPayment,
  settleCredit,
  updatePayment,
  type DeleteConfirmationResponse,
  type Payment,
  type PaymentStatus,
} from "@/api/payments";
import { getSuppliers } from "@/api/suppliers";
import DailyLimitCrossingModal from "@/components/DailyLimitCrossingModal";
import PartialPaymentModal from "@/components/PartialPaymentModal";
import SettleCreditModal from "@/components/SettleCreditModal";
import SupplierAvatar from "@/components/SupplierAvatar";
import StatusBadge from "@/components/StatusBadge";
import { todayLocalDate } from "@/utils/localDate";
import {
  formatAmount,
  getCreditExpectedDate,
  formatDateDDMMYYYY,
  getOriginalCreditAmount,
  getRemainingAmount,
  groupPaymentsByCreditThread,
  inferEntryType,
  isOpenCreditRoot,
  isOverdueOpenCredit,
} from "@/utils/paymentDisplay";

type BadgeStatus = ComponentProps<typeof StatusBadge>["status"];

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

function formatDateDDMMYYYYWithDash(dateStr?: string | null): string {
  return formatDateDDMMYYYY(dateStr).replace(/\//g, "-");
}

export default function Payments() {
  const isOnline = useOnline();
  const dailyLimitGuard = useDailyLimitGuard();

  const [selectedDate, setSelectedDate] = useState<string>(todayLocalDate());

  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState<PaymentStatus>("PAID");
  const [note, setNote] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  const [partialTarget, setPartialTarget] = useState<Payment | null>(null);
  const [settleTarget, setSettleTarget] = useState<Payment | null>(null);
  const [isSettlingCredit, setIsSettlingCredit] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    response: DeleteConfirmationResponse;
    remainingIds: number[];
  } | null>(null);
  const [collapsedByThreadKey, setCollapsedByThreadKey] = useState<
    Record<string, boolean>
  >({});

  const fetchPayments = useCallback(
    () => getPaymentsByDate(selectedDate),
    [selectedDate]
  );

  const paymentData = useDateAwareCachedData({
    isOnline,
    dateKey: selectedDate,
    fetchData: fetchPayments,
  });

  const refreshPayments = useCallback(async () => {
    const res = await getPaymentsByDate(selectedDate);
    setPayments(res.payments);
    setTotalPaid(res.total_paid);
    setTotalCredit(res.total_credit);
    setSelectedIds([]);
  }, [selectedDate]);

  useEffect(() => {
    if (paymentData.data) {
      setPayments(paymentData.data.payments);
      setTotalPaid(paymentData.data.total_paid);
      setTotalCredit(paymentData.data.total_credit);
      setSelectedIds([]);
      setLoadError("");
    } else if (paymentData.error) {
      setPayments([]);
      setTotalPaid(0);
      setTotalCredit(0);
      setSelectedIds([]);
      setLoadError(paymentData.error.message);
    }
  }, [paymentData.data, paymentData.error]);

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

  useEffect(() => {
    if (status === "CREDIT" && !expectedDate) {
      setExpectedDate(selectedDate);
    }
  }, [status, expectedDate, selectedDate]);

  const selectedPayment = useMemo(
    () =>
      selectedIds.length === 1
        ? payments.find((payment) => payment.id === selectedIds[0]) ?? null
        : null,
    [payments, selectedIds]
  );
  const canSettleSelected = Boolean(
    isOnline && selectedPayment && isOpenCreditRoot(selectedPayment)
  );
  const paidTransactionsCount = useMemo(
    () => payments.filter((payment) => payment.status === "PAID").length,
    [payments]
  );
  const creditTransactionsCount = useMemo(
    () => payments.filter((payment) => payment.status === "CREDIT").length,
    [payments]
  );
  const parsedAmount = Number(amount);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const isSubmitDisabled =
    !supplierId || !isAmountValid || (status === "CREDIT" && !expectedDate);

  function resetForm() {
    setSupplierId(null);
    setAmount("");
    setStatus("PAID");
    setNote("");
    setExpectedDate("");
    setEditingPaymentId(null);
  }

  async function handleSubmit() {
    setActionError("");
    setActionSuccess("");
    dailyLimitGuard.clearAlreadyOverNotice();

    if (!supplierId) {
      setActionError("Selectionnez un fournisseur.");
      return;
    }

    if (!isAmountValid) {
      setActionError("Saisissez un montant valide superieur a zero.");
      return;
    }

    if (status === "CREDIT" && !expectedDate) {
      setActionError("Ajoutez une date prevue pour un credit.");
      return;
    }

    const payload = {
      supplier_id: supplierId,
      date: selectedDate,
      amount: parsedAmount,
      status,
      note,
      expected_payment_date: status === "CREDIT" ? expectedDate : null,
    };

    try {
      if (editingPaymentId === null) {
        if (status === "PAID") {
          const approved = await dailyLimitGuard.requestApproval(parsedAmount, selectedDate);
          if (!approved) return;
        }
        await createPayment(payload);
      } else {
        await updatePayment(editingPaymentId, payload);
      }

      resetForm();
      await refreshPayments();
      setActionSuccess("Paiement enregistre.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function processDeleteIds(ids: number[]) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const result = await deletePayment(id);
        if (result && "requires_confirmation" in result && result.requires_confirmation) {
          setDeleteConfirmation({ response: result, remainingIds: ids.slice(i + 1) });
          return;
        }
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Erreur lors de la suppression."
        );
        return;
      }
    }
    await refreshPayments();
    setActionSuccess("Paiement(s) supprime(s).");
  }

  async function deleteSelected() {
    if (!selectedIds.length) return;
    setActionError("");
    setActionSuccess("");
    await processDeleteIds(selectedIds);
  }

  async function handleForceDelete(force: "cascade" | "leave") {
    if (!deleteConfirmation) return;
    const { response, remainingIds } = deleteConfirmation;
    setDeleteConfirmation(null);
    try {
      await deletePayment(response.payment_id, force);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Erreur lors de la suppression."
      );
      return;
    }

    if (remainingIds.length > 0) {
      await processDeleteIds(remainingIds);
    } else {
      await refreshPayments();
      setActionSuccess("Paiement(s) supprime(s).");
    }
  }

  async function handleSettleCredit() {
    if (!isOnline) return;
    if (selectedIds.length !== 1) return;

    if (!selectedPayment || !isOpenCreditRoot(selectedPayment)) {
      setActionError("Selection invalide: choisissez uniquement un credit ouvert.");
      return;
    }

    setActionError("");
    setActionSuccess("");
    setSettleTarget(selectedPayment);
  }

  async function submitSettleCredit(settleDate: string) {
    if (!settleTarget) return;
    try {
      dailyLimitGuard.clearAlreadyOverNotice();
      setIsSettlingCredit(true);
      const settleAmount = Number(getRemainingAmount(settleTarget) ?? settleTarget.amount);
      const approved = await dailyLimitGuard.requestApproval(
        settleAmount,
        settleDate
      );
      if (!approved) return;

      await settleCredit(settleTarget.id, { settle_date: settleDate });
      setSettleTarget(null);
      await refreshPayments();
      setActionSuccess("Credit regle avec succes.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur lors du reglement.");
    } finally {
      setIsSettlingCredit(false);
    }
  }

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

  return (
    <section className="payments-page">


      <div className="top-bar">
        <div className="date-control">
          <label htmlFor="payments-date">Date de reference</label>
          <input
            id="payments-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>

        <div className="totals-grid">
          <div className="kpi-card total-paid-card">
            <span className="kpi-label">TOTAL PAYE</span>
            <strong className="kpi-amount">{formatAmount(totalPaid)}</strong>
            <small className="kpi-sub">{paidTransactionsCount} transaction(s)</small>
          </div>

          <div className="kpi-card credit-open-card">
            <span className="kpi-label">CREDIT OUVERT</span>
            <strong className="kpi-amount">{formatAmount(totalCredit)}</strong>
            <small className="kpi-sub">{creditTransactionsCount} transaction(s)</small>
          </div>
        </div>
      </div>

      <div className="card form-card">
        <div className="section-title">
          <h2>{editingPaymentId ? "Modifier un paiement" : "Ajouter un paiement"}</h2>
          <span className="section-meta">
            {editingPaymentId ? "Edition active" : "Nouvelle saisie"}
          </span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
          className="form-grid"
        >
          <div className="field">
            <Select
              label="Fournisseur"
              placeholder="Selectionner un fournisseur"
              searchable
              value={supplierId === null ? null : String(supplierId)}
              onChange={(value) => setSupplierId(value ? Number(value) : null)}
              data={suppliers.map((supplier) => ({
                value: String(supplier.id),
                label: supplier.name,
              }))}
            />
          </div>

          <div className="field">
            <NumberInput
              label="Montant"
              value={amount === "" ? "" : Number(amount)}
              min={0}
              step={0.01}
              decimalScale={2}
              fixedDecimalScale
              onChange={(value) => setAmount(value === "" ? "" : String(value))}
              placeholder="0.00"
            />
          </div>

          <div className="field">
            <SegmentedControl
              fullWidth
              value={status}
              onChange={(value) => setStatus(value as PaymentStatus)}
              data={[
                { label: "Paye", value: "PAID" },
                { label: "Credit", value: "CREDIT" },
              ]}
            />
          </div>

          <div className="field">
            <DateInput
              label="Date prevue"
              placeholder="JJ-MM-AAAA"
              value={status === "CREDIT" ? expectedDate || null : null}
              onChange={(value) => setExpectedDate(value ?? "")}
              valueFormat="DD-MM-YYYY"
              disabled={status !== "CREDIT"}
            />
          </div>

          <div className="field full">
            <TextInput
              label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Commentaire optionnel"
            />
          </div>

          <div className="form-actions full">
            <Button className="submit-payment" type="submit" disabled={isSubmitDisabled}>
              {editingPaymentId ? "Enregistrer" : "Ajouter"}
            </Button>
            {editingPaymentId && (
              <Button
                className="cancel-payment"
                type="button"
                onClick={resetForm}
                variant="default"
              >
                Annuler
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="card transactions-card">
        <div className="section-title">
          <h2>Transactions</h2>
          <div className="section-meta-group">
            <span className="section-meta">{threads.length} groupe(s)</span>
            <span className="section-meta">{selectedIds.length} selectionne(s)</span>
          </div>
        </div>

        {loadError && (
          <div className="state-error" role="alert">
            Erreur: {loadError}
          </div>
        )}
        {actionError && (
          <div className="state-error" role="alert">
            Erreur: {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="state-success" role="status">
            {actionSuccess}
          </div>
        )}
        {dailyLimitGuard.alreadyOverNotice && (
          <div className="state-warning" role="status">
            {dailyLimitGuard.alreadyOverNotice}
          </div>
        )}

        <div className="payments-list">
          {paymentData.isLoading && !payments.length && (
            <div className="state-empty">Chargement...</div>
          )}

          {!paymentData.isLoading && payments.length === 0 && !loadError && (
            <div className="state-empty">Aucune transaction pour cette date</div>
          )}

          {threads.map((thread) => {
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
                        <span className={`thread-chevron ${isCollapsed ? "collapsed" : ""}`}>
                          v
                        </span>
                      </span>
                    </div>
                    {isCrossDateChain && chainContextParts.length > 0 && (
                      <div className="thread-context">{chainContextParts.join(" Â· ")}</div>
                    )}
                  </button>
                )}

                {!isCollapsed &&
                  thread.items.map((payment) => {
                    const isRoot = Boolean(thread.hasRoot && thread.root?.id === payment.id);
                    const remainingAmount = getRemainingAmount(payment);
                    const expectedPaymentDate = getCreditExpectedDate(payment);
                    const statusBadge = getRowBadgeStatus(payment, {
                      isRoot,
                      isSettledChain: thread.isSettled,
                    });

                    const detailParts = [
                      formatDateDDMMYYYY(payment.date),
                      remainingAmount !== null && (!thread.hasRoot || isRoot)
                        ? `Restant ${formatAmount(remainingAmount)}`
                        : null,
                      !thread.isSettled && expectedPaymentDate
                        ? `Date prevue de paiement: ${formatDateDDMMYYYYWithDash(
                            expectedPaymentDate
                          )}`
                        : null,
                    ].filter(Boolean) as string[];

                    return (
                      <div
                        key={payment.id}
                        className={`payment-item ${payment.status === "PAID" ? "paid-row" : "credit-row"} ${
                          isRoot ? "root-row" : "child-row"
                        }`}
                      >
                        <Checkbox
                          className="payment-checkbox"
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

                          <div className="payment-details">{detailParts.join(" Â· ")}</div>

                          {isOpenCreditRoot(payment) && (
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
          })}
        </div>
      </div>

      <div className="action-bar">
        <p className="selection-hint">Selectionnez au moins une ligne.</p>
        <div className="action-buttons">
          <button
            type="button"
            className="ghost-danger"
            disabled={selectedIds.length === 0 || !isOnline}
            onClick={deleteSelected}
          >
            Supprimer
          </button>

          <button
            type="button"
            className="solid-accent"
            disabled={!canSettleSelected}
            onClick={handleSettleCredit}
          >
            Regler credit
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
            await refreshPayments();
          }}
        />
      )}

      {settleTarget && (
        <SettleCreditModal
          title={`Regler le credit #${settleTarget.id}`}
          description={`Fournisseur: ${settleTarget.supplier}`}
          defaultDate={todayLocalDate()}
          isSubmitting={isSettlingCredit}
          error={actionError}
          onCancel={() => {
            setActionError("");
            setSettleTarget(null);
          }}
          onConfirm={submitSettleCredit}
        />
      )}

      {dailyLimitGuard.crossingWarning && (
        <DailyLimitCrossingModal
          evaluation={dailyLimitGuard.crossingWarning}
          onConfirm={dailyLimitGuard.confirmCrossing}
          onCancel={dailyLimitGuard.cancelCrossing}
        />
      )}

      {deleteConfirmation && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Confirmer la suppression</h2>
            <div className="modal-body">
              <p>
                Ce credit possede <strong>{deleteConfirmation.response.child_count}</strong>{" "}
                paiement(s) associe(s). Que souhaitez-vous faire ?
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="solid-accent"
                onClick={() => handleForceDelete("cascade")}
              >
                Annuler le credit et ses paiements
              </button>
              <button
                type="button"
                className="ghost-danger"
                onClick={() => handleForceDelete("leave")}
              >
                Annuler le credit uniquement
              </button>
              <button
                type="button"
                className="inline-secondary"
                onClick={() => setDeleteConfirmation(null)}
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
