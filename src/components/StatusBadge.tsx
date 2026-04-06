type StatusBadgeStatus =
  | "DIRECT_PAID"
  | "CREDIT_OPEN"
  | "CREDIT_SETTLED"
  | "CREDIT_PARTIAL_PAYMENT"
  | "OVERDUE"
  | "CANCELLED";

interface StatusBadgeProps {
  status: StatusBadgeStatus;
}

const STATUS_CONFIG: Record<
  StatusBadgeStatus,
  { label: string; textColor: string; backgroundColor: string }
> = {
    DIRECT_PAID: {
    label: "Payé",
    textColor: "var(--color-paid)",
    backgroundColor: "rgba(42, 157, 143, 0.12)",
  },
  CREDIT_OPEN: {
    label: "Crédit ouvert",
    textColor: "var(--color-credit)",
    backgroundColor: "rgba(233, 168, 76, 0.12)",
  },
  CREDIT_SETTLED: {
    label: "Soldé",
    textColor: "var(--color-settled)",
    backgroundColor: "rgba(138, 143, 158, 0.12)",
  },
  CREDIT_PARTIAL_PAYMENT: {
    label: "Paiement partiel",
    textColor: "var(--color-paid)",
    backgroundColor: "rgba(42, 157, 143, 0.12)",
  },
  OVERDUE: {
    label: "En retard",
    textColor: "var(--color-danger)",
    backgroundColor: "rgba(230, 57, 70, 0.12)",
  },
  CANCELLED: {
    label: "Annulé",
    textColor: "var(--color-text-muted)",
    backgroundColor: "rgba(138, 143, 158, 0.12)",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        lineHeight: 1.2,
        color: config.textColor,
        backgroundColor: config.backgroundColor,
      }}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
