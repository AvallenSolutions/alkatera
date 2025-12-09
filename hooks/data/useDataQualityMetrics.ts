import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface MaterialQualityMetric {
  id: string;
  product_id: string;
  product_name: string;
  material_name: string;
  quantity: number;
  unit: string;
  current_data_quality: string;
  current_confidence: number;
  impact_climate: number;
  data_source: string;
  gwp_data_source: string;
  is_hybrid_source: boolean;
  category_type: string;
  supplier_product_id: string | null;
  potential_improvement: number;
}

export interface DataQualityDistribution {
  high_count: number;
  high_percentage: number;
  medium_count: number;
  medium_percentage: number;
  low_count: number;
  low_percentage: number;
  total_count: number;
}

export interface UpgradeOpportunity {
  product_id: string;
  product_name: string;
  material_id: string;
  material_name: string;
  current_quality: string;
  current_confidence: number;
  ghg_impact: number;
  potential_confidence: number;
  confidence_gain: number;
  priority_score: number;
  recommendation: string;
}

export interface DataQualityMetrics {
  distribution: DataQualityDistribution;
  averageConfidence: number;
  hybridSourcesCount: number;
  defraCount: number;
  supplierVerifiedCount: number;
  upgradeOpportunities: UpgradeOpportunity[];
  loading: boolean;
  error: string | null;
}

export function useDataQualityMetrics(organizationId: string | undefined): DataQualityMetrics {
  const [distribution, setDistribution] = useState<DataQualityDistribution>({
    high_count: 0,
    high_percentage: 0,
    medium_count: 0,
    medium_percentage: 0,
    low_count: 0,
    low_percentage: 0,
    total_count: 0,
  });
  const [averageConfidence, setAverageConfidence] = useState<number>(0);
  const [hybridSourcesCount, setHybridSourcesCount] = useState<number>(0);
  const [defraCount, setDefraCount] = useState<number>(0);
  const [supplierVerifiedCount, setSupplierVerifiedCount] = useState<number>(0);
  const [upgradeOpportunities, setUpgradeOpportunities] = useState<UpgradeOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    async function fetchDataQualityMetrics() {
      try {
        setLoading(true);
        setError(null);

        const { data: lcas, error: lcasError } = await supabase
          .from('product_lcas')
          .select('id, product_id')
          .eq('organization_id', organizationId);

        if (lcasError) throw lcasError;

        if (!lcas || lcas.length === 0) {
          setDistribution({
            high_count: 0,
            high_percentage: 0,
            medium_count: 0,
            medium_percentage: 0,
            low_count: 0,
            low_percentage: 0,
            total_count: 0,
          });
          setLoading(false);
          return;
        }

        const lcaIds = lcas.map(l => l.id);

        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', organizationId);

        if (productsError) throw productsError;

        const productMap = new Map((products || []).map(p => [p.id, p.name]));
        const lcaProductMap = new Map(lcas.map(l => [l.id, l.product_id]));

        const { data: materials, error: materialsError } = await supabase
          .from('product_lca_materials')
          .select(`
            id,
            product_lca_id,
            name,
            quantity,
            unit,
            data_quality_grade,
            confidence_score,
            impact_climate,
            data_source,
            gwp_data_source,
            is_hybrid_source,
            category_type,
            supplier_product_id
          `)
          .in('product_lca_id', lcaIds);

        if (materialsError) throw materialsError;

        if (!materials || materials.length === 0) {
          setDistribution({
            high_count: 0,
            high_percentage: 0,
            medium_count: 0,
            medium_percentage: 0,
            low_count: 0,
            low_percentage: 0,
            total_count: 0,
          });
          setLoading(false);
          return;
        }

        const totalCount = materials.length;
        const highCount = materials.filter(m => m.data_quality_grade === 'HIGH').length;
        const mediumCount = materials.filter(m => m.data_quality_grade === 'MEDIUM').length;
        const lowCount = materials.filter(m => m.data_quality_grade === 'LOW').length;

        setDistribution({
          high_count: highCount,
          high_percentage: (highCount / totalCount) * 100,
          medium_count: mediumCount,
          medium_percentage: (mediumCount / totalCount) * 100,
          low_count: lowCount,
          low_percentage: (lowCount / totalCount) * 100,
          total_count: totalCount,
        });

        const avgConfidence =
          materials.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / totalCount;
        setAverageConfidence(Math.round(avgConfidence));

        const hybridCount = materials.filter(m => m.is_hybrid_source === true).length;
        setHybridSourcesCount(hybridCount);

        const defraUsageCount = materials.filter(m =>
          m.gwp_data_source?.includes('DEFRA')
        ).length;
        setDefraCount(defraUsageCount);

        const supplierCount = materials.filter(m =>
          m.data_source === 'supplier' || m.gwp_data_source?.includes('Supplier')
        ).length;
        setSupplierVerifiedCount(supplierCount);

        const opportunities: UpgradeOpportunity[] = materials
          .filter(m => m.data_quality_grade === 'LOW' || m.data_quality_grade === 'MEDIUM')
          .filter(m => !m.supplier_product_id)
          .map(m => {
            const currentQuality = m.data_quality_grade || 'LOW';
            const currentConfidence = m.confidence_score || 50;
            const ghgImpact = m.impact_climate || 0;

            const potentialConfidence = 95;
            const confidenceGain = potentialConfidence - currentConfidence;

            const priorityScore = (ghgImpact * confidenceGain) / 100;

            let recommendation = '';
            if (ghgImpact > 10) {
              recommendation = 'High impact material - Priority supplier engagement';
            } else if (ghgImpact > 1) {
              recommendation = 'Medium impact - Request supplier EPD';
            } else {
              recommendation = 'Low impact - Consider when updating product';
            }

            const productId = lcaProductMap.get(m.product_lca_id) || '';
            const productName = productMap.get(productId) || 'Unknown Product';

            return {
              product_id: productId,
              product_name: productName,
              material_id: m.id,
              material_name: m.name || 'Unknown Material',
              current_quality: currentQuality,
              current_confidence: currentConfidence,
              ghg_impact: ghgImpact,
              potential_confidence: potentialConfidence,
              confidence_gain: confidenceGain,
              priority_score: priorityScore,
              recommendation: recommendation,
            };
          })
          .sort((a, b) => b.priority_score - a.priority_score)
          .slice(0, 10);

        setUpgradeOpportunities(opportunities);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data quality metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchDataQualityMetrics();
  }, [organizationId]);

  return {
    distribution,
    averageConfidence,
    hybridSourcesCount,
    defraCount,
    supplierVerifiedCount,
    upgradeOpportunities,
    loading,
    error,
  };
}
