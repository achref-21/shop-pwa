import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardMode } from "@/api/dashboard";
import type { Payment } from "@/api/payments";
import { searchPayments } from "@/api/payments";
import { getDailySummary, getPeriodSummary } from "@/api/summary";
import { monthRangeCalendar, todayLocalDate, weekRangeMondaySunday } from "@/utils/localDate";
import { isOpenCreditRoot } from "@/utils/paymentDisplay";
import {
  computeCreditCollections,
  getTomorrowDate,
  type DashboardNextCreditCollections,
} from "@/screens/dashboardNextUtils";

type DashboardNextDailyData = {
  paid: number;
};

type DashboardNextPeriodData = {
  revenue: number;
  netCash: number;
  periodStart: string;
  periodEnd: string;
  aggregationBasis: string;
};

type DashboardNextCreditsData = {
  metrics: DashboardNextCreditCollections;
  byId: Record<number, Payment>;
};

type DashboardNextSourceState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string;
  isStale: boolean;
};

export type DashboardNextQuerySource<T> = DashboardNextSourceState<T>;

export type UseDashboardNextDataResult = {
  today: string;
  tomorrow: string;
  periodRange: {
    start: string;
    end: string;
  };
  daily: DashboardNextQuerySource<DashboardNextDailyData>;
  period: DashboardNextQuerySource<DashboardNextPeriodData>;
  credits: DashboardNextQuerySource<DashboardNextCreditsData>;
  refreshAll: () => void;
};

type UseDashboardNextDataParams = {
  mode: DashboardMode;
  isOnline: boolean;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erreur de chargement.";
}

function startFetch<T>(previous: DashboardNextSourceState<T>): DashboardNextSourceState<T> {
  return {
    ...previous,
    isLoading: true,
    error: "",
  };
}

function resolveSuccess<T>(data: T): DashboardNextSourceState<T> {
  return {
    data,
    isLoading: false,
    error: "",
    isStale: false,
  };
}

function resolveFailure<T>(
  previous: DashboardNextSourceState<T>,
  message: string
): DashboardNextSourceState<T> {
  return {
    ...previous,
    isLoading: false,
    error: message,
    isStale: previous.data !== null,
  };
}

export function useDashboardNextData({
  mode,
  isOnline,
}: UseDashboardNextDataParams): UseDashboardNextDataResult {
  const [refreshToken, setRefreshToken] = useState(0);
  const [daily, setDaily] = useState<DashboardNextSourceState<DashboardNextDailyData>>({
    data: null,
    isLoading: true,
    error: "",
    isStale: false,
  });
  const [period, setPeriod] = useState<DashboardNextSourceState<DashboardNextPeriodData>>({
    data: null,
    isLoading: true,
    error: "",
    isStale: false,
  });
  const [credits, setCredits] = useState<DashboardNextSourceState<DashboardNextCreditsData>>({
    data: null,
    isLoading: true,
    error: "",
    isStale: false,
  });

  const today = todayLocalDate();
  const tomorrow = getTomorrowDate(today);
  const periodRange = useMemo(
    () => (mode === "WEEK" ? weekRangeMondaySunday(today) : monthRangeCalendar(today)),
    [mode, today]
  );

  const refreshAll = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setDaily((previous) => startFetch(previous));

    getDailySummary(today, today)
      .then((response) => {
        if (!active) return;
        setDaily(resolveSuccess({ paid: response.paid }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDaily((previous) => resolveFailure(previous, toErrorMessage(error)));
      });

    return () => {
      active = false;
    };
  }, [today, refreshToken]);

  useEffect(() => {
    let active = true;
    setPeriod((previous) => startFetch(previous));

    getPeriodSummary(periodRange.start, periodRange.end, mode)
      .then((response) => {
        if (!active) return;
        setPeriod(
          resolveSuccess({
            revenue: response.revenue,
            netCash: response.net_cash,
            periodStart: response.period_start,
            periodEnd: response.period_end,
            aggregationBasis: response.aggregation_basis,
          })
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPeriod((previous) => resolveFailure(previous, toErrorMessage(error)));
      });

    return () => {
      active = false;
    };
  }, [mode, periodRange.end, periodRange.start, refreshToken]);

  useEffect(() => {
    let active = true;
    setCredits((previous) => startFetch(previous));

    searchPayments({ status: "CREDIT" }, isOnline)
      .then((payments) => {
        if (!active) return;
        const openCredits = payments.filter(isOpenCreditRoot);
        const byId: Record<number, Payment> = {};
        for (const payment of openCredits) {
          byId[payment.id] = payment;
        }

        setCredits(
          resolveSuccess({
            metrics: computeCreditCollections(openCredits, today, tomorrow),
            byId,
          })
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCredits((previous) => resolveFailure(previous, toErrorMessage(error)));
      });

    return () => {
      active = false;
    };
  }, [isOnline, refreshToken, today, tomorrow]);

  return {
    today,
    tomorrow,
    periodRange,
    daily,
    period,
    credits,
    refreshAll,
  };
}
