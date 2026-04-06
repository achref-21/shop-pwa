import { type FormEvent, useEffect, useState } from "react";
import { todayLocalDate } from "@/utils/localDate";
import "./SettleCreditModal.css";

type Props = {
  title: string;
  description?: string;
  confirmLabel?: string;
  defaultDate?: string;
  isSubmitting?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (date: string) => Promise<void> | void;
};

export default function SettleCreditModal({
  title,
  description,
  confirmLabel = "Valider le reglement",
  defaultDate,
  isSubmitting = false,
  error = "",
  onCancel,
  onConfirm,
}: Props) {
  const [date, setDate] = useState(defaultDate || todayLocalDate());
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDate(defaultDate || todayLocalDate());
    setLocalError("");
  }, [defaultDate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setLocalError("Saisissez une date de reglement.");
      return;
    }
    setLocalError("");
    await onConfirm(date);
  }

  return (
    <div className="settle-credit-modal-backdrop" role="dialog" aria-modal="true">
      <div className="settle-credit-modal">
        <h2>{title}</h2>
        {description && <p className="settle-credit-modal-description">{description}</p>}

        <form className="settle-credit-form" onSubmit={handleSubmit}>
          <label htmlFor="settle-credit-date">
            Date de reglement
            <input
              id="settle-credit-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </label>

          {(localError || error) && (
            <p className="settle-credit-modal-error">{localError || error}</p>
          )}

          <div className="settle-credit-actions">
            <button
              type="submit"
              className="settle-credit-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Traitement..." : confirmLabel}
            </button>
            <button
              type="button"
              className="settle-credit-cancel"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
