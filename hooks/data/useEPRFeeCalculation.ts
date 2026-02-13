import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type { EPRFeeCalculationResult } from '@/lib/epr/types';

interface UseEPRFeeCalculationResult {
  calculation: EPRFeeCalculationResult | null;
  feeYear: string;
  setFeeYear: (year: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEPRFeeCalculation(initialFeeYear = '2025-26'): UseEPRFeeCalculationResult {
  const { currentOrganization } = useOrganization();
  const [calculation, setCalculation] = useState<EPRFeeCalculationResult | null>(null);
  const [feeYear, setFeeYear] = useState(initialFeeYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalculation = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/epr/calculate-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          fee_year: feeYear,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to calculate fees');
      }

      const data = await response.json();
      setCalculation(data.calculation || null);
    } catch (err: any) {
      console.error('Error calculating EPR fees:', err);
      const message = err.message || 'Failed to calculate EPR fees';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, feeYear]);

  useEffect(() => {
    fetchCalculation();
  }, [fetchCalculation]);

  return {
    calculation,
    feeYear,
    setFeeYear,
    loading,
    error,
    refresh: fetchCalculation,
  };
}
