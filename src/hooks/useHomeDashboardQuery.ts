import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHomeDashboard, type HomeDashboardResponse } from "@/api/dashboard";
import { ApiHttpError } from "@/api/client";
import type { HomeDashboardSearchState } from "@/screens/homeDashboardUtils";

type UseHomeDashboardQueryResult = {
  data: HomeDashboardResponse | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  validationError: string;
  refetch: () => void;
};

export function useHomeDashboardQuery(
  params: HomeDashboardSearchState
): UseHomeDashboardQueryResult {
  const [data, setData] = useState<HomeDashboardResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [validationError, setValidationError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const activeRequestIdRef = useRef(0);

  const refetch = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    const controller = new AbortController();

    setIsFetching(true);
    setValidationError("");
    setError(null);

    fetchHomeDashboard({
      as_of: params.as_of,
      mode: params.mode,
      anchor_date: params.anchor_date,
      signal: controller.signal,
    })
      .then((response) => {
        if (requestId !== activeRequestIdRef.current) return;
        setData(response);
        setValidationError("");
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted || requestId !== activeRequestIdRef.current) {
          return;
        }

        if (fetchError instanceof ApiHttpError && fetchError.status === 400) {
          setValidationError(fetchError.message || "Parametres invalides.");
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError : new Error("Erreur lors du chargement.")
        );
      })
      .finally(() => {
        if (requestId === activeRequestIdRef.current) {
          setIsFetching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params.anchor_date, params.as_of, params.mode, refreshToken]);

  return {
    data,
    isInitialLoading: isFetching && data === null,
    isRefreshing: isFetching && data !== null,
    error,
    validationError,
    refetch,
  };
}

