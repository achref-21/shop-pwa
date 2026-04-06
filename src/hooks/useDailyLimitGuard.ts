import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyLimitEvaluationResult } from "@/services/dailyLimit";
import { evaluateDailyLimitForAmount } from "@/services/dailyLimit";
import { formatAmount } from "@/utils/paymentDisplay";

function formatAlreadyOverLimitNotice(result: DailyLimitEvaluationResult): string {
  return `Limite quotidienne deja depassee pour le ${result.date}.`;
}

type PendingResolver = ((confirmed: boolean) => void) | null;

export function useDailyLimitGuard() { 
  const [crossingWarning, setCrossingWarning] =
    useState<DailyLimitEvaluationResult | null>(null);
  const [alreadyOverNotice, setAlreadyOverNotice] = useState("");
  const pendingResolverRef = useRef<PendingResolver>(null);

  useEffect(() => {
    return () => {
      if (pendingResolverRef.current) {
        pendingResolverRef.current(false);
      }
      pendingResolverRef.current = null;
    };
  }, []);

  const clearAlreadyOverNotice = useCallback(() => {
    setAlreadyOverNotice("");
  }, []);

  const requestApproval = useCallback(
    async (amount: number, referenceDate: string): Promise<boolean> => {
    setAlreadyOverNotice("");
    const evaluation = await evaluateDailyLimitForAmount(amount, referenceDate);

    if (evaluation.decision === "ALREADY_OVER_LIMIT") {
      setAlreadyOverNotice(formatAlreadyOverLimitNotice(evaluation));
      return true;
    }

    if (evaluation.decision === "CROSSING_LIMIT_CONFIRM_REQUIRED") {
      // Pause the calling action until user explicitly confirms/cancels in the warning modal.
      return new Promise<boolean>((resolve) => {
        pendingResolverRef.current = resolve;
        setCrossingWarning(evaluation);
      });
    }

    return true;
    },
    []
  );

  const confirmCrossing = useCallback(() => {
    if (pendingResolverRef.current) {
      pendingResolverRef.current(true);
    }
    pendingResolverRef.current = null;
    setCrossingWarning(null);
  }, []);

  const cancelCrossing = useCallback(() => {
    if (pendingResolverRef.current) {
      pendingResolverRef.current(false);
    }
    pendingResolverRef.current = null;
    setCrossingWarning(null);
  }, []);

  return {
    crossingWarning,
    alreadyOverNotice,
    requestApproval,
    confirmCrossing,
    cancelCrossing,
    clearAlreadyOverNotice,
  };
}
