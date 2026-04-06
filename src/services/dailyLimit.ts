import { getDailyLimitByDate } from "@/api/settings";

export type DailyLimitDecision =
  | "OK"
  | "CROSSING_LIMIT_CONFIRM_REQUIRED"
  | "ALREADY_OVER_LIMIT";

export type DailyLimitSource = "api" | "snapshot_fallback" | "bypass_no_snapshot";

export type DailyLimitSnapshot = {
  date: string;
  todaySpent: number;
  dailyLimit: number;
};

export type DailyLimitEvaluationResult = {
  decision: DailyLimitDecision;
  date: string;
  amount: number;
  todaySpent: number;
  dailyLimit: number;
  projectedSpent: number;
  source: DailyLimitSource;
  bypassed: boolean;
};

const lastSnapshotByDate = new Map<string, DailyLimitSnapshot>();

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeDailyLimitDecision(
  todaySpent: number,
  dailyLimit: number,
  projectedSpent: number
): DailyLimitDecision {
  if (projectedSpent <= dailyLimit) {
    return "OK";
  }

  if (todaySpent <= dailyLimit && projectedSpent > dailyLimit) {
    return "CROSSING_LIMIT_CONFIRM_REQUIRED";
  }

  if (todaySpent > dailyLimit) {
    return "ALREADY_OVER_LIMIT";
  }

  return "OK";
}

async function fetchDailyLimitSnapshot(date: string): Promise<DailyLimitSnapshot> {
  let lastError: unknown = null;

  // Safe policy: query DB-backed endpoint before each confirmation, with one retry.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await getDailyLimitByDate(date);
      const todaySpent = toFiniteNumber(response.today_payments_total);
      const dailyLimit = toFiniteNumber(response.daily_limit);

      if (todaySpent === null || dailyLimit === null) {
        throw new Error("Reponse limite quotidienne invalide.");
      }

      const snapshot: DailyLimitSnapshot = {
        date,
        todaySpent,
        dailyLimit,
      };

      lastSnapshotByDate.set(date, snapshot);
      return snapshot;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Echec de recuperation de limite quotidienne.");
}

export async function evaluateDailyLimitForAmount(
  amount: number,
  referenceDate: string
): Promise<DailyLimitEvaluationResult> {
  const date = referenceDate;
  let snapshot: DailyLimitSnapshot | null = null;
  let source: DailyLimitSource = "api";

  try {
    snapshot = await fetchDailyLimitSnapshot(date);
  } catch {
    // Fallback uses same-day snapshot only; cross-day reuse is intentionally disallowed.
    snapshot = lastSnapshotByDate.get(date) ?? null;
    source = snapshot ? "snapshot_fallback" : "bypass_no_snapshot";
  }

  if (!snapshot) {
    // Requested behavior: if no same-day snapshot exists after retry, proceed without warnings.
    return {
      decision: "OK",
      date,
      amount,
      todaySpent: 0,
      dailyLimit: 0,
      projectedSpent: amount,
      source,
      bypassed: true,
    };
  }

  const projectedSpent = snapshot.todaySpent + amount;
  const decision =
    snapshot.dailyLimit <= 0
      ? "OK"
      : computeDailyLimitDecision(
          snapshot.todaySpent,
          snapshot.dailyLimit,
          projectedSpent
        );

  return {
    decision,
    date,
    amount,
    todaySpent: snapshot.todaySpent,
    dailyLimit: snapshot.dailyLimit,
    projectedSpent,
    source,
    bypassed: false,
  };
}

export const __dailyLimitTestUtils = {
  clearSnapshots(): void {
    lastSnapshotByDate.clear();
  },
  seedSnapshot(snapshot: DailyLimitSnapshot): void {
    lastSnapshotByDate.set(snapshot.date, snapshot);
  },
};
