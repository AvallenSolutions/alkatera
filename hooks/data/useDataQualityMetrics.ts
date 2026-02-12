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

/**
 * Derive a data quality grade from whatever columns are available on a material row.
 *
 * Priority order:
 *   1. data_quality_grade  — written by calculator since Feb 2026
 *   2. data_priority       — 1 = HIGH, 2 = MEDIUM, 3 = LOW
 *   3. data_quality_tag    — Primary_Verified = HIGH, Regional_Standard = MEDIUM, else LOW
 *   4. impact_source       — 'supplier_verified' = HIGH, 'regional_standard'/'hybrid' = MEDIUM, else LOW
 *   5. data_source         — 'supplier' = HIGH, 'openlca' = MEDIUM, else LOW
 *   6. Fallback            — LOW
 */
function deriveQualityGrade(m: Record<string, any>): 'HIGH' | 'MEDIUM' | 'LOW' {
  // 1. Explicit grade
  if (m.data_quality_grade === 'HIGH' || m.data_quality_grade === 'MEDIUM' || m.data_quality_grade === 'LOW') {
    return m.data_quality_grade;
  }

  // 2. data_priority (number 1-3)
  if (m.data_priority === 1) return 'HIGH';
  if (m.data_priority === 2) return 'MEDIUM';
  if (m.data_priority === 3) return 'LOW';

  // 3. data_quality_tag
  if (m.data_quality_tag === 'Primary_Verified') return 'HIGH';
  if (m.data_quality_tag === 'Regional_Standard') return 'MEDIUM';
  if (m.data_quality_tag === 'Secondary_Modelled' || m.data_quality_tag === 'Secondary_Estimated') return 'LOW';

  // 4. impact_source
  if (m.impact_source === 'supplier_verified') return 'HIGH';
  if (m.impact_source === 'regional_standard' || m.impact_source === 'hybrid') return 'MEDIUM';
  if (m.impact_source === 'secondary_modelled' || m.impact_source === 'staging_factor') return 'LOW';

  // 5. data_source
  if (m.data_source === 'supplier') return 'HIGH';
  if (m.data_source === 'openlca') return 'MEDIUM';

  // 6. Fallback
  return 'LOW';
}

/**
 * Derive confidence score when the stored value is missing or zero.
 */
function deriveConfidence(m: Record<string, any>): number {
  if (m.confidence_score && m.confidence_score > 0) return m.confidence_score;

  const grade = deriveQualityGrade(m);
  if (grade === 'HIGH') return 95;
  if (grade === 'MEDIUM') return 75;
  return 50;
}

/**
 * Determine if the material uses DEFRA data, checking multiple columns.
 */
function isDefraSource(m: Record<string, any>): boolean {
  if (m.gwp_data_source?.includes('DEFRA')) return true;
  if (m.source_reference?.includes('DEFRA')) return true;
  if (m.impact_source === 'regional_standard') return true;
  return false;
}

/**
 * Determine if the material is supplier-verified.
 */
function isSupplierVerified(m: Record<string, any>): boolean {
  if (m.data_source === 'supplier') return true;
  if (m.supplier_product_id) return true;
  if (m.gwp_data_source?.includes('Supplier')) return true;
  if (m.impact_source === 'supplier_verified') return true;
  return false;
}

/**
 * Determine if the material uses a hybrid data source.
 */
function isHybrid(m: Record<string, any>): boolean {
  if (m.is_hybrid_source === true) return true;
  if (m.impact_source === 'hybrid') return true;
  if (m.non_gwp_data_source && m.gwp_data_source && m.non_gwp_data_source !== m.gwp_data_source) return true;
  return false;
}

const emptyDistribution: DataQualityDistribution = {
  high_count: 0,
  high_percentage: 0,
  medium_count: 0,
  medium_percentage: 0,
  low_count: 0,
  low_percentage: 0,
  total_count: 0,
};

export function useDataQualityMetrics(organizationId: string | undefined): DataQualityMetrics {
  const [distribution, setDistribution] = useState<DataQualityDistribution>(emptyDistribution);
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

        // 1. Fetch all LCAs for this org
        const { data: lcas, error: lcasError } = await supabase
          .from('product_carbon_footprints')
          .select('id, product_id')
          .eq('organization_id', organizationId);

        if (lcasError) throw lcasError;

        if (!lcas || lcas.length === 0) {
          setDistribution(emptyDistribution);
          setLoading(false);
          return;
        }

        const lcaIds = lcas.map(l => l.id);

        // 2. Fetch products for name lookup
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', organizationId);

        if (productsError) throw productsError;

        const productMap = new Map((products || []).map(p => [p.id, p.name]));
        const lcaProductMap = new Map(lcas.map(l => [l.id, l.product_id]));

        // 3. Fetch materials with ALL available quality columns
        //    This includes both new columns (data_quality_grade, gwp_data_source, etc.)
        //    and legacy columns (data_priority, data_quality_tag, impact_source) for fallback derivation
        const { data: materials, error: materialsError } = await supabase
          .from('product_carbon_footprint_materials')
          .select(`
            id,
            product_carbon_footprint_id,
            name,
            quantity,
            unit,
            data_quality_grade,
            data_priority,
            data_quality_tag,
            confidence_score,
            impact_climate,
            data_source,
            impact_source,
            source_reference,
            gwp_data_source,
            non_gwp_data_source,
            is_hybrid_source,
            category_type,
            supplier_product_id
          `)
          .in('product_carbon_footprint_id', lcaIds);

        if (materialsError) throw materialsError;

        if (!materials || materials.length === 0) {
          setDistribution(emptyDistribution);
          setLoading(false);
          return;
        }

        // 4. Derive quality for each material using all available signals
        const totalCount = materials.length;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        let totalConfidence = 0;
        let hybridCount = 0;
        let defraUsageCount = 0;
        let supplierCount = 0;

        for (const m of materials) {
          const grade = deriveQualityGrade(m);
          if (grade === 'HIGH') highCount++;
          else if (grade === 'MEDIUM') mediumCount++;
          else lowCount++;

          totalConfidence += deriveConfidence(m);

          if (isHybrid(m)) hybridCount++;
          if (isDefraSource(m)) defraUsageCount++;
          if (isSupplierVerified(m)) supplierCount++;
        }

        setDistribution({
          high_count: highCount,
          high_percentage: (highCount / totalCount) * 100,
          medium_count: mediumCount,
          medium_percentage: (mediumCount / totalCount) * 100,
          low_count: lowCount,
          low_percentage: (lowCount / totalCount) * 100,
          total_count: totalCount,
        });

        setAverageConfidence(Math.round(totalConfidence / totalCount));
        setHybridSourcesCount(hybridCount);
        setDefraCount(defraUsageCount);
        setSupplierVerifiedCount(supplierCount);

        // 5. Build upgrade opportunities from non-HIGH, non-supplier materials
        const opportunities: UpgradeOpportunity[] = materials
          .filter(m => {
            const grade = deriveQualityGrade(m);
            return grade === 'LOW' || grade === 'MEDIUM';
          })
          .filter(m => !m.supplier_product_id)
          .map(m => {
            const currentQuality = deriveQualityGrade(m);
            const currentConfidence = deriveConfidence(m);
            const ghgImpact = m.impact_climate || 0;
            const potentialConfidence = 95;
            const confidenceGain = potentialConfidence - currentConfidence;
            const priorityScore = (ghgImpact * confidenceGain) / 100;

            let recommendation = '';
            if (ghgImpact > 10) {
              recommendation = 'High impact material — priority supplier engagement';
            } else if (ghgImpact > 1) {
              recommendation = 'Medium impact — request supplier data';
            } else {
              recommendation = 'Low impact — consider when next updating this product';
            }

            const productId = lcaProductMap.get(m.product_carbon_footprint_id) || '';
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
              recommendation,
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
