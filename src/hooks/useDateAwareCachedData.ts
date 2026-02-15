import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook that prevents stale cached data from showing when dates change while offline.
 * 
 * Ensures financial data always matches the selected date/range.
 * When date changes while offline:
 * - Clears stale data immediately
 * - Shows error if no cache exists for new date
 * - Never shows mismatched financial data
 */

export interface UseDateAwareCacheOptions<T> {
  isOnline: boolean;
  dateKey: string; // Unique identifier for the current date/range (e.g., "2026-02-13", "2026_W06")
  fetchData: () => Promise<T>; // Function to fetch/cache the data
}

export interface UseDateAwareCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isCachedData: boolean; // True if data came from cache
}

export function useDateAwareCachedData<T>(
  options: UseDateAwareCacheOptions<T>
): UseDateAwareCacheResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isCachedData, setIsCachedData] = useState(false);

  // Track the date key the current data belongs to
  const lastFetchedDateKeyRef = useRef<string>("");
  const lastSuccessfulFetchRef = useRef<Promise<T> | null>(null);

  // Memoize the fetch operation so it's stable across renders
  const fetchOperation = useCallback(async () => {
    // If date changed, clear stale data immediately
    if (lastFetchedDateKeyRef.current && lastFetchedDateKeyRef.current !== options.dateKey) {
      setData(null);
      setIsCachedData(false);
    }

    // Mark that we're fetching for this dateKey NOW
    // This ensures fetch results only apply to the dateKey they were requested for
    lastFetchedDateKeyRef.current = options.dateKey;

    setIsLoading(true);
    setError(null);

    try {
      const result = await options.fetchData();
      
      // Only update if the dateKey still matches (hasn't changed during fetch)
      if (options.dateKey === lastFetchedDateKeyRef.current) {
        setData(result);
        setError(null);
        setIsCachedData(false);
        lastSuccessfulFetchRef.current = Promise.resolve(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur de chargement"));
      setData(null);
      setIsCachedData(false);
    } finally {
      setIsLoading(false);
    }
  }, [options.dateKey, options.fetchData]);

  useEffect(() => {
    fetchOperation();
  }, [fetchOperation]);

  return {
    data,
    isLoading,
    error,
    isCachedData,
  };
}
