import type { EntryType, Payment } from "@/api/payments";

export type PaymentLike = Pick<
  Payment,
  | "id"
  | "status"
  | "date"
  | "amount"
  | "entry_type"
  | "credit_payment_id"
  | "original_credit_amount"
  | "remaining_amount"
  | "credit_opened_date"
  | "credit_expected_payment_date"
  | "credit_settled_date"
  | "expected_payment_date"
>;

export type PaymentThread<T extends PaymentLike> = {
  key: string;
  creditRootId: number | null;
  root: T | null;
  items: T[];
  hasRoot: boolean;
  isSettled: boolean;
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  CREDIT_OPEN: "Credit ouvert",
  CREDIT_PARTIAL_PAYMENT: "Paiement partiel",
  CREDIT_SETTLED: "Reglement final",
  DIRECT_PAID: "Paiement direct",
};

const ENTRY_TYPE_ICONS: Record<EntryType, string> = {
  CREDIT_OPEN: "C",
  CREDIT_PARTIAL_PAYMENT: "P",
  CREDIT_SETTLED: "F",
  DIRECT_PAID: "D",
};

export function formatAmount(value: number | string | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "";

  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = dateOnly.split("-");
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function inferEntryType(payment: PaymentLike): EntryType {
  if (payment.entry_type) {
    return payment.entry_type;
  }

  if (payment.status === "CREDIT") {
    return "CREDIT_OPEN";
  }

  if (payment.credit_payment_id) {
    return "CREDIT_PARTIAL_PAYMENT";
  }

  return "DIRECT_PAID";
}

export function getEntryTypeLabel(payment: PaymentLike): string {
  return ENTRY_TYPE_LABELS[inferEntryType(payment)];
}

export function getEntryTypeIcon(payment: PaymentLike): string {
  return ENTRY_TYPE_ICONS[inferEntryType(payment)];
}

export function getEntryTypeClassName(payment: PaymentLike): string {
  return inferEntryType(payment).toLowerCase().replace(/_/g, "-");
}

export function isOpenCreditRoot(payment: PaymentLike): boolean {
  return payment.status === "CREDIT" && inferEntryType(payment) === "CREDIT_OPEN";
}

export function getCreditExpectedDate(payment: PaymentLike): string | null {
  return payment.credit_expected_payment_date ?? payment.expected_payment_date ?? null;
}

export function getOriginalCreditAmount(payment: PaymentLike): number | null {
  if (payment.original_credit_amount !== null && payment.original_credit_amount !== undefined) {
    return payment.original_credit_amount;
  }

  if (isOpenCreditRoot(payment)) {
    return payment.amount;
  }

  return null;
}

export function getRemainingAmount(payment: PaymentLike): number | null {
  if (payment.remaining_amount !== null && payment.remaining_amount !== undefined) {
    return payment.remaining_amount;
  }

  if (isOpenCreditRoot(payment)) {
    return payment.amount;
  }

  return null;
}

export function getCreditRootId(payment: PaymentLike): number | null {
  if (payment.credit_payment_id) {
    return payment.credit_payment_id;
  }

  const entryType = inferEntryType(payment);
  if (entryType === "CREDIT_OPEN" || entryType === "CREDIT_SETTLED") {
    return payment.id;
  }

  return null;
}

export function isOverdueOpenCredit(
  payment: PaymentLike,
  now: Date = new Date()
): boolean {
  if (!isOpenCreditRoot(payment)) {
    return false;
  }

  const expectedDate = getCreditExpectedDate(payment);
  if (!expectedDate) {
    return false;
  }

  return new Date(expectedDate) < now;
}

function sortByDateAndId<T extends PaymentLike>(left: T, right: T): number {
  const dateCmp = left.date.localeCompare(right.date);
  if (dateCmp !== 0) return dateCmp;
  return left.id - right.id;
}

function isCreditRoot<T extends PaymentLike>(payment: T): boolean {
  return payment.status === "CREDIT" && payment.credit_payment_id == null;
}

function isChildOfCredit<T extends PaymentLike>(payment: T): boolean {
  return payment.credit_payment_id != null;
}

function getThreadLatestItem<T extends PaymentLike>(thread: PaymentThread<T>): T | null {
  if (thread.items.length === 0) return null;
  return thread.items[thread.items.length - 1];
}

function isSettledSignal<T extends PaymentLike>(payment: T | null): boolean {
  if (!payment) return false;
  if (payment.remaining_amount === 0) return true;
  if (Boolean(payment.credit_settled_date)) return true;
  return inferEntryType(payment) === "CREDIT_SETTLED";
}

export function groupPaymentsByCreditThread<T extends PaymentLike>(
  payments: T[]
): PaymentThread<T>[] {
  const chains = new Map<number, { root: T | null; children: T[] }>();
  const singles: T[] = [];
  const threads: PaymentThread<T>[] = [];

  for (const payment of payments) {
    if (isCreditRoot(payment)) {
      const existing = chains.get(payment.id) ?? { root: null, children: [] };
      existing.root = payment;
      chains.set(payment.id, existing);
      continue;
    }

    if (isChildOfCredit(payment)) {
      const rootId = payment.credit_payment_id as number;
      const existing = chains.get(rootId) ?? { root: null, children: [] };
      existing.children.push(payment);
      chains.set(rootId, existing);
      continue;
    }

    singles.push(payment);
  }

  for (const [rootId, chain] of chains.entries()) {
    const children = [...chain.children].sort(sortByDateAndId);
    const items = chain.root ? [chain.root, ...children] : children;
    const latestChild = children.length > 0 ? children[children.length - 1] : null;
    const isSettled = isSettledSignal(chain.root) || isSettledSignal(latestChild);

    threads.push({
      key: chain.root ? `credit-${rootId}` : `credit-${rootId}-cross-date`,
      creditRootId: rootId,
      root: chain.root,
      items,
      hasRoot: chain.root !== null,
      isSettled,
    });
  }

  for (const payment of singles) {
    threads.push({
      key: `single-${payment.id}`,
      creditRootId: null,
      root: payment,
      items: [payment],
      hasRoot: false,
      isSettled: false,
    });
  }

  return threads.sort((left, right) => {
    const leftLatest = getThreadLatestItem(left);
    const rightLatest = getThreadLatestItem(right);
    const leftDate = leftLatest?.date ?? "";
    const rightDate = rightLatest?.date ?? "";
    const dateCmp = rightDate.localeCompare(leftDate);
    if (dateCmp !== 0) return dateCmp;
    const leftId = leftLatest?.id ?? 0;
    const rightId = rightLatest?.id ?? 0;
    return rightId - leftId;
  });
}
