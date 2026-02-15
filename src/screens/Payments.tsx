import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import "./Payments.css";
import {
  getPaymentsByDate,
  createPayment,
  updatePayment,
  deletePayment,
  settleCredit,
} from "@/api/payments";
import { getSuppliers } from "@/api/suppliers";
import type { Payment } from "@/api/payments";



type PaymentStatus = "PAID" | "CREDIT" | "INSTALLMENTS";


export default function PaymentsSearch() {
  /* ─────────────────────────────
     State
  ───────────────────────────── */
  const isOnline = useOnline();
  
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string>("");

  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);

  /* Form state */
  const [suppliers, setSuppliers] = useState<
  { id: number; name: string }[]
  >([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);  
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("PAID");
  const [note, setNote] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  // Memoize fetchData to prevent infinite loops
  const fetchPayments = useCallback(
    () => getPaymentsByDate(selectedDate),
    [selectedDate]
  );

  // Load payments with date-aware caching
  const paymentData = useDateAwareCachedData({
    isOnline,
    dateKey: selectedDate,
    fetchData: fetchPayments,
  });

  // Update UI when payment data changes
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

  // Load suppliers once
  useEffect(() => {
    getSuppliers()
      .then(setSuppliers)
      .catch(console.error);
  }, []);



  /* ─────────────────────────────
     Handlers (logic only)
  ───────────────────────────── */
  function resetForm() {
    setSupplierId(null);
    setAmount("");
    setStatus("PAID");
    setNote("");
    setExpectedDate("");
    setEditingPaymentId(null);
  }

  async function handleSubmit() {
  if (!supplierId) return;

  const payload = {
    supplier_id: supplierId,
    date: selectedDate,
    amount: Number(amount),
    status,
    note,
    expected_payment_date:
      status === "CREDIT" ? expectedDate : null,
  };

  try {
    if (editingPaymentId === null) {
      await createPayment(payload);
    } else {
      await updatePayment(editingPaymentId, payload);
    }

    resetForm();
    const res = await getPaymentsByDate(selectedDate);
    setPayments(res.payments);
    setTotalPaid(res.total_paid);
    setTotalCredit(res.total_credit);
  } catch (e) {
    console.error(e);
  }
}


  async function deleteSelected() {
  for (const id of selectedIds) {
    await deletePayment(id);
  }
  const res = await getPaymentsByDate(selectedDate);
  setPayments(res.payments);
  setTotalPaid(res.total_paid);
  setTotalCredit(res.total_credit);
  setSelectedIds([]);
}


  async function handleSettleCredit() {
  if (selectedIds.length !== 1) return;

  await settleCredit(selectedIds[0]);
  const res = await getPaymentsByDate(selectedDate);
  setPayments(res.payments);
  setTotalPaid(res.total_paid);
  setTotalCredit(res.total_credit);
}



  function toggleSelection(id: number) {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  return (
  <section className="payments-page">

    {/* ───────────────── Top Bar ───────────────── */}
    <div className="top-bar">
      <div className="date-control">
        <label>Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="totals-card">
        <div className="total paid">
          <span>Payé</span>
          <strong>{totalPaid.toFixed(2)}</strong>
        </div>
        <div className="total credit">
          <span>Crédit</span>
          <strong>{totalCredit.toFixed(2)}</strong>
        </div>
      </div>
    </div>

    {/* ───────────────── Form Card ───────────────── */}
    <div className="card">
      <h2>
        {editingPaymentId ? "Modifier un paiement" : "Ajouter un paiement"}
      </h2>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSubmit();
        }}
        className="form-grid"
      >
        {/* Supplier */}
        <div className="field">
          <label>Fournisseur</label>
          <select
            value={supplierId ?? ""}
            onChange={e =>
              setSupplierId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Sélectionner un fournisseur</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="field">
          <label>Montant</label>
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            type="number"
          />
        </div>

        {/* Status */}
        <div className="field">
          <label>Statut</label>
          <div className="segmented">
            <button
              type="button"
              className={status === "PAID" ? "active" : ""}
              onClick={() => setStatus("PAID")}
            >
              Payé
            </button>
            <button
              type="button"
              className={status === "CREDIT" ? "active" : ""}
              onClick={() => setStatus("CREDIT")}
            >
              Crédit
            </button>
          </div>
        </div>

        {/* Expected Date */}
        {status === "CREDIT" && (
          <div className="field">
            <label>Date prévue</label>
            <input
              type="date"
              value={expectedDate}
              onChange={e => setExpectedDate(e.target.value)}
            />
          </div>
        )}

        {/* Note */}
        <div className="field full">
          <label>Note</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="form-actions full">
          <button className="primary" type="submit">
            {editingPaymentId ? "Enregistrer" : "Ajouter"}
          </button>

          {editingPaymentId && (
            <button
              className="secondary"
              type="button"
              onClick={resetForm}
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>

    {/* ───────────────── Payments List ───────────────── */}
    <div className="card">
      <h2>Transactions</h2>

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
        {paymentData.isLoading && !payments.length && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
            Chargement...
          </div>
        )}

        {!paymentData.isLoading && payments.length === 0 && !loadError && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
            Aucune transaction pour cette date
          </div>
        )}

        {payments.map(p => (
          <div
            key={p.id}
            className={`payment-item ${p.status.toLowerCase()}`}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(p.id)}
              onChange={() => toggleSelection(p.id)}
            />

            <div className="payment-main">
              <strong>{p.supplier}</strong>
              <span className="amount">
                {p.amount.toFixed(2)}
              </span>
            </div>

            <div className="payment-meta">
              <span className="badge">
                {p.status === "PAID" ? "Payé" : "Crédit"}
              </span>
              {p.note && <span className="note">{p.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* ───────────────── Sticky Action Bar ───────────────── */}
    <div className="action-bar">
      <button
        className="secondary"
        disabled={selectedIds.length === 0}
        onClick={deleteSelected}
      >
        Supprimer
      </button>

      <button
        className="primary"
        disabled={selectedIds.length !== 1}
        onClick={handleSettleCredit}
      >
        Régler crédit
      </button>
    </div>

  </section>
);
}