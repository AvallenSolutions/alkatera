import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

/**
 * Cross-organisation vitality comparison.
 *
 * Everything here comes from `get_organization_benchmark_comparison`, which
 * reads the `vitality_benchmarks` view. That view withholds any cohort below
 * five distinct organisations, so an absent `platform_benchmarks` or
 * `category_benchmarks` block means "too few peers to compare against" — not
 * "no data". Render it as the former.
 *
 * There is deliberately no "top performer" here. A cohort maximum is one
 * identifiable organisation's exact score whatever the cohort size, so the
 * view exposes a top quartile instead.
 */
interface BenchmarkData {
  platform_average?: number;
  category_average?: number;
  category_name?: string;
  /** 75th percentile of the cohort. Never a single organisation's score. */
  top_quartile?: number;
  /** How many organisations are behind the figures above. */
  cohort_count?: number;
}

interface BenchmarkBlock {
  overall_average: number;
  climate_average: number;
  water_average: number;
  circularity_average: number;
  nature_average: number;
  overall_top_quartile: number;
  climate_top_quartile: number;
  water_top_quartile: number;
  circularity_top_quartile: number;
  nature_top_quartile: number;
  organization_count: number;
}

interface VitalityBenchmarks {
  has_data: boolean;
  /** The k-anonymity floor the view enforces, echoed so the UI can explain itself. */
  minimum_cohort?: number;
  current_scores?: {
    overall: number;
    climate: number;
    water: number;
    circularity: number;
    nature: number;
    calculation_date: string;
  };
  platform_benchmarks?: BenchmarkBlock;
  category_benchmarks?: BenchmarkBlock & { category_name: string };
}

export function useVitalityBenchmarks() {
  const { currentOrganization } = useOrganization();
  const [benchmarks, setBenchmarks] = useState<VitalityBenchmarks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    const fetchBenchmarks = async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseBrowserClient();

        const { data, error: rpcError } = await supabase.rpc(
          'get_organization_benchmark_comparison',
          { p_organization_id: currentOrganization.id }
        );

        if (rpcError) throw rpcError;

        setBenchmarks(data as VitalityBenchmarks);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching vitality benchmarks:', err);
        setError(err.message);
        setBenchmarks(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [currentOrganization?.id]);

  const getBenchmarkForPillar = (pillar: 'overall' | 'climate' | 'water' | 'circularity' | 'nature'): BenchmarkData => {
    if (!benchmarks?.has_data) return {};

    const result: BenchmarkData = {};

    if (benchmarks.platform_benchmarks) {
      result.platform_average = benchmarks.platform_benchmarks[`${pillar}_average` as keyof BenchmarkBlock] as number;
      result.top_quartile = benchmarks.platform_benchmarks[`${pillar}_top_quartile` as keyof BenchmarkBlock] as number;
      result.cohort_count = benchmarks.platform_benchmarks.organization_count;
    }

    if (benchmarks.category_benchmarks) {
      result.category_average = benchmarks.category_benchmarks[`${pillar}_average` as keyof BenchmarkBlock] as number;
      result.category_name = benchmarks.category_benchmarks.category_name;
      // The category cohort is the tighter, more meaningful one — when it
      // exists it is what the count should describe.
      result.cohort_count = benchmarks.category_benchmarks.organization_count;
    }

    return result;
  };

  return {
    benchmarks,
    loading,
    error,
    getBenchmarkForPillar,
    hasData: benchmarks?.has_data || false,
  };
}
