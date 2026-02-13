import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import type { EPRPRNObligation } from '@/lib/epr/types';

interface PRNSummary {
  total_obligation_tonnage: number;
  total_purchased_tonnage: number;
  total_cost_gbp: number;
  overall_fulfilment_pct: number;
  materials_fulfilled: number;
  materials_total: number;
}

interface UseEPRPRNResult {
  obligations: EPRPRNObligation[];
  summary: PRNSummary | null;
  year: number;
  setYear: (year: number) => void;
  loading: boolean;
  error: string | null;
  updatePurchase: (obligationId: string, params: {
    prns_purchased_tonnage: number;
    prn_cost_per_tonne_gbp: number;
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

function computeSummary(obligations: EPRPRNObligation[]): PRNSummary {
  const total_obligation_tonnage = obligations.reduce((sum, o) => sum + o.obligation_tonnage, 0);
  const total_purchased_tonnage = obligations.reduce((sum, o) => sum + o.prns_purchased_tonnage, 0);
  const total_cost_gbp = obligations.reduce((sum, o) => sum + o.total_prn_cost_gbp, 0);
  const overall_fulfilment_pct =
    total_obligation_tonnage > 0
      ? Math.round((total_purchased_tonnage / total_obligation_tonnage) * 100)
      : 0;
  const materials_fulfilled = obligations.filter(
    (o) => o.status === 'fulfilled' || o.status === 'exceeded'
  ).length;

  return {
    total_obligation_tonnage,
    total_purchased_tonnage,
    total_cost_gbp,
    overall_fulfilment_pct,
    materials_fulfilled,
    materials_total: obligations.length,
  };
}

export function useEPRPRN(initialYear?: number): UseEPRPRNResult {
  const { currentOrganization } = useOrganization();
  const [obligations, setObligations] = useState<EPRPRNObligation[]>([]);
  const [summary, setSummary] = useState<PRNSummary | null>(null);
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObligations = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        organizationId: currentOrganization.id,
        year: String(year),
      });

      const response = await fetch(`/api/epr/prn?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch PRN obligations');
      }

      const data = await response.json();
      const obligationData = (data.obligations as EPRPRNObligation[]) || [];
      setObligations(obligationData);
      setSummary(computeSummary(obligationData));
    } catch (err: any) {
      console.error('Error fetching PRN obligations:', err);
      const message = err.message || 'Failed to load PRN obligations';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchObligations();
  }, [fetchObligations]);

  const updatePurchase = useCallback(
    async (
      obligationId: string,
      params: { prns_purchased_tonnage: number; prn_cost_per_tonne_gbp: number }
    ) => {
      if (!currentOrganization?.id) return;

      try {
        const response = await fetch('/api/epr/prn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            obligationId,
            ...params,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Failed to update PRN purchase');
        }

        toast.success('PRN purchase updated');
        await fetchObligations();
      } catch (err: any) {
        console.error('Error updating PRN purchase:', err);
        const message = err.message || 'Failed to update PRN purchase';
        toast.error(message);
        throw err;
      }
    },
    [currentOrganization?.id, fetchObligations]
  );

  return {
    obligations,
    summary,
    year,
    setYear,
    loading,
    error,
    updatePurchase,
    refresh: fetchObligations,
  };
}
