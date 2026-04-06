import { type FormEvent, useEffect, useState } from "react";
import type { PartialCreditPaymentResponse, Payment } from "@/api/payments";
import {
  formatAmount,
  getRemainingAmount,
  todayIsoDate,
} from "@/utils/paymentDisplay";
import "./PartialPaymentModal.css";

type PartialPaymentPayload = {
  amount: number;
  date?: string;
  note?: string;
};

type Props = {
  payment: Payment;
  onClose: () => void;
  onSubmit: (payload: PartialPaymentPayload) => Promise<PartialCreditPaymentResponse>;
  onSuccess?: (result: PartialCreditPaymentResponse) => void;
  onBeforeSubmit?: (amount: number, referenceDate: string) => Promise<boolean>;
};

export default function PartialPaymentModal({
  payment,
  onClose,
  onSubmit,
  onSuccess,
  onBeforeSubmit,
}: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<PartialCreditPaymentResponse | null>(null);

  useEffect(() => {
    const remaining = getRemainingAmount(payment);
    if (remaining !== null && remaining > 0) {
      setAmount(String(remaining));
    }
  }, [payment]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Le montant doit etre superieur a 0.");
      return;
    }

    if (onBeforeSubmit) {
      const referenceDate = date || todayIsoDate();
      const approved = await onBeforeSubmit(parsedAmount, referenceDate);
      if (!approved) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        amount: parsedAmount,
        date: date || undefined,
        note: note.trim() || undefined,
      });
      setSuccess(result);
      onSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="partial-payment-backdrop" role="dialog" aria-modal="true">
      <div className="partial-payment-modal">
        <h2>Payer une partie du credit</h2>

        <p className="partial-payment-subtitle">
          Montant restant actuel: <strong>{formatAmount(getRemainingAmount(payment))}</strong>
        </p>

        <form className="partial-payment-form" onSubmit={handleSubmit}>
          <label htmlFor="partial-payment-amount">
            Montant
            <input
              id="partial-payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting || Boolean(success)}
            />
          </label>

          <label htmlFor="partial-payment-date">
            Date
            <input
              id="partial-payment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={isSubmitting || Boolean(success)}
            />
          </label>

          <label htmlFor="partial-payment-note">
            Note (optionnel)
            <input
              id="partial-payment-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isSubmitting || Boolean(success)}
            />
          </label>

          {error && <p className="partial-payment-error">{error}</p>}

          {success && (
            <p className="partial-payment-success">
              {success.message} - Restant: {formatAmount(success.remaining_amount)}{" "}
              {success.is_fully_settled ? "(credit solde)" : "(credit encore ouvert)"}
            </p>
          )}

          <div className="partial-payment-actions">
            <button
              type="submit"
              className="partial-payment-submit"
              disabled={isSubmitting || Boolean(success)}
            >
              {isSubmitting ? "Enregistrement..." : "Confirmer"}
            </button>
            <button
              type="button"
              className="partial-payment-cancel"
              onClick={onClose}
            >
              {success ? "Fermer" : "Annuler"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
