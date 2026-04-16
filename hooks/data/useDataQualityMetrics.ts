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

export interface ProductQualityRow {
  product_id: string;
  product_name: string;
  material_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  quality_score: number; // % of HIGH materials
}

export interface DataQualityMetrics {
  distribution: DataQualityDistribution;
  averageConfidence: number;
  hybridSourcesCount: number;
  defraCount: number;
  supplierVerifiedCount: number;
  upgradeOpportunities: UpgradeOpportunity[];
  totalUpgradeOpportunities: number;
  carbonAtRisk: number;
  productQualityBreakdown: ProductQualityRow[];
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
 * Confidence score derived purely from quality grade.
 *
 * We deliberately ignore any stored `confidence_score` on the material row
 * because those values were set by the resolver with different semantics
 * (e.g. staging LOW factors got 70-75) which inflated the average.
 *
 * The grade-based mapping gives a defensible, consistent metric:
 *   HIGH   (Supplier EPD / Verified)       → 100 %  — gold standard, theoretical maximum
 *   MEDIUM (DEFRA hybrid / Regional / Live) →  60 %  — reputable secondary data
 *   LOW    (Generic proxy / estimate)       →  25 %  — high uncertainty, upgrade encouraged
 *
 * This means 100 % is achievable when every material has supplier-verified
 * data, giving users a clear improvement journey.
 */
function deriveConfidence(m: Record<string, any>): number {
  const grade = deriveQualityGrade(m);
  if (grade === 'HIGH') return 100;
  if (grade === 'MEDIUM') return 60;
  return 25;
}

/**
 * Build a material-specific suggested action based on the material's name,
 * category, current quality grade, and carbon impact.
 *
 * The goal is to tell the user exactly what to ask their supplier for —
 * not just "request supplier data" but "ask for cullet %, furnace energy
 * mix, and manufacturing location" for a glass bottle, for example.
 */
function buildRecommendation(
  m: Record<string, any>,
  grade: 'LOW' | 'MEDIUM',
  ghgImpact: number
): string {
  const name = (m.name || '').toLowerCase();
  const category = (m.category_type || '').toLowerCase();
  const isHighImpact = ghgImpact > 1; // >1 kg CO₂e per unit is meaningful for a drinks product
  const isSubstantial = ghgImpact > 0.1;
  const urgent = grade === 'LOW' && isHighImpact;
  const prefix = urgent ? 'Priority: ' : '';

  // ── Packaging: glass ────────────────────────────────────────────
  if (/\bglass\b|bottle/.test(name)) {
    return `${prefix}Ask glass supplier for EPD or cullet %, furnace energy mix, and plant location — recycled cullet cuts impact by up to 30%`;
  }

  // ── Packaging: aluminium ────────────────────────────────────────
  if (/alumin(i)?um|\bcap\b|\bfoil\b|\bcan\b|closure/.test(name)) {
    return `${prefix}Request primary vs recycled aluminium split and smelter location — recycled aluminium is ~95% lower impact than primary`;
  }

  // ── Packaging: plastic ──────────────────────────────────────────
  if (/\bpet\b|hdpe|ldpe|plastic|polymer|resin|\bpp\b|bioplastic/.test(name)) {
    return `${prefix}Ask packaging supplier for recycled content %, resin grade, and their EPD — rPET can be 60%+ lower than virgin`;
  }

  // ── Packaging: paper/cardboard ──────────────────────────────────
  if (/paper|cardboard|\bboard\b|carton|case|outer|\bsrp\b|fibre|fiber/.test(name)) {
    return 'Ask supplier for FSC/PEFC certification, recycled content, and mill location — usually low impact but quick to verify';
  }

  // ── Packaging: label ────────────────────────────────────────────
  if (/label|sleeve|shrink/.test(name)) {
    return 'Low impact overall — update when next changing label spec with your printer';
  }

  // ── Ingredients: juice / extract / powder ───────────────────────
  if (
    /juice|extract|puree|concentrate|powder|pulp|syrup|honey|sugar|spice/.test(name) ||
    category.includes('ingredient') ||
    category.includes('agricultural')
  ) {
    return `${prefix}Request farm origin, yield per hectare, and processing energy from grower/processor — crop-specific data replaces a generic proxy`;
  }

  // ── Transport ───────────────────────────────────────────────────
  if (category.includes('transport') || /\bfreight\b|shipping|haulage|\blogistics\b/.test(name)) {
    return 'Verify actual route distance, transport mode (road/rail/sea/air), and load factor with your logistics provider';
  }

  // ── Energy ──────────────────────────────────────────────────────
  if (
    category.includes('energy') ||
    /electric|\bgas\b|\bsteam\b|\bheat\b|fuel|diesel|natural gas/.test(name)
  ) {
    return `${prefix}Switch to your supplier's market-based Scope 2 factor — REGOs or renewable contracts can cut this to near zero`;
  }

  // ── Water ───────────────────────────────────────────────────────
  if (category.includes('water') || /^water$|\bwater\b/.test(name)) {
    return 'Usually low carbon impact — confirm water source and check local scarcity risk in the Water Footprint view';
  }

  // ── Waste / end-of-life ─────────────────────────────────────────
  if (category.includes('waste') || /waste|disposal|recycling|landfill|incinerat/.test(name)) {
    return 'Verify the actual disposal pathway with your waste contractor — regional defaults often understate incineration share';
  }

  // ── Generic fallbacks based on grade + impact ───────────────────
  if (grade === 'LOW') {
    if (isHighImpact) return 'Priority: request supplier-specific emission factor (EPD, product passport, or measured data)';
    if (isSubstantial) return 'Ask supplier for their own emission factor or manufacturer-specific data';
    return 'Currently uses a generic proxy — refine when next updating this product';
  }
  // MEDIUM grade fallback
  if (isHighImpact) {
    return 'Verify regional data matches actual supplier geography, then request a site-specific EPD';
  }
  return 'Uses a regional average — ask supplier if they have site-specific data to share';
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
  const [carbonAtRisk, setCarbonAtRisk] = useState<number>(0);
  const [productQualityBreakdown, setProductQualityBreakdown] = useState<ProductQualityRow[]>([]);
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

        // 1. Fetch all LCAs for this org, ordered newest-first so deduplication keeps the latest
        const { data: lcas, error: lcasError } = await supabase
          .from('product_carbon_footprints')
          .select('id, product_id, created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });

        if (lcasError) throw lcasError;

        if (!lcas || lcas.length === 0) {
          setDistribution(emptyDistribution);
          setLoading(false);
          return;
        }

        // 2. Deduplicate: keep only the most recent LCA per product.
        //    Because results are ordered descending by created_at, the first
        //    occurrence of each product_id is always the latest run.
        const latestLcaMap = new Map<string, string>(); // product_id → lca_id
        for (const lca of lcas) {
          if (!latestLcaMap.has(lca.product_id)) {
            latestLcaMap.set(lca.product_id, lca.id);
          }
        }
        const lcaIds = Array.from(latestLcaMap.values());

        // Reverse map: lca_id → product_id (only latest LCAs)
        const lcaProductMap = new Map<string, string>(
          Array.from(latestLcaMap.entries()).map(([productId, lcaId]) => [lcaId, productId])
        );

        // 3. Fetch products for name lookup
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', organizationId);

        if (productsError) throw productsError;

        const productMap = new Map((products || []).map(p => [p.id, p.name]));

        // 4. Fetch materials with ALL available quality columns from latest LCAs only
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

        // 5. Single-pass computation over all materials
        const totalCount = materials.length;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;
        let totalConfidence = 0;
        let hybridCount = 0;
        let defraUsageCount = 0;
        let supplierCount = 0;
        let carbonAtRiskTotal = 0;

        // Per-product quality tracking
        const productQualityMap = new Map<string, {
          product_name: string;
          high: number;
          medium: number;
          low: number;
        }>();

        for (const m of materials) {
          const grade = deriveQualityGrade(m);
          const productId = lcaProductMap.get(m.product_carbon_footprint_id) || '';
          const productName = productMap.get(productId) || 'Unknown Product';

          // Distribution counts
          if (grade === 'HIGH') highCount++;
          else if (grade === 'MEDIUM') mediumCount++;
          else lowCount++;

          totalConfidence += deriveConfidence(m);

          if (isHybrid(m)) hybridCount++;
          if (isDefraSource(m)) defraUsageCount++;
          if (isSupplierVerified(m)) supplierCount++;

          // Carbon at risk: LOW quality materials only
          if (grade === 'LOW') {
            carbonAtRiskTotal += m.impact_climate || 0;
          }

          // Per-product breakdown
          const existing = productQualityMap.get(productId) ?? {
            product_name: productName,
            high: 0,
            medium: 0,
            low: 0,
          };
          if (grade === 'HIGH') existing.high++;
          else if (grade === 'MEDIUM') existing.medium++;
          else existing.low++;
          productQualityMap.set(productId, existing);
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
        setCarbonAtRisk(carbonAtRiskTotal);

        // Build per-product breakdown, sorted worst-first (lowest quality_score at top)
        const breakdown: ProductQualityRow[] = Array.from(productQualityMap.entries())
          .map(([product_id, v]) => {
            const total = v.high + v.medium + v.low;
            return {
              product_id,
              product_name: v.product_name,
              material_count: total,
              high_count: v.high,
              medium_count: v.medium,
              low_count: v.low,
              quality_score: total > 0 ? Math.round((v.high / total) * 100) : 0,
            };
          })
          .sort((a, b) => a.quality_score - b.quality_score);

        setProductQualityBreakdown(breakdown);

        // 6. Build upgrade opportunities — full sorted list, no slice (page handles pagination)
        const allOpportunities: UpgradeOpportunity[] = materials
          .filter(m => {
            const grade = deriveQualityGrade(m);
            return grade === 'LOW' || grade === 'MEDIUM';
          })
          .filter(m => !m.supplier_product_id)
          .map(m => {
            const currentQuality = deriveQualityGrade(m);
            const currentConfidence = deriveConfidence(m);
            const ghgImpact = m.impact_climate || 0;
            const potentialConfidence = 100;
            const confidenceGain = potentialConfidence - currentConfidence;
            const priorityScore = (ghgImpact * confidenceGain) / 100;

            const recommendation = buildRecommendation(m, currentQuality, ghgImpact);

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
          .sort((a, b) => b.priority_score - a.priority_score);

        setUpgradeOpportunities(allOpportunities);
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
    totalUpgradeOpportunities: upgradeOpportunities.length,
    carbonAtRisk,
    productQualityBreakdown,
    loading,
    error,
  };
}
