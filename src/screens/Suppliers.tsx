import { useEffect, useState } from "react";
import SupplierDialog from "../components/SupplierDialog";
import "./Suppliers.css";

import {
  getSuppliersWithCredit,
  deleteSupplier as apiDeleteSupplier,
  updateSupplier,
  createSupplier,
} from "@/api/suppliers";


type Supplier = {
  id: number;
  name: string;
  phone?: string;
  credit_total: number;
  notes?: string;
};


export default function Suppliers() {
  /* ─────────────────────────────
     State
  ───────────────────────────── */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);


  useEffect(() => {
    getSuppliersWithCredit()
      .then((data) => {
        setSuppliers(data);
        const total = data.reduce((sum, s) => sum + s.credit_total, 0);
        setTotalCredit(total);
      })
      .catch(console.error);
  }, []);


  /* ─────────────────────────────
     Handlers
  ───────────────────────────── */
  function toggleSelection(id: number) {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  function openAddDialog() {
    setEditingSupplier(null);
    setDialogOpen(true);
  }

  function openEditDialog() {
    if (selectedIds.length !== 1) return;
    const supplier = suppliers.find(s => s.id === selectedIds[0]) || null;
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }

  async function deleteSelected() {
    for (const id of selectedIds) {
      const confirmed = window.confirm(
        "Supprimer ce fournisseur ?\nLes paiements associés seront aussi supprimés."
      );
      if (!confirmed) continue;
      await apiDeleteSupplier(id);
    }

    const refreshed = await getSuppliersWithCredit();
    setSuppliers(refreshed);
    const total = refreshed.reduce((sum, s) => sum + s.credit_total, 0);
    setTotalCredit(total);
    setSelectedIds([]);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSupplier(null);
  }

  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  return (
    <section className="suppliers-page">

      {/* ───────────────── Top Bar ───────────────── */}
      <div className="top-bar">
        <div className="totals-card">
          <div className="total credit">
            <span>Crédit dû</span>
            <strong>{totalCredit.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* ───────────────── Form Card ───────────────── */}
      <div className="card">
        <h2>Ajouter un fournisseur</h2>

        <div className="form-actions">
          <button className="primary" onClick={openAddDialog}>
            Ajouter
          </button>
        </div>
      </div>

      {/* ───────────────── Suppliers List ───────────────── */}
      <div className="card">
        <h2>Fournisseurs</h2>

        <div className="suppliers-list">
          {suppliers.map(s => (
            <div
              key={s.id}
              className="supplier-item"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggleSelection(s.id)}
              />

              <div className="supplier-main">
                <strong>{s.name}</strong>
              </div>

              <div className="supplier-meta">
                {s.phone && <span className="phone">{s.phone}</span>}
                {s.notes && <span className="notes">{s.notes}</span>}
                <span className="credit">
                  {s.credit_total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────── Sticky Action Bar ───────────────── */}
      <div className="action-bar">
        <button
          className="secondary"
          disabled={selectedIds.length !== 1}
          onClick={openEditDialog}
        >
          Modifier
        </button>

        <button
          className="danger"
          disabled={selectedIds.length === 0}
          onClick={deleteSelected}
        >
          Supprimer
        </button>
      </div>

      {/* ───────── Dialog ───────── */}
      {dialogOpen && (
        <SupplierDialog
          supplier={
            editingSupplier
              ? {
                  id: editingSupplier.id,
                  name: editingSupplier.name,
                  phone: editingSupplier.phone ?? "",
                  notes: editingSupplier.notes ?? "",
                }
              : null
          }
          onClose={closeDialog}
          onSave={async (data) => {
            if (editingSupplier) {
              await updateSupplier(editingSupplier.id, data);
            } else {
              await createSupplier(data);
            }

            const refreshed = await getSuppliersWithCredit();
            setSuppliers(refreshed);
            const total = refreshed.reduce((sum, s) => sum + s.credit_total, 0);
            setTotalCredit(total);
            closeDialog();
          }}
        />
      )}

    </section>
  );
}
