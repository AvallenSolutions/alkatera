import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface ProductionRun {
  run_id: string;
  product_name: string;
  customer_id?: string;
  reporting_period?: string;
}

export function useProductionRuns(customerId?: string, reportingPeriod?: Date | null) {
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!customerId || !reportingPeriod) {
      setProductionRuns([]);
      return;
    }

    const fetchProductionRuns = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const formattedPeriod = reportingPeriod.toISOString().slice(0, 7);

        const mockRuns: ProductionRun[] = [
          {
            run_id: `run-${customerId}-001`,
            product_name: `Product A - Batch ${formattedPeriod}`,
            customer_id: customerId,
            reporting_period: formattedPeriod,
          },
          {
            run_id: `run-${customerId}-002`,
            product_name: `Product B - Batch ${formattedPeriod}`,
            customer_id: customerId,
            reporting_period: formattedPeriod,
          },
        ];

        setProductionRuns(mockRuns);
      } catch (err) {
        console.error('Error fetching production runs:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch production runs'));
        setProductionRuns([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductionRuns();
  }, [customerId, reportingPeriod]);

  return { productionRuns, isLoading, error };
}
