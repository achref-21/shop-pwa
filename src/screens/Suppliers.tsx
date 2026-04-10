import { TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SupplierDialog from "../components/SupplierDialog";
import SupplierAvatar from "@/components/SupplierAvatar";
import "./Suppliers.css";
import {
  createSupplier,
  deleteSupplier as apiDeleteSupplier,
  getSuppliersWithCredit,
  updateSupplier,
} from "@/api/suppliers";
import { formatAmount } from "@/utils/paymentDisplay";

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
  const [searchValue, setSearchValue] = useState("");

  const refreshSuppliers = useCallback(async () => {
    const data = await getSuppliersWithCredit();
    setSuppliers(data);
    const total = data.reduce((sum, supplier) => sum + supplier.credit_total, 0);
    setTotalCredit(total);
  }, []);

  useEffect(() => {
    refreshSuppliers().catch(console.error);
  }, [refreshSuppliers]);

  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  const filteredSuppliers = useMemo(() => {
    if (!normalizedSearch) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      supplier.name.toLocaleLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, suppliers]);

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

    await refreshSuppliers();
    setSelectedIds([]);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSupplier(null);
  }

  return (
    <section className="suppliers-page">
      <div className="top-bar">
        <div className="card totals-card">
          <span className="card-eyebrow">CREDIT OUVERT</span>
          <strong className="total-amount">{formatAmount(totalCredit)}</strong>
        </div>


      </div>

      <div className="card suppliers-card">
        <div className="suppliers-header">
          <h2>Fournisseurs</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <button type="button" className="primary" style={{ marginLeft: 'auto' }} onClick={openAddDialog}>
            Ajouter
          </button>
          <span className="suppliers-count">{filteredSuppliers.length}</span>
          </div>
        </div>

        <TextInput
          className="supplier-search"
          aria-label="Rechercher un fournisseur"
          leftSection={<IconSearch size={16} stroke={1.8} aria-hidden="true" />}
          placeholder="Rechercher un fournisseur…"
          value={searchValue}
          onChange={(event) => setSearchValue(event.currentTarget.value)}
        />

        <div className="suppliers-list" role="list" aria-label="Liste des fournisseurs">
          {filteredSuppliers.length === 0 ? (
            <p className="suppliers-empty">Aucun fournisseur enregistré.</p>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className={`supplier-item ${selectedIds.includes(supplier.id) ? "is-selected" : ""}`}
                role="listitem"
              >
                <div className="supplier-main">
                  <SupplierAvatar name={supplier.name} size={40} />
                  <strong>{supplier.name}</strong>
                </div>

                <span
                  className={`supplier-credit ${supplier.credit_total === 0 ? "is-zero" : ""}`}
                >
                  {formatAmount(supplier.credit_total)}
                </span>

                <input
                  className="supplier-select"
                  type="checkbox"
                  checked={selectedIds.includes(supplier.id)}
                  onChange={() => toggleSelection(supplier.id)}
                  aria-label={`Selectionner ${supplier.name}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="action-bar">
        <p className="selection-hint">{selectedIds.length} selectionne(s)</p>
        <div className="action-buttons">
          <button
            className="secondary"
            type="button"
            disabled={selectedIds.length !== 1}
            onClick={openEditDialog}
          >
            Modifier
          </button>

          <button
            className="danger"
            type="button"
            disabled={selectedIds.length === 0}
            onClick={deleteSelected}
          >
            Supprimer
          </button>
        </div>
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

            await refreshSuppliers();
            closeDialog();
          }}
        />
      )}
    </section>
  );
}
