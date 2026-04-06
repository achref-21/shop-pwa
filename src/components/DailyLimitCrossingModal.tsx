import type { DailyLimitEvaluationResult } from "@/services/dailyLimit";
import { formatAmount } from "@/utils/paymentDisplay";
import "./DailyLimitCrossingModal.css";

type Props = {
  evaluation: DailyLimitEvaluationResult;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DailyLimitCrossingModal({
  evaluation,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-limit-crossing-title"
    >
      <div className="modal daily-limit-crossing-modal">
        <h2 id="daily-limit-crossing-title">Attention: depassement de limite quotidienne</h2>
        <p className="daily-limit-crossing-text">
          Vous allez depasser la limite quotidienne pour le {evaluation.date}.
        </p>

        <div className="daily-limit-crossing-summary">
          <p>
            Depense du jour: <strong>{formatAmount(evaluation.todaySpent)}</strong>
          </p>
          <p>
            Limite quotidienne: <strong>{formatAmount(evaluation.dailyLimit)}</strong>
          </p>
          <p>
            Depense projetee: <strong>{formatAmount(evaluation.projectedSpent)}</strong>
          </p>
        </div>

        <div className="daily-limit-crossing-actions">
          <button type="button" className="primary" onClick={onConfirm}>
            Confirmer quand meme
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
