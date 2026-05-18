import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import type { CertificationReadiness } from '@/lib/certifications/scoring';

export type { CertificationReadiness } from '@/lib/certifications/scoring';

export function useCertificationReadiness() {
  const { currentOrganization } = useOrganization();
  const [readiness, setReadiness] = useState<CertificationReadiness | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch('/api/certifications/readiness');
      if (!response.ok) {
        throw new Error('Failed to fetch readiness');
      }
      const data = (await response.json()) as CertificationReadiness;
      setReadiness(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching readiness:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  return { readiness, loading, error, refetch: fetchReadiness };
}
