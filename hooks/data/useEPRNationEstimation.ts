import { useState, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type { NationEstimationResult } from '@/lib/epr/types';

interface NationDataSources {
  customer_addresses: number;
  delivery_postcodes: number;
  method_used: string;
}

interface UseEPRNationEstimationResult {
  estimation: NationEstimationResult | null;
  dataSources: NationDataSources | null;
  loading: boolean;
  error: string | null;
  runEstimation: () => Promise<NationEstimationResult | null>;
}

export function useEPRNationEstimation(): UseEPRNationEstimationResult {
  const { currentOrganization } = useOrganization();
  const [estimation, setEstimation] = useState<NationEstimationResult | null>(null);
  const [dataSources, setDataSources] = useState<NationDataSources | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runEstimation = useCallback(async (): Promise<NationEstimationResult | null> => {
    if (!currentOrganization?.id) return null;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/epr/estimate-nations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to estimate nation sales');
      }

      const data = await response.json();
      const result = data.estimation as NationEstimationResult;
      setEstimation(result);
      setDataSources(data.dataSources || null);
      toast.success('Nation sales estimation complete');
      return result;
    } catch (err: any) {
      console.error('Error estimating nation sales:', err);
      const message = err.message || 'Failed to estimate nation sales';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  return {
    estimation,
    dataSources,
    loading,
    error,
    runEstimation,
  };
}
