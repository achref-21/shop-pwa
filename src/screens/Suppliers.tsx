import { useEffect, useState } from "react";
import SupplierDialog from "../components/SupplierDialog";
import "./Suppliers.css";
import {
  createSupplier,
  deleteSupplier as apiDeleteSupplier,
  getSuppliersWithCredit,
  updateSupplier,
} from "@/api/suppliers";

type Supplier = {
  id: number;
  name: string;
  phone?: string;
  credit_total: number;
  notes?: string;
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    getSuppliersWithCredit()
      .then((data) => {
        setSuppliers(data);
        const total = data.reduce((sum, supplier) => sum + supplier.credit_total, 0);
        setTotalCredit(total);
      })
      .catch(console.error);
  }, []);

  function toggleSelection(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function openAddDialog() {
    setEditingSupplier(null);
    setDialogOpen(true);
  }

  function openEditDialog() {
    if (selectedIds.length !== 1) return;
    const supplier = suppliers.find((row) => row.id === selectedIds[0]) || null;
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }

  async function deleteSelected() {
    for (const id of selectedIds) {
      const confirmed = window.confirm(
        "Supprimer ce fournisseur ?\nLes paiements associes seront aussi supprimes."
      );
      if (!confirmed) continue;
      await apiDeleteSupplier(id);
    }

    const refreshed = await getSuppliersWithCredit();
    setSuppliers(refreshed);
    const total = refreshed.reduce((sum, supplier) => sum + supplier.credit_total, 0);
    setTotalCredit(total);
    setSelectedIds([]);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSupplier(null);
  }

  return (
    <section className="suppliers-page">
      <div className="top-bar">
        <div className="totals-card">
          <div className="total credit">
            <span>Credit en cours</span>
            <strong>{totalCredit.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Ajouter un fournisseur</h2>

        <div className="form-actions">
          <button className="primary" onClick={openAddDialog}>
            Ajouter
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Fournisseurs avec credit en cours</h2>

        <div className="suppliers-list">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="supplier-item">
              <input
                type="checkbox"
                checked={selectedIds.includes(supplier.id)}
                onChange={() => toggleSelection(supplier.id)}
              />

              <div className="supplier-main">
                <strong>{supplier.name}</strong>
              </div>

              <div className="supplier-meta">
                {supplier.phone && <span className="phone">{supplier.phone}</span>}
                {supplier.notes && <span className="notes">{supplier.notes}</span>}
                <span className="credit">{supplier.credit_total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
            const total = refreshed.reduce((sum, supplier) => sum + supplier.credit_total, 0);
            setTotalCredit(total);
            closeDialog();
          }}
        />
      )}
    </section>
  );
}
