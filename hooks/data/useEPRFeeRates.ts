import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { EPRFeeRate } from '@/lib/epr/types';

interface UseEPRFeeRatesResult {
  feeRates: EPRFeeRate[];
  loading: boolean;
  error: string | null;
}

export function useEPRFeeRates(feeYear = '2025-26'): UseEPRFeeRatesResult {
  const [feeRates, setFeeRates] = useState<EPRFeeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeRates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ feeYear });
      const response = await fetch(`/api/epr/fee-rates?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch fee rates');
      }

      const data = await response.json();
      setFeeRates((data.feeRates as EPRFeeRate[]) || []);
    } catch (err: any) {
      console.error('Error fetching EPR fee rates:', err);
      const message = err.message || 'Failed to load fee rates';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [feeYear]);

  useEffect(() => {
    fetchFeeRates();
  }, [fetchFeeRates]);

  return {
    feeRates,
    loading,
    error,
  };
}
