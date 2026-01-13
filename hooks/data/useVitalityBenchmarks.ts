import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

interface BenchmarkData {
  platform_average?: number;
  category_average?: number;
  category_name?: string;
  top_performer?: number;
}

interface VitalityBenchmarks {
  has_data: boolean;
  current_scores?: {
    overall: number;
    climate: number;
    water: number;
    circularity: number;
    nature: number;
    calculation_date: string;
  };
  platform_benchmarks?: {
    overall_average: number;
    climate_average: number;
    water_average: number;
    circularity_average: number;
    nature_average: number;
    overall_top: number;
    climate_top: number;
    water_top: number;
    circularity_top: number;
    nature_top: number;
    organization_count: number;
  };
  category_benchmarks?: {
    category_name: string;
    overall_average: number;
    climate_average: number;
    water_average: number;
    circularity_average: number;
    nature_average: number;
    overall_top: number;
    climate_top: number;
    water_top: number;
    circularity_top: number;
    nature_top: number;
    organization_count: number;
  };
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
      result.platform_average = benchmarks.platform_benchmarks[`${pillar}_average` as keyof typeof benchmarks.platform_benchmarks] as number;
      result.top_performer = benchmarks.platform_benchmarks[`${pillar}_top` as keyof typeof benchmarks.platform_benchmarks] as number;
    }

    if (benchmarks.category_benchmarks) {
      result.category_average = benchmarks.category_benchmarks[`${pillar}_average` as keyof typeof benchmarks.category_benchmarks] as number;
      result.category_name = benchmarks.category_benchmarks.category_name;
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
