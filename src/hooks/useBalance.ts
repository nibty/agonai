import { useState, useEffect, useCallback } from "react";
import type { PublicKey } from "@solana/web3.js";
import { getBalance } from "@/lib/x1";

interface UseBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBalance(publicKey: PublicKey | null): UseBalanceResult {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async (): Promise<void> => {
    if (!publicKey) {
      setBalance(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedBalance = await getBalance(publicKey);
      setBalance(fetchedBalance);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch balance");
      setError(error);
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  const refetch = useCallback(async (): Promise<void> => {
    await fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch,
  };
}
