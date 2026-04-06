import { useCallback, useEffect, useMemo, useState } from "react";
import { getDailyLimitSettingValue, setDailyLimitSettingValue } from "@/api/settings";
import { partialCreditPayment, settleCredit, type Payment } from "@/api/payments";
import type { DashboardMode } from "@/api/dashboard";
import DailyLimitCrossingModal from "@/components/DailyLimitCrossingModal";
import PartialPaymentModal from "@/components/PartialPaymentModal";
import SettleCreditModal from "@/components/SettleCreditModal";
import { useDailyLimitGuard } from "@/hooks/useDailyLimitGuard";
import { useDashboardNextData } from "@/hooks/useDashboardNextData";
import { useOnline } from "@/hooks/useOnline";
import { todayLocalDate } from "@/utils/localDate";
import { formatAmount, formatDateDDMMYYYY, getRemainingAmount } from "@/utils/paymentDisplay";
import {
  DASHBOARD_NEXT_MODE_KEY,
  computeDailyLimitUsage,
  parseStoredMode,
  type DashboardNextCreditLine,
} from "./dashboardNextUtils";
import "./DashboardNext.css";

type DailyLimitModalProps = {
  currentValue: number | null;
  isSaving: boolean;
  onSave: (value: number) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
};

type ModeModalProps = {
  currentMode: DashboardMode;
  onSave: (value: DashboardMode) => void;
  onClose: () => void;
};

type PaymentActionModalProps = {
  payment: Payment;
  isOnline: boolean;
  isSubmitting: boolean;
  actionError: string;
  onClose: () => void;
  onSettleFull: () => void;
  onPartialPay: () => void;
};

function DailyLimitModal({
  currentValue,
  isSaving,
  onSave,
  onClear,
  onClose,
}: DailyLimitModalProps) {
  const [value, setValue] = useState(currentValue ? String(currentValue) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(currentValue ? String(currentValue) : "");
  }, [currentValue]);

  async function handleSave() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Saisissez une limite valide superieure a 0.");
      return;
    }
    setError("");
    try {
      await onSave(Math.round(parsed * 100) / 100);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur de sauvegarde.");
    }
  }

  async function handleClear() {
    setError("");
    try {
      await onClear();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur de sauvegarde.");
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="daily-limit-title">
      <div className="modal dashboard-next-modal">
        <h2 id="daily-limit-title">Limite quotidienne</h2>

        <label className="dashboard-next-field">
          Limite de depense
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0.00"
            disabled={isSaving}
          />
        </label>

        {error && <p className="dashboard-next-error">{error}</p>}

        <div className="dashboard-next-modal-actions">
          <button type="button" className="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button type="button" className="secondary" onClick={handleClear} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Supprimer limite"}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={isSaving}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeModal({ currentMode, onSave, onClose }: ModeModalProps) {
  const [value, setValue] = useState<DashboardMode>(currentMode);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="period-mode-title">
      <div className="modal dashboard-next-modal">
        <h2 id="period-mode-title">Mode bloc 2</h2>

        <label className="dashboard-next-field">
          Periode
          <select
            aria-label="Mode periode"
            value={value}
            onChange={(event) => setValue(event.target.value as DashboardMode)}
          >
            <option value="WEEK">Hebdomadaire</option>
            <option value="MONTH">Mensuel</option>
          </select>
        </label>

        <div className="dashboard-next-modal-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              onSave(value);
              onClose();
            }}
          >
            Appliquer
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentActionModal({
  payment,
  isOnline,
  isSubmitting,
  actionError,
  onClose,
  onSettleFull,
  onPartialPay,
}: PaymentActionModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-action-title">
      <div className="modal dashboard-next-modal">
        <h2 id="payment-action-title">Paiement credit #{payment.id}</h2>

        <p className="dashboard-next-modal-line">
          Fournisseur: <strong>{payment.supplier}</strong>
        </p>
        <p className="dashboard-next-modal-line">
          Restant: <strong>{formatAmount(getRemainingAmount(payment))}</strong>
        </p>

        {actionError && <p className="dashboard-next-error">{actionError}</p>}

        <div className="dashboard-next-modal-actions">
          <button
            type="button"
            className="primary"
            disabled={!isOnline || isSubmitting}
            onClick={onSettleFull}
          >
            {isSubmitting ? "Traitement..." : "Regler tout le credit"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!isOnline || isSubmitting}
            onClick={onPartialPay}
          >
            Paiement partiel
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function renderCreditLine(
  line: DashboardNextCreditLine,
  options?: {
    clickable?: boolean;
    onClick?: (paymentId: number) => void;
  }
) {
  const clickable = Boolean(options?.clickable && options.onClick);

  return (
    <li className="dashboard-next-row" key={line.paymentId}>
      <button
        type="button"
        className={`dashboard-next-row-button ${clickable ? "clickable" : ""}`}
        onClick={() => options?.onClick?.(line.paymentId)}
        disabled={!clickable}
      >
        <div>
          <strong>{line.supplier}</strong>
          <p>
            {line.expectedDate ? `${formatDateDDMMYYYY(line.expectedDate)}` : ""}
          </p>
        </div>
        <div className="dashboard-next-row-amounts">
          <span>A payer: {formatAmount(line.remainingAmount)}</span>
          {line.isPartial && <small>Original: {formatAmount(line.originalAmount)}</small>}
        </div>
      </button>
    </li>
  );
}

function UnavailableState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="dashboard-next-unavailable">
      <p>Indisponible (backend non pret).</p>
      <button type="button" className="secondary compact" onClick={onRetry}>
        Reessayer
      </button>
    </div>
  );
}

export default function DashboardNext() {
  const isOnline = useOnline();
  const dailyLimitGuard = useDailyLimitGuard();

  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [isDailyLimitLoading, setIsDailyLimitLoading] = useState(true);
  const [isDailyLimitSaving, setIsDailyLimitSaving] = useState(false);
  const [dailyLimitError, setDailyLimitError] = useState("");
  const [mode, setMode] = useState<DashboardMode>(() => {
    try {
      return parseStoredMode(localStorage.getItem(DASHBOARD_NEXT_MODE_KEY));
    } catch {
      return "WEEK";
    }
  });

  const [isDailyLimitOpen, setIsDailyLimitOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [settleTarget, setSettleTarget] = useState<Payment | null>(null);
  const [partialTarget, setPartialTarget] = useState<Payment | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const query = useDashboardNextData({ mode, isOnline });

  const reloadDailyLimitSetting = useCallback(async (): Promise<void> => {
    setIsDailyLimitLoading(true);
    setDailyLimitError("");

    try {
      const value = await getDailyLimitSettingValue();
      setDailyLimit(value);
    } catch (error) {
      setDailyLimitError(
        error instanceof Error
          ? `Erreur limite quotidienne: ${error.message}`
          : "Erreur limite quotidienne."
      );
    } finally {
      setIsDailyLimitLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadDailyLimitSetting();
  }, [reloadDailyLimitSetting]);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_NEXT_MODE_KEY, mode);
    } catch {
      // Ignore storage write errors
    }
  }, [mode]);

  const dailyUsage = useMemo(
    () => computeDailyLimitUsage(query.daily.data?.paid ?? null, dailyLimit),
    [dailyLimit, query.daily.data?.paid]
  );

  const block1Warnings = [query.daily, query.credits]
    .filter((source) => source.isStale && source.error)
    .map((source) => source.error);
  const block2Warnings = [query.period, query.credits]
    .filter((source) => source.isStale && source.error)
    .map((source) => source.error);

  function openPaymentActions(paymentId: number) {
    const payment = query.credits.data?.byId[paymentId];
    if (!payment) return;
    setActionError("");
    dailyLimitGuard.clearAlreadyOverNotice();
    setSelectedPayment(payment);
  }

  async function handleSettleFull(settleDate: string) {
    if (!settleTarget || !isOnline) return;

    setActionError("");
    setActionSuccess("");
    dailyLimitGuard.clearAlreadyOverNotice();
    try {
      const settleAmount = Number(getRemainingAmount(settleTarget) ?? settleTarget.amount);
      const approved = await dailyLimitGuard.requestApproval(
        settleAmount,
        settleDate
      );
      if (!approved) return;

      setIsSubmittingAction(true);
      await settleCredit(settleTarget.id, { settle_date: settleDate });
      setActionSuccess(`Credit #${settleTarget.id} regle avec succes.`);
      setSettleTarget(null);
      query.refreshAll();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Erreur lors du reglement.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function saveDailyLimit(value: number): Promise<void> {
    setIsDailyLimitSaving(true);
    setDailyLimitError("");
    try {
      const saved = await setDailyLimitSettingValue(value);
      setDailyLimit(saved);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'enregistrer la limite.";
      setDailyLimitError(`Erreur limite quotidienne: ${message}`);
      throw new Error(message);
    } finally {
      setIsDailyLimitSaving(false);
    }
  }

  async function clearDailyLimit(): Promise<void> {
    setIsDailyLimitSaving(true);
    setDailyLimitError("");
    try {
      const saved = await setDailyLimitSettingValue(null);
      setDailyLimit(saved);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de supprimer la limite.";
      setDailyLimitError(`Erreur limite quotidienne: ${message}`);
      throw new Error(message);
    } finally {
      setIsDailyLimitSaving(false);
    }
  }

  return (
    <section className="dashboard-next-page">
      <header className="dashboard-next-header">
        <div>
          <p className="dashboard-next-eyebrow">Beta</p>
          <h1>Nouveau dashboard</h1>
          <p className="dashboard-next-subtitle">
            Reference: {formatDateDDMMYYYY(query.today)} {isOnline ? "- En ligne" : "- Hors ligne"}
          </p>
        </div>
        <button type="button" className="secondary compact" onClick={query.refreshAll}>
          Rafraichir
        </button>
      </header>

      <section className="dashboard-next-card">
        <div className="dashboard-next-card-head">
          <h2>Bloc 1 - Paiements prevus + limite journaliere</h2>
        </div>

        {actionSuccess && <div className="dashboard-next-success">{actionSuccess}</div>}
        {actionError && !selectedPayment && (
          <div className="dashboard-next-warning">Erreur action: {actionError}</div>
        )}
        {dailyLimitGuard.alreadyOverNotice && (
          <div className="dashboard-next-warning">{dailyLimitGuard.alreadyOverNotice}</div>
        )}

        {block1Warnings.length > 0 && (
          <div className="dashboard-next-warning">
            Donnees possiblement anciennes: {block1Warnings.join(" | ")}
          </div>
        )}

        <div className="dashboard-next-grid">
          <article className="dashboard-next-panel">
            <h3>Paiements prevus aujourd&apos;hui</h3>
            {query.credits.data ? (
              query.credits.data.metrics.todayScheduled.length === 0 ? (
                <div className="dashboard-next-empty">Aucun credit prevu.</div>
              ) : (
                <ul className="dashboard-next-list">
                  {query.credits.data.metrics.todayScheduled.map((line) =>
                    renderCreditLine(line, { clickable: true, onClick: openPaymentActions })
                  )}
                </ul>
              )
            ) : query.credits.isLoading ? (
              <div className="dashboard-next-empty">Chargement...</div>
            ) : (
              <UnavailableState onRetry={query.refreshAll} />
            )}
          </article>

          <article className="dashboard-next-panel">
            <h3>Paiements prevus demain</h3>
            {query.credits.data ? (
              query.credits.data.metrics.tomorrowScheduled.length === 0 ? (
                <div className="dashboard-next-empty">Aucun credit prevu.</div>
              ) : (
                <ul className="dashboard-next-list">
                  {query.credits.data.metrics.tomorrowScheduled.map((line) =>
                    renderCreditLine(line, { clickable: true, onClick: openPaymentActions })
                  )}
                </ul>
              )
            ) : query.credits.isLoading ? (
              <div className="dashboard-next-empty">Chargement...</div>
            ) : (
              <UnavailableState onRetry={query.refreshAll} />
            )}
          </article>
        </div>

        <article className="dashboard-next-panel">
          <div className="dashboard-next-panel-head">
            <h3>Depense du jour vs limite</h3>
            <button
              type="button"
              className="settings-btn"
              onClick={() => {
                setIsDailyLimitOpen(true);
                void reloadDailyLimitSetting();
              }}
              aria-label="Parametres limite quotidienne"
            >
              Param.
            </button>
          </div>

          {dailyLimitError && (
            <div className="dashboard-next-warning">{dailyLimitError}</div>
          )}

          {isDailyLimitLoading ? (
            <div className="dashboard-next-empty">Chargement de la limite...</div>
          ) : dailyUsage.kind === "unavailable" ? (
            <UnavailableState onRetry={query.refreshAll} />
          ) : dailyUsage.kind === "limit_unset" ? (
            <div className="dashboard-next-limit-empty">
              <p>Limite non definie.</p>
              <p>Paye aujourd&apos;hui: {formatAmount(dailyUsage.spent)}</p>
            </div>
          ) : (
            <div className="dashboard-next-progress-wrap">
              <p>
                Paye aujourd&apos;hui: <strong>{formatAmount(dailyUsage.spent)}</strong> /{" "}
                {formatAmount(dailyUsage.limit)}
              </p>
              <p>
                Pourcentage: <strong>{formatAmount(dailyUsage.percentage)}%</strong>{" "}
                {dailyUsage.isOverLimit ? "(depassement)" : ""}
              </p>
              <div className="dashboard-next-progress-track" aria-hidden="true">
                <div
                  className={`dashboard-next-progress-fill ${dailyUsage.isOverLimit ? "over" : ""}`}
                  style={{ width: `${Math.min(100, Math.max(0, dailyUsage.percentage))}%` }}
                />
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-next-card">
        <div className="dashboard-next-card-head">
          <h2>Bloc 2 - Recette / Cash / Credits</h2>
          <button
            type="button"
            className="settings-btn"
            onClick={() => setIsModeOpen(true)}
            aria-label="Parametres mode bloc 2"
          >
            Param.
          </button>
        </div>

        {block2Warnings.length > 0 && (
          <div className="dashboard-next-warning">
            Donnees possiblement anciennes: {block2Warnings.join(" | ")}
          </div>
        )}

        <div className="dashboard-next-kpi-grid">
          <article className="dashboard-next-kpi">
            <span>{mode === "WEEK" ? "Recette hebdomadaire" : "Recette mensuelle"}</span>
            {query.period.data ? (
              <strong>{formatAmount(query.period.data.revenue)}</strong>
            ) : query.period.isLoading ? (
              <strong>...</strong>
            ) : (
              <strong>Indisponible</strong>
            )}
          </article>

          <article className="dashboard-next-kpi">
            <span>{mode === "WEEK" ? "Cash net hebdomadaire" : "Cash net mensuel"}</span>
            {query.period.data ? (
              <strong>{formatAmount(query.period.data.netCash)}</strong>
            ) : query.period.isLoading ? (
              <strong>...</strong>
            ) : (
              <strong>Indisponible</strong>
            )}
          </article>

          <article className="dashboard-next-kpi">
            <span>Somme credits restants</span>
            {query.credits.data ? (
              <strong>{formatAmount(query.credits.data.metrics.totalRemaining)}</strong>
            ) : query.credits.isLoading ? (
              <strong>...</strong>
            ) : (
              <strong>Indisponible</strong>
            )}
          </article>

          <article className="dashboard-next-kpi">
            <span>Somme paiements en retard</span>
            {query.credits.data ? (
              <strong>{formatAmount(query.credits.data.metrics.totalOverdue)}</strong>
            ) : query.credits.isLoading ? (
              <strong>...</strong>
            ) : (
              <strong>Indisponible</strong>
            )}
          </article>
        </div>

        <article className="dashboard-next-panel">
          <h3>Detail des credits en retard</h3>
          {query.credits.data ? (
            query.credits.data.metrics.overdueLines.length === 0 ? (
              <div className="dashboard-next-empty">Aucun credit en retard.</div>
            ) : (
              <ul className="dashboard-next-list">
                {query.credits.data.metrics.overdueLines.map((line) =>
                  renderCreditLine(line, { clickable: true, onClick: openPaymentActions })
                )}
              </ul>
            )
          ) : query.credits.isLoading ? (
            <div className="dashboard-next-empty">Chargement...</div>
          ) : (
            <UnavailableState onRetry={query.refreshAll} />
          )}
        </article>
      </section>

      {isDailyLimitOpen && (
        <DailyLimitModal
          currentValue={dailyLimit}
          isSaving={isDailyLimitSaving}
          onSave={saveDailyLimit}
          onClear={clearDailyLimit}
          onClose={() => setIsDailyLimitOpen(false)}
        />
      )}

      {isModeOpen && (
        <ModeModal
          currentMode={mode}
          onSave={setMode}
          onClose={() => setIsModeOpen(false)}
        />
      )}

      {selectedPayment && (
        <PaymentActionModal
          payment={selectedPayment}
          isOnline={isOnline}
          isSubmitting={isSubmittingAction}
          actionError={actionError}
          onClose={() => {
            setActionError("");
            setSelectedPayment(null);
          }}
          onSettleFull={() => {
            setActionError("");
            setSettleTarget(selectedPayment);
            setSelectedPayment(null);
          }}
          onPartialPay={() => {
            setPartialTarget(selectedPayment);
            setSelectedPayment(null);
          }}
        />
      )}

      {settleTarget && (
        <SettleCreditModal
          title={`Regler le credit #${settleTarget.id}`}
          description={`Fournisseur: ${settleTarget.supplier}`}
          defaultDate={todayLocalDate()}
          isSubmitting={isSubmittingAction}
          error={actionError}
          onCancel={() => {
            setActionError("");
            setSettleTarget(null);
          }}
          onConfirm={handleSettleFull}
        />
      )}

      {partialTarget && (
        <PartialPaymentModal
          payment={partialTarget}
          onClose={() => setPartialTarget(null)}
          onBeforeSubmit={(partialAmount, referenceDate) =>
            dailyLimitGuard.requestApproval(partialAmount, referenceDate)
          }
          onSubmit={(payload) => partialCreditPayment(partialTarget.id, payload)}
          onSuccess={(result) => {
            setActionSuccess(`${result.message} - restant ${formatAmount(result.remaining_amount)}`);
            setPartialTarget(null);
            query.refreshAll();
          }}
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
