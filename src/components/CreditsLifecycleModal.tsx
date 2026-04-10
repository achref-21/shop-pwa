import { useCallback, useEffect, useMemo, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import {
  getCreditsLifecycle,
  type CreditLifecycleStatus,
  type PeriodCreditLifecycleItem,
} from "@/api/summary";
import { formatAmount, formatDateDDMMYYYY } from "@/utils/paymentDisplay";
import { todayLocalDate } from "@/utils/localDate";
import "./CreditsLifecycleModal.css";

type Props = {
  startDate: string;
  endDate: string;
  mode: "WEEK" | "MONTH";
  onClose: () => void;
};

type StatusFilter = "ALL" | CreditLifecycleStatus;

const STATUS_LABELS: Record<CreditLifecycleStatus, string> = {
  OPEN: "Ouvert",
  SETTLED: "Regle",
  OVERDUE: "En retard",
  DUE_SOON: "Echeance proche",
};

function formatDueInDays(value: number | null): string {
  if (value === null) {
    return "Sans echeance";
  }

  if (value > 0) {
    return `Dans ${value}j`;
  }

  if (value === 0) {
    return "Echeance aujourd'hui";
  }

  return `Retard ${Math.abs(value)}j`;
}

function getStatusBadge(
  row: PeriodCreditLifecycleItem
): { label: string; tone: "success" | "warning" | "danger" | "info"; emphasize?: boolean } {
  if (row.status === "SETTLED") {
    return { label: STATUS_LABELS[row.status], tone: "success" };
  }

  if (row.status === "OVERDUE") {
    return { label: STATUS_LABELS[row.status], tone: "danger" };
  }

  if (row.status === "DUE_SOON") {
    if (row.due_in_days === 0) {
      return { label: "Echeance aujourd'hui", tone: "warning", emphasize: true };
    }

    if (typeof row.due_in_days === "number" && row.due_in_days > 0) {
      return { label: `Echeance proche (Dans ${row.due_in_days}j)`, tone: "warning" };
    }

    return { label: STATUS_LABELS[row.status], tone: "warning" };
  }

  return { label: STATUS_LABELS[row.status], tone: "info" };
}

export default function CreditsLifecycleModal({ startDate, endDate, mode, onClose }: Props) {
  const isOnline = useOnline();

  const [asOfDate] = useState(() => todayLocalDate());
  const [rows, setRows] = useState<PeriodCreditLifecycleItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [supplierFilter, setSupplierFilter] = useState("");

  const fetchLifecycle = useCallback(
    () => getCreditsLifecycle(startDate, endDate, asOfDate, mode),
    [asOfDate, endDate, mode, startDate]
  );

  const lifecycleData = useDateAwareCachedData({
    isOnline,
    dateKey: `credits_lifecycle_${mode}_${startDate}_${endDate}_${asOfDate}_${reloadToken}`,
    fetchData: fetchLifecycle,
  });

  useEffect(() => {
    if (lifecycleData.data) {
      setRows(lifecycleData.data.credits);
      setLoadError("");
      return;
    }

    if (lifecycleData.error) {
      setRows([]);
      setLoadError(lifecycleData.error.message);
    }
  }, [lifecycleData.data, lifecycleData.error]);

  const filteredRows = useMemo(() => {
    const normalizedSupplierFilter = supplierFilter.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) {
        return false;
      }

      if (!normalizedSupplierFilter) {
        return true;
      }

      return row.supplier.toLowerCase().includes(normalizedSupplierFilter);
    });
  }, [rows, statusFilter, supplierFilter]);

  return (
    <div className="modal-backdrop">
      <div className="modal large lifecycle-modal">
        <h2>
          Cycle des credits - {startDate} {"->"} {endDate}
        </h2>

        <div className="lifecycle-filters">
          <label>
            Statut
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">Tous</option>
              <option value="OPEN">Ouvert</option>
              <option value="SETTLED">Regle</option>
              <option value="OVERDUE">En retard</option>
              <option value="DUE_SOON">Echeance proche</option>
            </select>
          </label>

          <label>
            Fournisseur
            <input
              type="text"
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              placeholder="Filtrer par nom"
            />
          </label>
        </div>

        {loadError && (
          <div className="lifecycle-error">
            <span>Erreur: {loadError}</span>
            <button className="secondary compact" onClick={() => setReloadToken((value) => value + 1)}>
              Reessayer
            </button>
          </div>
        )}

        {lifecycleData.isLoading && rows.length === 0 ? (
          <div className="lifecycle-empty">Chargement...</div>
        ) : !loadError && filteredRows.length === 0 ? (
          <div className="lifecycle-empty">Aucun credit pour cette periode.</div>
        ) : (
          <div className="lifecycle-list">
            {filteredRows.map((row) => {
              const badge = getStatusBadge(row);
              const isSettled = row.status === "SETTLED";

              return (
                <div className="lifecycle-item" key={row.credit_payment_id}>
                  <div className="lifecycle-item-head">
                    <strong>{row.supplier}</strong>
                    <span
                      className={`badge lifecycle-status ${badge.tone} ${badge.emphasize ? "emphasis" : ""}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="lifecycle-item-core">
                    <span>Credit #{row.credit_payment_id}</span>
                    <span>Montant original: {formatAmount(row.original_credit_amount)}</span>
                  </div>

                  <div className="lifecycle-item-details">
                    {!isSettled && row.expected_payment_date && (
                      <span>Prevu le: {formatDateDDMMYYYY(row.expected_payment_date)}</span>
                    )}
                    {!isSettled && <span>Delai: {formatDueInDays(row.due_in_days)}</span>}
                    {isSettled && row.credit_settled_date && (
                      <span>Regle le: {formatDateDDMMYYYY(row.credit_settled_date)}</span>
                    )}
                    {row.paid_before_start > 0 && (
                      <span>Paye avant debut: {formatAmount(row.paid_before_start)}</span>
                    )}
                    {row.paid_in_period > 0 && (
                      <span>Paye dans la periode: {formatAmount(row.paid_in_period)}</span>
                    )}
                    {!isSettled && (
                      <span>Restant fin periode: {formatAmount(row.remaining_as_of_end)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button className="secondary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
