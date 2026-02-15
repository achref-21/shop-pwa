import { useState } from "react";
import "./SupplierDialog.css";

export type SupplierFormData = {
  name: string;
  phone: string;
  notes: string;
};

export type SupplierDialogSupplier = {
  id: number;
  name: string;
  phone: string;
  notes: string;
};


type Props = {
  supplier: SupplierDialogSupplier | null;
  onClose: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
};


export default function SupplierDialog({ supplier, onClose, onSave }: Props) {

  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  async function save() {
  if (!name.trim()) return;

  await onSave({
    name,
    phone,
    notes,
  });
}

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>
          {supplier ? "Modifier le fournisseur" : "Ajouter un fournisseur"}
        </h2>

        <div className="modal-form">
          <label>
            Nom
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>
            Téléphone
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </label>

          <label>
            Notes
            <input value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={save}>
            Enregistrer
          </button>
          <button className="secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
