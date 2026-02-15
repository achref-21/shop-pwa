import { useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import {
  searchPayments,
  settleCredit,
  isDateRangeWithinCache,
  type Payment,
} from "@/api/payments";
import { getSuppliers, type Supplier } from "@/api/suppliers";
import "./PaymentsSearch.css";

function formatStatus(status: string) {
  return status === "PAID"
    ? "Payé"
    : status === "CREDIT"
    ? "Crédit"
    : status;
}

function parseStatus(display: string): "PAID" | "CREDIT" | undefined {
  if (display === "Payé") return "PAID";
  if (display === "Crédit") return "CREDIT";
  return undefined;
}

/**
 * Format ISO date (YYYY-MM-DD) to DD/MM/YYYY
 */
function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function isOverdue(payment: Payment) {
  if (
    payment.status !== "CREDIT" ||
    !payment.expected_payment_date
  )
    return false;

  return new Date(payment.expected_payment_date) < new Date();
}

export default function PaymentsSearch() {
  const isOnline = useOnline();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string>("");
  const [cacheWarning, setCacheWarning] = useState<string>("");

  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [status, setStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Track last searched filter combination to detect changes
  const [lastSearchedFilters, setLastSearchedFilters] = useState<string>("");

  // Clear stale data when any filter changes while offline
  const currentFilterString = `${supplierId}_${status}_${startDate}_${endDate}_${overdueOnly}`;
  
  useEffect(() => {
    if (!isOnline && lastSearchedFilters && lastSearchedFilters !== currentFilterString) {
      setPayments([]);
      setLoadError("Les filtres ont changé. Cliquez sur Rechercher pour charger les résultats.");
    }
  }, [currentFilterString, lastSearchedFilters, isOnline]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
  }, []);

  // Auto-trigger initial search on component mount
  useEffect(() => {
    handleSearch();
  }, []);

  async function handleSearch() {
    try {
      setLoadError("");
      setCacheWarning("");

      // Check if date range is within cached 90-day window (show warning if offline)
      if (!isOnline && !isDateRangeWithinCache(startDate, endDate)) {
        setCacheWarning(
          "Attention : Les résultats peuvent être incomplets. Seules les données des 90 derniers jours sont disponibles hors ligne."
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
    } catch (err) {
      setPayments([]);
      setSelectedIds([]);
      setCacheWarning("");
      setLoadError(
        err instanceof Error ? err.message : "Erreur lors de la recherche"
      );
    }
  }

  function toggleSelection(id: number) {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  async function handleSettle() {
    if (selectedIds.length === 0) return;

    // Get all selected payments
    const selectedPayments = payments.filter(p => selectedIds.includes(p.id));

    // Check if any are PAID (not CREDIT)
    const paidPayments = selectedPayments.filter(p => p.status !== "CREDIT");
    if (paidPayments.length > 0) {
      alert(
        `⚠️ Impossible de régler les paiements\n\n${paidPayments.length} paiement(s) sélectionné(s) n'est/ne sont pas des crédits.\n\nVeuillez sélectionner uniquement des crédits.`
      );
      return;
    }

    // All are CREDIT - prepare confirmation
    const creditPayments = selectedPayments.filter(p => p.status === "CREDIT");
    const totalAmount = creditPayments.reduce((sum, p) => sum + p.amount, 0);

    const confirmMessage =
      creditPayments.length === 1
        ? `Régler ce crédit ?\n\nFournisseur: ${creditPayments[0].supplier}\nMontant: ${creditPayments[0].amount.toFixed(2)}`
        : `Régler ${creditPayments.length} crédits ?\n\nMontant total: ${totalAmount.toFixed(2)}`;

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    try {
      // Settle all selected credits
      await Promise.all(
        creditPayments.map(p => settleCredit(p.id))
      );

      // Refresh data and clear selection
      await handleSearch();
      setSelectedIds([]);

      // Success message
      alert(
        creditPayments.length === 1
          ? "Crédit réglé avec succès"
          : `${creditPayments.length} crédits réglés avec succès`
      );
    } catch (err) {
      alert(
        `Erreur lors du règlement : ${
          err instanceof Error ? err.message : "Erreur inconnue"
        }`
      );
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

      {/* ───────────────── Filters Card ───────────────── */}
      <div className="card">
        <div className="filters-header">
          <h2>Filtres</h2>
          <button 
            className="collapse-button"
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            title={isFiltersCollapsed ? "Afficher les filtres" : "Masquer les filtres"}
          >
            {isFiltersCollapsed ? "▼" : "▲"}
          </button>
        </div>

        {!isFiltersCollapsed && <div className="filters-grid">
          <div className="filter-field">
            <label>Fournisseur</label>
            <select
              value={supplierId ?? ""}
              onChange={e =>
                setSupplierId(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            >
              <option value="">Tous</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Statut</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">Tous</option>
              <option>Payé</option>
              <option>Crédit</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Dates prévues de paiement<br/><small>(crédits seulement)</small></label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label>Date fin<br/><small>(crédits seulement)</small></label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <div className="filter-field checkbox-field">
            <label>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={e => setOverdueOnly(e.target.checked)}
              />
              <span>En retard seulement</span>
            </label>
          </div>
        </div>}

        {/* Filter Actions */}
        <div className="filter-actions">
          <button className="primary" onClick={handleSearch}>
            🔍 Rechercher
          </button>
          <button className="secondary" onClick={resetFilters}>
            ↺ Réinitialiser
          </button>
        </div>
      </div>

      {/* ───────────────── Results Card ───────────────── */}
      <div className="card">
        <h2>Résultats ({payments.length})</h2>

        {cacheWarning && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fef3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            color: "#856404",
            fontSize: "0.9rem"
          }}>
            ⚠️ {cacheWarning}
          </div>
        )}

        {loadError && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.9rem"
          }}>
            ⚠️ {loadError}
          </div>
        )}

        <div className="payments-list">
          {payments.length === 0 && !loadError ? (
            <div className="empty-state">
              Aucun résultat
            </div>
          ) : (
            payments.map(p => (
              <div
                key={p.id}
                className={`payment-item ${p.status.toLowerCase()} ${
                  isOverdue(p) ? "overdue" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleSelection(p.id)}
                />

                <div className="payment-main">
                  <div className="payment-info">
                    <strong>{p.supplier}</strong>
                  </div>
                  <div className="payment-amount">
                    {p.amount.toFixed(2)}
                  </div>
                </div>

                <div className="payment-meta">
                  <span className="badge">
                    {formatStatus(p.status)}
                  </span>
                  {p.status === "PAID" ? (
                    <span className="paid-date">
                      Payé le {formatDateDDMMYYYY(p.date)}
                    </span>
                  ) : (
                    p.expected_payment_date && (
                      <span className="expected-date">
                        {formatDateDDMMYYYY(p.expected_payment_date)}
                      </span>
                    )
                  )}
                  {isOverdue(p) && (
                    <span className="overdue-badge">En retard</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ───────────────── Sticky Action Bar ───────────────── */}
      <div className="action-bar">
        <button
          className="primary"
          disabled={selectedIds.length === 0}
          onClick={handleSettle}
        >
          {selectedIds.length === 0
            ? "Régler le crédit"
            : selectedIds.length === 1
            ? "Régler 1 crédit"
            : `Régler ${selectedIds.length} crédits`}
        </button>
      </div>

    </section>
  );
}
