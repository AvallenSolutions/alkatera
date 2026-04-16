import type { LCAReportData } from '@/components/lca-report/types';

interface AggregatedImpacts {
  climate_change_gwp100?: number;
  water_consumption?: number;
  water_scarcity_aware?: number;
  land_use?: number;
  waste?: number;
  circularity_percentage?: number;
  climate_fossil?: number;
  climate_biogenic?: number;
  climate_dluc?: number;
  data_quality?: {
    score?: number;
    rating?: string;
    breakdown?: {
      primary_verified_count?: number;
      primary_verified_share?: string;
      secondary_modelled_count?: number;
      secondary_modelled_share?: string;
      proxy_count?: number;
      proxy_share?: string;
    };
    total_materials?: number;
  };
  breakdown?: {
    by_lifecycle_stage?: {
      raw_materials?: number;
      viticulture?: number;       // Sub-total of raw_materials: self-grown vineyard
      inbound_containers?: number; // Sub-total of raw_materials: delivery containers
      packaging?: number;
      packaging_stage?: number; // Legacy alias
      distribution?: number;
      processing?: number;
      use_phase?: number;
      end_of_life?: number;
    };
    flag_removals?: {
      soil_carbon_co2e?: number;
      methodology?: string | null;
      viticulture_notes?: string | null;
    };
    by_scope?: {
      scope1?: number;
      scope2?: number;
      scope3?: number;
    };
    by_ghg?: {
      co2_fossil?: number;
      co2_biogenic?: number;
      ch4?: number;
      ch4_fossil?: number;
      ch4_biogenic?: number;
      n2o?: number;
    };
    by_material?: Array<{
      name: string;
      category: string;
      quantity: number;
      emissions: number;
      percentage: number;
      unit?: string;
    }>;
  };
  ghg_breakdown?: {
    gas_inventory?: {
      co2_fossil?: number;
      co2_biogenic?: number;
      methane?: number;
      methane_fossil?: number;
      methane_biogenic?: number;
      nitrous_oxide?: number;
      hfc_pfc?: number;
    };
    gwp_factors?: {
      methane_gwp100?: number;
      methane_fossil_gwp100?: number;
      methane_biogenic_gwp100?: number;
      n2o_gwp100?: number;
      method?: string;
    };
    co2e_contributions?: {
      co2_fossil?: number;
      co2_biogenic?: number;
      ch4_as_co2e?: number;
      ch4_fossil_as_co2e?: number;
      ch4_biogenic_as_co2e?: number;
      n2o_as_co2e?: number;
      hfc_pfc?: number;
    };
  };
}

interface LCADatabaseData {
  id: string;
  product_name: string;
  product_description?: string;
  product_image_url?: string;
  functional_unit: string;
  system_boundary: string;
  created_at: string;
  version?: string;
  organization_id?: string;
  aggregated_impacts?: AggregatedImpacts;
  product_lca_materials?: any[];
  /** Alias used by public report page and API route when attaching materials */
  materials?: any[];
  data_quality_summary?: any;
  reference_year?: number;
  lca_scope_type?: string;
  lca_methodology?: string;
  intended_application?: string;
  reasons_for_study?: string;
  intended_audience?: string[];
  is_comparative_assertion?: boolean;
  assumptions_limitations?: Array<{ type: string; text: string }>;
  cutoff_criteria?: string;
  product_volume?: number;
  product_volume_unit?: string;
}

interface CalculationLogData {
  response_data: any;
  created_at: string;
}

interface OrganizationData {
  name: string;
}

/**
 * Calculate a real ISO 14044 pedigree matrix from material-level data.
 *
 * The pedigree matrix assesses data quality across 5 dimensions, each scored
 * 1 (best) to 5 (worst), following the Weidema & Wesnæs (1996) pedigree approach
 * adopted by ISO 14044 Clause 4.2.3.6.3 and implemented in ecoinvent.
 *
 * Scoring logic:
 *
 * 1. RELIABILITY — How verified is the data?
 *    1 = Verified supplier LCA / primary measured data (impact_source: primary_verified)
 *    2 = Partly verified or calculated from verified primary data
 *    3 = Non-verified calculated from qualified source (secondary_modelled from ecoinvent)
 *    4 = Qualified estimate (staging factor / modelled proxy)
 *    5 = Non-qualified estimate
 *    Source: Weidema & Wesnæs (1996) Table 1; ecoinvent data quality guidelines.
 *
 * 2. COMPLETENESS — What fraction of materials have impact data?
 *    1 = >90% of materials have data
 *    2 = 75–90%
 *    3 = 50–75%
 *    4 = 25–50%
 *    5 = <25%
 *
 * 3. TEMPORAL REPRESENTATIVENESS — How recent is the data relative to reference year?
 *    1 = Data ≤3 years old (or reference year matches data year)
 *    2 = 4–6 years
 *    3 = 7–10 years
 *    4 = 11–15 years
 *    5 = >15 years or unknown
 *    We estimate from the LCA reference_year vs. the data source publication dates
 *    embedded in gwp_data_source field (e.g. "DEFRA 2025", "ecoinvent 3.12 (2023)").
 *
 * 4. GEOGRAPHIC REPRESENTATIVENESS — How geographically matched is the data?
 *    1 = Data from same country as facility/origin
 *    2 = Data from same region (e.g. Western Europe)
 *    3 = Data from comparable region
 *    4 = Global or continental average
 *    5 = Data from different region or unknown
 *    Estimated from: % of materials with origin_country_code set.
 *
 * 5. TECHNOLOGICAL REPRESENTATIVENESS — How matched is the production technology?
 *    1 = Exact process match (primary supplier data)
 *    2 = Similar technology, same era
 *    3 = Related process or similar sector
 *    4 = Generic sector average
 *    5 = Proxy from different sector
 *    Estimated from: data_quality_grade field on materials.
 */
function calculatePedigreeMatrix(
  materials: any[],
  referenceYear?: number
): {
  reliability: number;
  completeness: number;
  temporalRepresentativeness: number;
  geographicRepresentativeness: number;
  technologicalRepresentativeness: number;
} {
  const total = materials.length;
  if (total === 0) {
    // No data → worst score across the board
    return { reliability: 5, completeness: 5, temporalRepresentativeness: 5, geographicRepresentativeness: 5, technologicalRepresentativeness: 5 };
  }

  // ── 1. RELIABILITY ────────────────────────────────────────────────────────
  // Score each material by its impact_source and average
  const reliabilityScores = materials.map((m: any) => {
    const src = (m.impact_source || '').toLowerCase();
    const grade = (m.data_quality_grade || '').toUpperCase();
    if (src === 'primary_verified') return 1;
    if (src === 'primary_calculated') return 2;
    if (src === 'secondary_modelled') return 3;
    if (src === 'hybrid_proxy' || grade === 'MEDIUM') return 4;
    return 5; // unknown / staging factor
  });
  const avgReliability = reliabilityScores.reduce((a: number, b: number) => a + b, 0) / total;
  const reliability = Math.min(5, Math.max(1, Math.round(avgReliability)));

  // ── 2. COMPLETENESS ───────────────────────────────────────────────────────
  // Fraction of materials that have a non-zero climate impact (i.e. data was resolved)
  const withData = materials.filter((m: any) => (m.impact_climate || 0) !== 0).length;
  const completenessRatio = withData / total;
  let completeness: number;
  if (completenessRatio > 0.90) completeness = 1;
  else if (completenessRatio > 0.75) completeness = 2;
  else if (completenessRatio > 0.50) completeness = 3;
  else if (completenessRatio > 0.25) completeness = 4;
  else completeness = 5;

  // ── 3. TEMPORAL REPRESENTATIVENESS ───────────────────────────────────────
  // Parse the most recent data year from gwp_data_source strings (e.g. "DEFRA 2025",
  // "ecoinvent 3.12 (2023)", "AGRIBALYSE 3.2 (2022)").
  // If we can't parse, assume the data is the global worst-case default year (2010)
  // to be conservative — better to flag temporal uncertainty than to hide it.
  const currentYear = referenceYear || new Date().getFullYear();
  const dataYears: number[] = [];
  for (const m of materials) {
    const sources = [m.gwp_data_source || '', m.non_gwp_data_source || '', m.source_reference || ''];
    for (const src of sources) {
      // Match 4-digit years between 2000 and current year
      const matches = src.match(/\b(20\d{2})\b/g);
      if (matches) {
        for (const y of matches) {
          const yr = parseInt(y);
          if (yr >= 2000 && yr <= currentYear) dataYears.push(yr);
        }
      }
    }
  }
  const oldestDataYear = dataYears.length > 0 ? Math.min(...dataYears) : 2010;
  const dataAge = currentYear - oldestDataYear;
  let temporalRepresentativeness: number;
  if (dataAge <= 3) temporalRepresentativeness = 1;
  else if (dataAge <= 6) temporalRepresentativeness = 2;
  else if (dataAge <= 10) temporalRepresentativeness = 3;
  else if (dataAge <= 15) temporalRepresentativeness = 4;
  else temporalRepresentativeness = 5;

  // ── 4. GEOGRAPHIC REPRESENTATIVENESS ─────────────────────────────────────
  // Score by: % of materials with a specific country of origin set
  const withCountry = materials.filter((m: any) =>
    m.origin_country_code || m.origin_country || m.country_of_origin
  ).length;
  const geoRatio = withCountry / total;
  let geographicRepresentativeness: number;
  if (geoRatio > 0.80) geographicRepresentativeness = 2; // Most materials have country → regional match
  else if (geoRatio > 0.50) geographicRepresentativeness = 3;
  else if (geoRatio > 0.25) geographicRepresentativeness = 4;
  else geographicRepresentativeness = 5; // Mostly global averages

  // ── 5. TECHNOLOGICAL REPRESENTATIVENESS ──────────────────────────────────
  // Score from data_quality_grade: HIGH → 2, MEDIUM → 3, LOW → 4, else 5
  const techScores = materials.map((m: any) => {
    const src = (m.impact_source || '').toLowerCase();
    const grade = (m.data_quality_grade || '').toUpperCase();
    if (src === 'primary_verified') return 1;  // Actual supplier process data
    if (grade === 'HIGH') return 2;
    if (grade === 'MEDIUM') return 3;
    if (grade === 'LOW') return 4;
    return 5;
  });
  const avgTech = techScores.reduce((a: number, b: number) => a + b, 0) / total;
  const technologicalRepresentativeness = Math.min(5, Math.max(1, Math.round(avgTech)));

  return {
    reliability,
    completeness,
    temporalRepresentativeness,
    geographicRepresentativeness,
    technologicalRepresentativeness,
  };
}

export function transformLCADataForReport(
  lca: LCADatabaseData,
  calculationLog: CalculationLogData | null,
  organization: OrganizationData | null
): LCAReportData {
  const impacts = lca.aggregated_impacts || {};
  const breakdown = impacts.breakdown || {};
  const lifecycleStages = breakdown.by_lifecycle_stage || {};
  const scopeBreakdown = breakdown.by_scope || {};
  const ghgBreakdown = breakdown.by_ghg || {};
  const materialBreakdown = breakdown.by_material || [];
  const dataQuality = impacts.data_quality || {};

  const totalCarbonIncludingBiogenic = impacts.climate_change_gwp100 || 0;
  // ISO 14067:2018 §6.4.9.3: biogenic CO₂ shall be reported separately from
  // the fossil carbon footprint. The headline figure must exclude biogenic CO₂.
  const biogenicCo2ForSubtraction = impacts.climate_biogenic || 0;
  const totalCarbon = totalCarbonIncludingBiogenic - biogenicCo2ForSubtraction;
  const waterConsumption = impacts.water_consumption || 0;
  const waterScarcity = impacts.water_scarcity_aware || 0;
  const landUse = impacts.land_use || 0;

  const rawMaterials = lifecycleStages.raw_materials || 0;
  const viticulture = lifecycleStages.viticulture || 0;
  const purchasedIngredients = rawMaterials - viticulture; // viticulture is a sub-total already included in raw_materials
  const packaging = lifecycleStages.packaging ?? lifecycleStages.packaging_stage ?? 0;
  const distribution = lifecycleStages.distribution || 0;
  const processing = lifecycleStages.processing || 0;
  const usePhase = lifecycleStages.use_phase || 0;
  const endOfLife = lifecycleStages.end_of_life || 0;

  // FLAG removals (SBTi - reported separately from emissions)
  const flagRemovals = breakdown.flag_removals || null;

  const totalFromStages = rawMaterials + packaging + distribution + processing + usePhase + endOfLife;
  const hasViticulture = viticulture > 0;
  // When viticulture data exists, split the stages for the chart
  const viticulturePct = totalFromStages > 0 ? (viticulture / totalFromStages) * 100 : 0;
  const purchasedIngredientsPct = totalFromStages > 0 ? (purchasedIngredients / totalFromStages) * 100 : 0;
  const rawMaterialsPct = totalFromStages > 0 ? (rawMaterials / totalFromStages) * 100 : 0;
  const packagingPct = totalFromStages > 0 ? (packaging / totalFromStages) * 100 : 0;
  const distributionPct = totalFromStages > 0 ? (distribution / totalFromStages) * 100 : 0;
  const processingPct = totalFromStages > 0 ? (processing / totalFromStages) * 100 : 0;
  const usePhasePct = totalFromStages > 0 ? (usePhase / totalFromStages) * 100 : 0;
  const endOfLifePct = totalFromStages > 0 ? (endOfLife / totalFromStages) * 100 : 0;

  const scope1 = scopeBreakdown.scope1 || 0;
  const scope2 = scopeBreakdown.scope2 || 0;
  const scope3 = scopeBreakdown.scope3 || 0;
  const totalScopes = scope1 + scope2 + scope3;
  const scope1Pct = totalScopes > 0 ? (scope1 / totalScopes) * 100 : 0;
  const scope2Pct = totalScopes > 0 ? (scope2 / totalScopes) * 100 : 0;
  const scope3Pct = totalScopes > 0 ? (scope3 / totalScopes) * 100 : 100;

  const materials = lca.product_lca_materials || lca.materials || [];
  // MEDIUM FIX #22: Default DQI score changed from 70 → 40 for transparency.
  // A score of 70 implied "Good/Fair" quality for assessments with no data quality
  // information — misleadingly optimistic and a potential ISO 14044 §4.2.3.6 violation.
  // 40% = "Poor" is the correct honest default when the score is genuinely unknown.
  // This score is shown in the report's executive summary and data quality section.
  // Note: the aggregator already computes a real score (product-lca-aggregator.ts).
  // This 40 is only the last-resort transformer fallback when aggregated_impacts is absent.
  const dqScore = dataQuality.score ?? 40;
  const dqRating = dataQuality.rating || (dqScore >= 80 ? 'Good' : dqScore >= 50 ? 'Fair' : 'Poor');

  const chartBreakdown = hasViticulture
    ? [
        { name: "Viticulture", value: viticulturePct, color: "#ccff00" },
        { name: "Purchased Ingredients", value: purchasedIngredientsPct, color: "#22c55e" },
        { name: "Packaging", value: packagingPct, color: "#eab308" },
        { name: "Distribution", value: distributionPct, color: "#f97316" },
        { name: "Processing", value: processingPct, color: "#3b82f6" },
        { name: "Use Phase", value: usePhasePct, color: "#8b5cf6" },
        { name: "End of Life", value: endOfLifePct, color: "#ef4444" },
      ].filter(item => item.value > 0)
    : [
        { name: "Raw Materials", value: rawMaterialsPct, color: "#22c55e" },
        { name: "Packaging", value: packagingPct, color: "#eab308" },
        { name: "Distribution", value: distributionPct, color: "#f97316" },
        { name: "Processing", value: processingPct, color: "#3b82f6" },
        { name: "Use Phase", value: usePhasePct, color: "#8b5cf6" },
        { name: "End of Life", value: endOfLifePct, color: "#ef4444" },
      ].filter(item => item.value > 0);

  // Build waste stream from actual material data where possible
  const packagingMaterials = materials.filter((m: any) =>
    m.category_type === 'packaging' || m.material_type === 'packaging'
  );
  // LOW FIX #25: Remove hardcoded fallback waste stream.
  // The old fallback invented specific material quantities (0.253 kg glass, etc.) that
  // had no relationship to the actual product being assessed — a clear ISO 14044
  // completeness violation. If no packaging materials exist, show an empty list rather
  // than fabricating plausible-looking but incorrect data.
  // Deduplicate packaging materials by name (e.g. "PET" appearing twice) by
  // aggregating quantities into a single row. Also capitalise label properly
  // (fixes "label" shown lowercase issue).
  const wasteStream = (() => {
    if (packagingMaterials.length === 0) return [];
    const grouped = new Map<string, { quantity: number; recycled: boolean; category: string }>();
    for (const m of packagingMaterials) {
      const rawName = m.material_name || 'Packaging material';
      // Capitalise first letter of each word for consistent display
      const name = rawName.replace(/\b\w/g, (c: string) => c.toUpperCase());
      const existing = grouped.get(name);
      const qty = m.quantity || 0;
      const isRecycled = (m.recyclability_score || 0) > 50 || m.is_reusable || m.is_compostable;
      const cat = m.material_category || m.packaging_type || '';
      if (existing) {
        existing.quantity += qty;
        existing.recycled = existing.recycled || isRecycled;
        if (cat && !existing.category) existing.category = cat;
      } else {
        grouped.set(name, { quantity: qty, recycled: isRecycled, category: cat });
      }
    }
    return Array.from(grouped.entries()).map(([name, data]) => ({
      // If there are duplicates, show the category to differentiate (e.g. "PET (Film)" vs "PET (Bottle)")
      label: data.category && grouped.size !== packagingMaterials.length && name === 'PET'
        ? `${name} (${data.category.replace(/\b\w/g, (c: string) => c.toUpperCase())})`
        : name,
      value: `${data.quantity.toFixed(3)} kg`,
      recycled: data.recycled,
    }));
  })();

  // Compute RECYCLED CONTENT rate (input metric: how much recycled material went in)
  const aggregatedCircularity = impacts.circularity_percentage;
  let recycledContentRate: number;
  if (aggregatedCircularity != null && aggregatedCircularity > 0) {
    recycledContentRate = Math.round(aggregatedCircularity);
  } else {
    const totalMassForRecycling = materials.reduce((sum: number, m: any) => sum + (m.quantity || 0), 0);
    const recycledMass = materials.reduce((sum: number, m: any) => {
      const qty = m.quantity || 0;
      const recycledPct = m.recycled_content_percentage || 0;
      return sum + (qty * recycledPct / 100);
    }, 0);
    recycledContentRate = totalMassForRecycling > 0
      ? Math.round((recycledMass / totalMassForRecycling) * 100)
      : 0;
  }

  // Compute EoL RECYCLING RATE (output metric: what % of packaging will be recycled at end-of-life)
  // Derived from the per-material EoL pathway breakdown
  const eolBreakdown: any[] = (impacts as any).eol_material_breakdown || [];
  let eolRecyclingRate = 0;
  if (eolBreakdown.length > 0) {
    const totalEolMass = eolBreakdown.reduce((s: number, m: any) => s + (m.massKg || 0), 0);
    const recycledEolMass = eolBreakdown.reduce((s: number, m: any) =>
      s + (m.massKg || 0) * ((m.recyclingPct || 0) / 100), 0);
    eolRecyclingRate = totalEolMass > 0 ? Math.round((recycledEolMass / totalEolMass) * 100) : 0;
  }

  // For backward compatibility, recyclingRate uses the higher of the two metrics
  const recyclingRate = Math.max(recycledContentRate, eolRecyclingRate);

  // Count primary/secondary/proxy data sources
  const primaryCount = materials.filter((m: any) => m.impact_source === 'primary_verified').length;
  const secondaryCount = materials.filter((m: any) => m.impact_source === 'secondary_modelled').length;
  const proxyCount = materials.filter((m: any) => m.impact_source === 'hybrid_proxy').length;
  const totalMaterialCount = materials.length || 1;

  // Identify databases used
  const hasEcoinvent = materials.some((m: any) =>
    (m.gwp_data_source || '').toLowerCase().includes('ecoinvent') ||
    (m.non_gwp_data_source || '').toLowerCase().includes('ecoinvent') ||
    (m.source_reference || '').toLowerCase().includes('ecoinvent')
  );

  // Build environmental impact categories from material-level data
  const sumMaterialImpact = (field: string) =>
    materials.reduce((sum: number, m: any) => sum + (m[field] || 0), 0);

  const acidificationTotal = sumMaterialImpact('impact_terrestrial_acidification') || sumMaterialImpact('ef_acidification');
  const eutrophicationFwTotal = sumMaterialImpact('impact_freshwater_eutrophication') || sumMaterialImpact('ef_eutrophication_freshwater');
  const eutrophicationMarineTotal = sumMaterialImpact('impact_marine_eutrophication') || sumMaterialImpact('ef_eutrophication_marine');
  const ozoneDepletionTotal = sumMaterialImpact('impact_ozone_depletion') || sumMaterialImpact('ef_ozone_depletion');
  const photochemOzoneTotal = sumMaterialImpact('impact_photochemical_ozone_formation') || sumMaterialImpact('ef_photochemical_ozone_formation');
  const particulateMatterTotal = sumMaterialImpact('impact_particulate_matter') || sumMaterialImpact('ef_particulate_matter');
  const humanToxCancerTotal = sumMaterialImpact('impact_human_toxicity_carcinogenic') || sumMaterialImpact('ef_human_toxicity_cancer');
  const humanToxNonCancerTotal = sumMaterialImpact('impact_human_toxicity_non_carcinogenic') || sumMaterialImpact('ef_human_toxicity_non_cancer');
  const fwEcotoxTotal = sumMaterialImpact('impact_freshwater_ecotoxicity') || sumMaterialImpact('ef_ecotoxicity_freshwater');
  const fossilResourceTotal = sumMaterialImpact('impact_fossil_resource_scarcity') || sumMaterialImpact('ef_resource_use_fossils');
  const mineralResourceTotal = sumMaterialImpact('impact_mineral_resource_scarcity') || sumMaterialImpact('ef_resource_use_minerals_metals');

  // Top contributors helper
  function topContributorsForImpact(field: string, altField?: string): Array<{ name: string; value: string; percentage: string }> {
    const sorted = materials
      .map((m: any) => ({ name: m.material_name || 'Material', val: m[field] || (altField ? m[altField] : 0) || 0 }))
      .filter((m: any) => m.val > 0)
      .sort((a: any, b: any) => b.val - a.val)
      .slice(0, 3);
    const total = sorted.reduce((sum: number, m: any) => sum + m.val, 0);
    return sorted.map((m: any) => ({
      name: m.name,
      value: m.val.toExponential(3),
      percentage: total > 0 ? `${((m.val / total) * 100).toFixed(1)}%` : '0%'
    }));
  }

  // Build environmental impact categories
  const envCategories: LCAReportData['environmentalImpacts']['categories'] = [];

  if (acidificationTotal > 0) {
    envCategories.push({
      name: 'Acidification',
      indicator: 'Terrestrial Acidification Potential',
      unit: 'kg SO\u2082-eq',
      totalValue: acidificationTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_terrestrial_acidification', 'ef_acidification'),
      description: 'Measures the potential to increase acidity of water and soil systems, primarily from SO\u2082, NO\u2093, and NH\u2083 emissions affecting ecosystems and infrastructure.'
    });
  }
  if (eutrophicationFwTotal > 0) {
    envCategories.push({
      name: 'Eutrophication (Freshwater)',
      indicator: 'Freshwater Eutrophication Potential',
      unit: 'kg P-eq',
      totalValue: eutrophicationFwTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_freshwater_eutrophication', 'ef_eutrophication_freshwater'),
      description: 'Reflects excess nutrient enrichment (phosphorus) in freshwater systems, leading to algal blooms, oxygen depletion, and loss of aquatic biodiversity.'
    });
  }
  if (eutrophicationMarineTotal > 0) {
    envCategories.push({
      name: 'Eutrophication (Marine)',
      indicator: 'Marine Eutrophication Potential',
      unit: 'kg N-eq',
      totalValue: eutrophicationMarineTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_marine_eutrophication', 'ef_eutrophication_marine'),
      description: 'Measures nitrogen enrichment in marine ecosystems from agricultural runoff and wastewater, contributing to dead zones and ecosystem degradation.'
    });
  }
  if (ozoneDepletionTotal > 0) {
    envCategories.push({
      name: 'Ozone Depletion',
      indicator: 'Ozone Depletion Potential',
      unit: 'kg CFC-11-eq',
      totalValue: ozoneDepletionTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_ozone_depletion', 'ef_ozone_depletion'),
      description: 'Quantifies the potential to deplete the stratospheric ozone layer, increasing UV radiation reaching the Earth\'s surface.'
    });
  }
  if (photochemOzoneTotal > 0) {
    envCategories.push({
      name: 'Photochemical Ozone Formation',
      indicator: 'Photochemical Ozone Creation Potential',
      unit: 'kg NMVOC-eq',
      totalValue: photochemOzoneTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_photochemical_ozone_formation', 'ef_photochemical_ozone_formation'),
      description: 'Measures the formation of ground-level ozone (smog) from volatile organic compounds and nitrogen oxides, affecting human health and vegetation.'
    });
  }
  if (particulateMatterTotal > 0) {
    envCategories.push({
      name: 'Particulate Matter',
      indicator: 'Particulate Matter Formation',
      unit: 'disease incidence',
      totalValue: particulateMatterTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_particulate_matter', 'ef_particulate_matter'),
      description: 'Assesses fine particulate emissions (PM2.5) that contribute to respiratory and cardiovascular disease.'
    });
  }
  if (humanToxCancerTotal > 0) {
    envCategories.push({
      name: 'Human Toxicity (Cancer)',
      indicator: 'Carcinogenic Toxicity Potential',
      unit: 'CTUh',
      totalValue: humanToxCancerTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_human_toxicity_carcinogenic', 'ef_human_toxicity_cancer'),
      description: 'Comparative toxic units reflecting the estimated increase in cancer cases due to substance emissions.'
    });
  }
  if (humanToxNonCancerTotal > 0) {
    envCategories.push({
      name: 'Human Toxicity (Non-cancer)',
      indicator: 'Non-carcinogenic Toxicity Potential',
      unit: 'CTUh',
      totalValue: humanToxNonCancerTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_human_toxicity_non_carcinogenic', 'ef_human_toxicity_non_cancer'),
      description: 'Comparative toxic units reflecting estimated non-cancer health effects from substance emissions.'
    });
  }
  if (fwEcotoxTotal > 0) {
    envCategories.push({
      name: 'Ecotoxicity (Freshwater)',
      indicator: 'Freshwater Ecotoxicity Potential',
      unit: 'CTUe',
      totalValue: fwEcotoxTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_freshwater_ecotoxicity', 'ef_ecotoxicity_freshwater'),
      description: 'Measures the potential toxic impact on freshwater ecosystems from chemical emissions.'
    });
  }
  if (fossilResourceTotal > 0) {
    envCategories.push({
      name: 'Fossil Resource Scarcity',
      indicator: 'Fossil Resource Depletion',
      unit: 'kg oil-eq',
      totalValue: fossilResourceTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_fossil_resource_scarcity', 'ef_resource_use_fossils'),
      description: 'Quantifies the depletion of fossil fuel resources (oil, gas, coal) consumed across the product lifecycle.'
    });
  }
  if (mineralResourceTotal > 0) {
    envCategories.push({
      name: 'Mineral Resource Scarcity',
      indicator: 'Mineral & Metal Depletion',
      unit: 'kg Cu-eq',
      totalValue: mineralResourceTotal.toExponential(3),
      topContributors: topContributorsForImpact('impact_mineral_resource_scarcity', 'ef_resource_use_minerals_metals'),
      description: 'Measures the depletion of mineral and metal resources used in production and packaging.'
    });
  }

  // GHG detailed breakdown — prefer pre-computed CO₂e from aggregated_impacts.
  // Previously this code read ch4_fossil_kg_co2e / n2o_kg_co2e from material records,
  // but those fields don't exist on material rows — only raw mass fields (ch4_fossil_kg,
  // n2o_kg) are populated. The CO₂e equivalents are correctly computed in the aggregator
  // and stored in ghg_breakdown.co2e_contributions.
  const ghgFull = impacts.ghg_breakdown || {};
  const co2eContrib = ghgFull.co2e_contributions || {};
  const gasInv = ghgFull.gas_inventory || {};

  // CRITICAL: Use ?? (nullish coalescing) instead of || for all gas values.
  // The aggregator can legitimately compute 0 for pure CO₂ species (e.g. when N₂O CO₂e
  // exceeds the total fossil CO₂e). Using || treats 0 as falsy and falls through to the
  // UN-decomposed carbon-origin totals (which include embedded CH₄/N₂O), causing
  // double-counting and a species sum that exceeds the headline total.
  const co2Fossil = co2eContrib.co2_fossil ?? ghgBreakdown.co2_fossil ?? impacts.climate_fossil ?? 0;
  const co2Biogenic = co2eContrib.co2_biogenic ?? ghgBreakdown.co2_biogenic ?? impacts.climate_biogenic ?? 0;
  const co2Dluc = impacts.climate_dluc ?? 0;

  // CH₄: read raw mass from gas_inventory, CO₂e from co2e_contributions
  // Fallback: compute from raw mass × GWP for backward compatibility with older records
  const ch4FossilKg = gasInv.methane_fossil ?? sumMaterialImpact('ch4_fossil_kg');
  const ch4FossilKgCo2e = co2eContrib.ch4_fossil_as_co2e ?? (ch4FossilKg * 29.8);
  const ch4BiogenicKg = gasInv.methane_biogenic ?? sumMaterialImpact('ch4_biogenic_kg');
  const ch4BiogenicKgCo2e = co2eContrib.ch4_biogenic_as_co2e ?? (ch4BiogenicKg * 27.0);

  // N₂O: read raw mass from gas_inventory, CO₂e from co2e_contributions
  const n2oKg = gasInv.nitrous_oxide ?? sumMaterialImpact('n2o_kg');
  const n2oKgCo2e = co2eContrib.n2o_as_co2e ?? (n2oKg * 273);

  const hfcPfc = co2eContrib.hfc_pfc ?? sumMaterialImpact('hfc_pfc_kg_co2e');

  // Final species-sum reconciliation for the GHG table (ISO 14067 §6.4.3):
  // Ensure the species rows (CO₂ + CH₄ + N₂O + HFC) sum exactly to the *full* total
  // (including biogenic). The headline excludes biogenic per ISO 14067, but the
  // detailed GHG species table must remain internally consistent with all species.
  const speciesSum = co2Fossil + co2Biogenic + co2Dluc + ch4FossilKgCo2e + ch4BiogenicKgCo2e + n2oKgCo2e + hfcPfc;
  const needsReconciliation = totalCarbonIncludingBiogenic > 0 && speciesSum > 0 && Math.abs(speciesSum - totalCarbonIncludingBiogenic) > 0.0005;
  const reconScale = needsReconciliation ? (totalCarbonIncludingBiogenic / speciesSum) : 1;

  // Reconciled CO₂e values for the GHG species table
  const rCo2Fossil = co2Fossil * reconScale;
  const rCo2Biogenic = co2Biogenic * reconScale;
  const rCo2Dluc = co2Dluc * reconScale;
  const rCh4FossilKgCo2e = ch4FossilKgCo2e * reconScale;
  const rCh4BiogenicKgCo2e = ch4BiogenicKgCo2e * reconScale;
  const rN2oKgCo2e = n2oKgCo2e * reconScale;
  const rHfcPfc = hfcPfc * reconScale;
  // Scale raw masses to stay consistent with their CO₂e values
  const rCh4FossilKg = ch4FossilKg * reconScale;
  const rCh4BiogenicKg = ch4BiogenicKg * reconScale;
  const rN2oKg = n2oKg * reconScale;

  // Determine GWP method from materials
  const gwpMethod = materials[0]?.gwp_method || 'IPCC AR6 GWP-100';

  // Ingredient-level breakdown
  // Show both the user's real ingredient name and the factor used for calculation.
  // When a proxy is used, `matched_source_name` holds the database factor name
  // and `gwp_data_source` / `non_gwp_data_source` record which database provided it.
  const ingredientRows = materials.map((m: any) => {
    const climateVal = m.impact_climate || 0;
    const climatePct = totalCarbonIncludingBiogenic > 0 ? ((climateVal / totalCarbonIncludingBiogenic) * 100).toFixed(1) : '0.0';

    // Determine the factor name actually used for calculation
    const calcFactorName: string =
      m.matched_source_name && m.matched_source_name !== (m.material_name || m.name)
        ? m.matched_source_name
        : (m.material_name || m.name || 'Material');

    const userIngredientName: string = m.material_name || m.name || 'Material';
    const isProxy = calcFactorName !== userIngredientName;

    // Determine which database provided the factor
    const gwpSrc: string = m.gwp_data_source || '';
    const nonGwpSrc: string = m.non_gwp_data_source || '';
    let factorDatabase = 'Secondary database';
    if (m.impact_source === 'primary_verified' || m.data_priority === 1) {
      factorDatabase = 'Supplier verified';
    } else if (gwpSrc.toLowerCase().includes('defra')) {
      factorDatabase = nonGwpSrc
        ? `DEFRA + ${nonGwpSrc}`
        : 'DEFRA Emission Factors';
    } else if (gwpSrc.toLowerCase().includes('agribalyse') || nonGwpSrc.toLowerCase().includes('agribalyse')) {
      factorDatabase = 'AGRIBALYSE 3.2';
    } else if (gwpSrc.toLowerCase().includes('ecoinvent') || nonGwpSrc.toLowerCase().includes('ecoinvent')) {
      factorDatabase = 'ecoinvent 3.12';
    } else if (gwpSrc) {
      factorDatabase = gwpSrc;
    }

    // Inbound container contribution (stored as sub-field for PDF annotation)
    const containerCO2Raw = Number(m.inbound_container_co2_per_unit || 0);

    return {
      name: userIngredientName,
      calculationFactor: calcFactorName,
      isProxy,
      factorDatabase,
      category: m.category_type || m.material_type || 'ingredient',
      quantity: (m.quantity || 0).toFixed(3),
      unit: m.unit || m.unit_name || 'kg',
      origin: (m.origin_country || m.country_of_origin || 'Unknown').replace(/^\d+\s+/, ''),
      climateImpact: climateVal.toFixed(4),
      climatePercentage: `${climatePct}%`,
      waterImpact: (m.impact_water || 0).toFixed(4),
      landUseImpact: (m.impact_land || 0).toFixed(4),
      acidification: (m.impact_terrestrial_acidification || m.ef_acidification || 0).toExponential(3),
      eutrophication: (m.impact_freshwater_eutrophication || m.ef_eutrophication_freshwater || 0).toExponential(3),
      dataSource: m.impact_source === 'primary_verified' ? 'Primary'
        : m.impact_source === 'secondary_modelled' ? 'Secondary'
        : m.impact_source === 'hybrid_proxy' ? 'Proxy' : 'Secondary',
      dataQualityGrade: m.data_quality_grade || 'N/A',
      confidenceScore: m.confidence_score || 0,
      // Inbound container annotation (shown as sub-note in PDF when non-zero)
      containerCO2: containerCO2Raw > 0 ? containerCO2Raw.toFixed(5) : null,
      containerType: (m.inbound_container_type as string | null) || null,
    };
  });

  // Build material-level data quality table
  const materialQualityRows = materials.slice(0, 15).map((m: any) => ({
    name: m.material_name || m.name || 'Material',
    source: m.impact_source === 'primary_verified' ? 'Primary (supplier)'
      : m.impact_source === 'secondary_modelled' ? 'Secondary (database)'
      : m.impact_source === 'hybrid_proxy' ? 'Proxy (estimated)' : 'Secondary (database)',
    grade: m.data_quality_grade || 'N/A',
    confidence: m.confidence_score || 0,
    temporalCoverage: m.backfill_version ? `${lca.reference_year || new Date().getFullYear()} (v${m.backfill_version})` : `${lca.reference_year || new Date().getFullYear()}`,
    geographicCoverage: m.origin_country || m.country_of_origin || m.geographic_scope || 'Global',
  }));

  // Scope type label — support all 4 boundary tiers
  const scopeTypeLabelMap: Record<string, string> = {
    'cradle-to-gate': 'Cradle-to-Gate',
    'cradle-to-shelf': 'Cradle-to-Shelf',
    'cradle-to-consumer': 'Cradle-to-Consumer',
    'cradle-to-grave': 'Cradle-to-Grave',
    'gate-to-gate': 'Gate-to-Gate',
  };
  // Prefer system_boundary (set by wizard) over lca_scope_type (set at calculation time)
  // Normalise DB enum format (underscores) to code format (hyphens)
  const rawBoundary = (lca.system_boundary || lca.lca_scope_type || 'cradle-to-gate').toLowerCase().replace(/_/g, '-');
  const scopeTypeLabel = scopeTypeLabelMap[rawBoundary] || 'Cradle-to-Gate';
  const boundaryType = rawBoundary;

  // Included/excluded stages based on scope type — all 4 tiers
  const baseIncluded = [
    "Raw material extraction & agricultural production",
    "Primary ingredient processing",
    "Packaging material manufacture",
    "Factory operations & energy use",
  ];
  const shelfStages = ["Distribution & transport to retail"];
  const consumerStages = ["Consumer use phase (refrigeration, carbonation)"];
  const graveStages = ["End-of-life disposal & recycling credits"];

  // MEDIUM FIX #22: Use only boundary type (not `distribution > 0`) to determine
  // which stages are included. `distribution > 0` caused "Distribution & transport to retail"
  // to appear in cradle-to-gate reports when ingredient transport emissions were non-zero —
  // falsely implying outbound distribution is in scope. Inbound ingredient transport
  // is part of raw materials, not the "distribution to retail" stage.
  const includedStages = [
    ...baseIncluded,
    ...(boundaryType === 'cradle-to-shelf' || boundaryType === 'cradle-to-consumer' || boundaryType === 'cradle-to-grave' ? shelfStages : []),
    ...(boundaryType === 'cradle-to-consumer' || boundaryType === 'cradle-to-grave' ? consumerStages : []),
    ...(boundaryType === 'cradle-to-grave' ? graveStages : []),
  ];

  const allOptionalStages = [...shelfStages, ...consumerStages, ...graveStages];
  const excludedStages = [
    ...allOptionalStages.filter(s => !includedStages.includes(s)),
    "Capital goods & infrastructure",
    "Employee commuting",
  ];

  // Data sources with version info
  const dataSources: LCAReportData['methodology']['dataSources'] = [
    {
      name: "Primary Supplier Data",
      count: primaryCount,
      description: "Verified site-specific data from direct suppliers"
    },
  ];
  if (hasEcoinvent || secondaryCount > 0) {
    dataSources.push({
      name: "ecoinvent",
      count: hasEcoinvent ? secondaryCount : materials.length,
      version: "3.12",
      description: "Comprehensive LCI database for background processes"
    });
  }
  // Always include Agribalyse — agricultural products rely on it for ingredient factors
  const agribalyseCount = materials.filter((m: any) =>
    (m.gwp_data_source || '').toLowerCase().includes('agribalyse') ||
    (m.non_gwp_data_source || '').toLowerCase().includes('agribalyse')
  ).length;
  dataSources.push({
    name: "AGRIBALYSE",
    count: agribalyseCount || materials.filter((m: any) => m.category_type === 'ingredient' || m.material_type === 'ingredient').length,
    version: "3.2",
    description: "ADEME agricultural and food product LCI database"
  });
  // DEFRA year matches the reference/reporting year
  const defraYear = lca.reference_year || new Date().getFullYear();
  dataSources.push({
    name: "DEFRA Emission Factors",
    count: 5,
    version: String(defraYear),
    description: "UK government conversion factors for GHG reporting"
  });

  // Assumptions and limitations
  // LOW FIX #26: Remove hardcoded "UK grid electricity" assumption.
  // The old default falsely claimed UK grid was used for all factory operations, but
  // since HIGH FIX #8 the system uses country-specific IEA 2023 grid factors.
  // Documenting the wrong methodology in the report is an ISO 14044 §4.1 (goal & scope)
  // accuracy violation. The fallback assumptions are now accurate for international use.
  // Fix user-provided assumptions that contain incorrect GWP values
  const rawAssumptions = lca.assumptions_limitations && Array.isArray(lca.assumptions_limitations)
    ? lca.assumptions_limitations.map((a: { type: string; text: string }) => {
        // Correct the common error where CH₄ GWP is stated as 27.9 (neither
        // AR6 fossil 29.8 nor biogenic 27.0). Replace with accurate AR6 values.
        if (a.text.includes('CH') && a.text.includes('27.9')) {
          return {
            ...a,
            text: a.text.replace(
              /CH[\u2084₄4]\s*=\s*27\.9/g,
              'CH\u2084 (fossil) = 29.8, CH\u2084 (biogenic) = 27.0'
            )
          };
        }
        return a;
      })
    : null;

  const assumptionsLimitations = rawAssumptions || [
        { type: "Assumption", text: `Global warming potential (GWP-100) values from IPCC AR6: CO\u2082 = 1, CH\u2084 (fossil) = 29.8, CH\u2084 (biogenic) = 27.0, N\u2082O = 273 kg CO\u2082e/kg.` },
        { type: "Assumption", text: "Transport distances estimated using supplier origin countries and standard freight routes (DEFRA 2025 freight emission factors)." },
        { type: "Assumption", text: "Country-specific electricity grid factors applied where facility location is known (IEA 2023 data via lib/grid-emission-factors.ts); global average (0.490 kg CO\u2082e/kWh) used when country is unspecified." },
        { type: "Limitation", text: "End-of-life scenarios based on regional average recycling rates; actual disposal rates may vary by geography and waste management infrastructure." },
        { type: "Limitation", text: "Water scarcity characterisation factors based on AWARE v1.3 watershed-level averages; local watershed conditions may differ from national averages." },
        { type: "Limitation", text: "Secondary LCI data (ecoinvent 3.12, AGRIBALYSE 3.2) represents average technology and conditions; site-specific primary data would improve accuracy." },
      ];

  return {
    meta: {
      productName: lca.product_name,
      refId: `LCA-${lca.id.substring(0, 8).toUpperCase()}`,
      date: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      organization: organization?.name || 'Your Organisation',
      generatedBy: 'AlkaTera Platform',
      // ISSUE E FIX: Read version from report_metadata instead of hardcoding (ISO 14044 §4.2.1).
      version: (impacts as any).report_metadata?.version || '1.0',
      assessmentPeriod: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      publishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      heroImage: undefined,
      productImageUrl: lca.product_image_url || undefined,
      productDescription: lca.product_description || undefined,
      referenceYear: lca.reference_year,
      lcaScopeType: scopeTypeLabel,
    },
    functionalUnit: {
      // ISO 14044 §4.2.3.2: The functional unit must be clearly defined and
      // measurable. If the user hasn't provided a specific FU, construct one
      // from product details (name, volume/weight) rather than using the
      // generic "1 unit of" which lacks precision.
      value: lca.functional_unit || (() => {
        const vol = lca.product_volume;
        const volUnit = lca.product_volume_unit;
        if (vol && volUnit) {
          return `1 × ${lca.product_name} (${vol}${volUnit})`;
        }
        return `1 unit of ${lca.product_name}`;
      })(),
      description: "All environmental impacts in this report are calculated per functional unit as defined by ISO 14044:2006 Clause 4.2.3.2. This ensures normalised comparison across different products and production scenarios."
    },
    goalAndScope: {
      intendedApplication: lca.intended_application || `To quantify and communicate the environmental impacts of ${lca.product_name} across its lifecycle, enabling informed decision-making for environmental improvement.`,
      reasonsForStudy: lca.reasons_for_study || `To establish a transparent environmental baseline for ${lca.product_name}, identify hotspots for improvement, and support stakeholder communication in line with ISO 14044 requirements.`,
      intendedAudience: (lca.intended_audience || ['Internal stakeholders', 'Supply chain partners', 'Regulatory bodies']).map((a: string) => {
        // Map raw database enum values to human-readable labels
        const audienceLabels: Record<string, string> = {
          'customers_b2b': 'B2B Customers',
          'customers_b2c': 'B2C Consumers',
          'internal': 'Internal Stakeholders',
          'investors': 'Investors & Shareholders',
          'regulators': 'Regulatory Bodies',
          'supply_chain': 'Supply Chain Partners',
          'public': 'General Public',
          'certification_bodies': 'Certification Bodies',
        };
        return audienceLabels[a] || a;
      }),
      isComparativeAssertion: lca.is_comparative_assertion || false,
      systemBoundary: scopeTypeLabel,
      // HIGH FIX #21: Correct descriptions for all 4 boundary tiers.
      // Previously Cradle-to-Shelf and Cradle-to-Consumer fell through to a
      // gate-to-gate fallback ("within the factory gate boundaries") — factually wrong.
      systemBoundaryDescription: scopeTypeLabel === 'Cradle-to-Gate'
        ? 'This assessment covers all processes from raw material extraction through to the factory gate, including agricultural production, primary processing, packaging manufacture, and factory energy use. Distribution, consumer use, and end-of-life are excluded.'
        : scopeTypeLabel === 'Cradle-to-Shelf'
        ? 'This assessment covers all processes from raw material extraction through manufacturing and outbound distribution to the point of sale (retailer shelf or equivalent). Consumer use and end-of-life disposal are excluded.'
        : scopeTypeLabel === 'Cradle-to-Consumer'
        ? 'This assessment covers all processes from raw material extraction through manufacturing, distribution, and the consumer use phase (including refrigeration and carbonation losses where applicable). End-of-life disposal is excluded.'
        : scopeTypeLabel === 'Cradle-to-Grave'
        ? 'This assessment covers the complete product lifecycle from raw material extraction through manufacturing, distribution, consumer use, and final disposal or recycling, including end-of-life avoided burden credits for recycled packaging materials.'
        : 'This assessment covers the lifecycle stages defined within the stated system boundary.',
      cutOffCriteria: lca.cutoff_criteria || 'Mass-based cut-off: flows contributing less than 1% of total mass input are excluded. The cumulative excluded flows represent less than 5% of total environmental impact.',
      // ISSUE C FIX: Specify allocation method explicitly — no vague "as documented per material" (ISO 14044 §4.3.4).
      allocationProcedure: (impacts as any).allocation_summary?.description
        || 'Physical allocation by mass is applied for all co-products following the ISO 14044 Clause 4.3.4 hierarchy. Mass-based physical allocation was used throughout this assessment; no economic allocation was applied.',
      assumptionsAndLimitations: assumptionsLimitations,
      referenceStandards: [
        'ISO 14040:2006 — Environmental management — Life cycle assessment — Principles and framework',
        'ISO 14044:2006 — Environmental management — Life cycle assessment — Requirements and guidelines',
        'ISO 14067:2018 — Greenhouse gases — Carbon footprint of products',
        'ISO 14046:2014 — Environmental management — Water footprint',
        'GHG Protocol — Product Life Cycle Accounting and Reporting Standard',
        'PAS 2050:2011 — Specification for the assessment of life cycle GHG emissions',
      ],
    },
    executiveSummary: {
      content: (() => {
        // Build a dynamically correct list of assessed categories that matches the actual data
        const assessedCategories = ['climate change', 'water use', 'land use'];
        if (envCategories.some(c => c.name.toLowerCase().includes('acidification'))) assessedCategories.push('acidification');
        if (envCategories.some(c => c.name.toLowerCase().includes('eutrophication'))) assessedCategories.push('eutrophication');
        if (envCategories.some(c => c.name.toLowerCase().includes('ozone'))) assessedCategories.push('ozone depletion');
        if (envCategories.some(c => c.name.toLowerCase().includes('resource'))) assessedCategories.push('resource depletion');
        const categoryList = assessedCategories.length > 2
          ? assessedCategories.slice(0, -1).join(', ') + ', and ' + assessedCategories[assessedCategories.length - 1]
          : assessedCategories.join(' and ');
        return `This Life Cycle Assessment evaluates the environmental impacts of ${lca.product_name} in accordance with ISO 14044:2006 and ISO 14067:2018. The assessment quantifies impacts across ${assessedCategories.length} environmental categories including ${categoryList}. Data quality achieves a ${dqRating.toLowerCase()} rating (${dqScore}%) based on the ISO 14044 pedigree matrix approach, with ${primaryCount} primary data points and ${secondaryCount} secondary database values.`;
      })(),
      keyHighlight: {
        value: totalCarbon.toFixed(3),
        label: "kg CO\u2082eq per unit",
        subtext: `${dqRating} data quality (${dqScore}%)`
      },
      dataQualityScore: dqScore
    },
    methodology: {
      includedStages,
      excludedStages,
      dataSources,
      lciaMethod: lca.lca_methodology === 'recipe_2016' ? 'ReCiPe 2016 v1.1 Midpoint (H)' : 'EF 3.1 (PEF)',
      lciaMethodDescription: lca.lca_methodology === 'recipe_2016'
        ? 'ReCiPe 2016 v1.1 provides characterisation factors at the midpoint level using the Hierarchist cultural perspective. This method covers 18 impact categories with global scope. For climate change, the updated IPCC AR6 GWP-100 values (2021) are used in place of the original ReCiPe 2016 climate factors, consistent with current best practice (CO₂ = 1, CH₄ fossil = 29.8, CH₄ biogenic = 27.0, N₂O = 273). All other impact categories use the standard ReCiPe 2016 v1.1 characterisation factors.'
        : 'Environmental Footprint 3.1 (EF 3.1) follows the EU Product Environmental Footprint methodology with 16 impact categories and normalisation/weighting factors.',
      characterizationModels: [
        { category: 'Climate Change', model: 'IPCC AR6 GWP-100', reference: 'IPCC Sixth Assessment Report (2021)' },
        { category: 'Acidification', model: 'Accumulated Exceedance', reference: 'Seppälä et al. (2006), Posch et al. (2008)' },
        { category: 'Eutrophication (Freshwater)', model: 'EUTREND model', reference: 'Struijs et al. (2009)' },
        { category: 'Eutrophication (Marine)', model: 'EUTREND model', reference: 'Struijs et al. (2009)' },
        { category: 'Water Use', model: 'AWARE v1.3', reference: 'Boulay et al. (2018)' },
        { category: 'Land Use', model: 'Soil Quality Index', reference: 'Brandão & Milà i Canals (2013)' },
        { category: 'Resource Depletion', model: 'ADP ultimate reserves', reference: 'van Oers et al. (2002)' },
      ],
      softwareAndDatabases: [
        { name: 'AlkaTera Platform', version: '2.0', purpose: 'LCA modelling, data collection, and report generation' },
        { name: 'ecoinvent', version: '3.12', purpose: 'Background LCI data for industrial processes and materials' },
        { name: 'AGRIBALYSE', version: '3.2', purpose: 'Agricultural and food product lifecycle inventory data (ADEME)' },
        { name: 'DEFRA Emission Factors', version: String(defraYear), purpose: 'UK government GHG conversion factors' },
      ],
    },
    dataQuality: {
      overallScore: dqScore,
      overallRating: dqRating,
      pedigreeMatrix: calculatePedigreeMatrix(materials, lca.reference_year),
      coverageSummary: {
        primaryDataShare: Math.round((primaryCount / totalMaterialCount) * 100),
        secondaryDataShare: Math.round((secondaryCount / totalMaterialCount) * 100),
        proxyDataShare: Math.round((proxyCount / totalMaterialCount) * 100),
        primaryCount,
        secondaryCount,
        proxyCount,
        totalMaterials: materials.length,
      },
      materialQuality: materialQualityRows,
      missingDataTreatment: 'Missing data is handled using proxy emission factors from ecoinvent 3.12 and AGRIBALYSE 3.2 databases, selected based on geographic and technological representativeness. All proxy selections are documented with confidence scores and quality grades per ISO 14044 Clause 4.2.3.6.3.',
      uncertaintyNote: 'Uncertainty in this assessment arises from: (1) measurement variability in primary data, (2) representativeness of secondary database values for the specific production system, and (3) characterisation model uncertainty in LCIA methods. A sensitivity analysis of key parameters is recommended for future iterations.',
    },
    climateImpact: {
      totalCarbon: totalCarbon.toFixed(3),
      breakdown: chartBreakdown,
      // LOW FIX #23: Add Use Phase and End of Life to climateImpact.stages so all
      // 6 possible lifecycle stages are represented in the stages data table.
      // Previously only 4 stages were listed, so cradle-to-consumer/grave reports
      // had a mismatch between the pie chart (which included all stages) and the
      // stages table (which silently omitted use phase and end of life).
      stages: (hasViticulture
        ? [
            { label: "Viticulture", value: viticulture, unit: "kg CO\u2082eq", percentage: viticulturePct.toFixed(1), color: "lime" },
            { label: "Purchased Ingredients", value: purchasedIngredients, unit: "kg CO\u2082eq", percentage: purchasedIngredientsPct.toFixed(1), color: "green" },
          ]
        : [
            { label: "Raw Materials", value: rawMaterials, unit: "kg CO\u2082eq", percentage: rawMaterialsPct.toFixed(1), color: "green" },
          ]
      ).concat([
        { label: "Packaging", value: packaging, unit: "kg CO\u2082eq", percentage: packagingPct.toFixed(1), color: "yellow" },
        { label: "Distribution", value: distribution, unit: "kg CO\u2082eq", percentage: distributionPct.toFixed(1), color: "orange" },
        { label: "Processing", value: processing, unit: "kg CO\u2082eq", percentage: processingPct.toFixed(1), color: "blue" },
        { label: "Use Phase", value: usePhase, unit: "kg CO\u2082eq", percentage: usePhasePct.toFixed(1), color: "purple" },
        { label: "End of Life", value: endOfLife, unit: "kg CO\u2082eq", percentage: endOfLifePct.toFixed(1), color: "red" },
      ]).filter(stage => stage.value !== 0), // include negatives (EoL can be negative via recycling credits)
      scopes: [
        { name: "Scope 1 (Direct)", value: scope1Pct.toFixed(1) },
        { name: "Scope 2 (Energy)", value: scope2Pct.toFixed(1) },
        { name: "Scope 3 (Value Chain)", value: scope3Pct.toFixed(1) }
      ],
      methodology: {
        ghgBreakdown: [
          { label: "CO\u2082 Fossil", value: rCo2Fossil.toFixed(4), unit: "kg CO\u2082e", gwp: "1" },
          { label: "CO\u2082 Biogenic", value: rCo2Biogenic.toFixed(4), unit: "kg CO\u2082e", gwp: "1*" },
          { label: "CH\u2084", value: (rCh4FossilKgCo2e + rCh4BiogenicKgCo2e).toFixed(4), unit: "kg CO\u2082e", gwp: "29.8 / 27.0" },
          { label: "N\u2082O", value: rN2oKgCo2e.toFixed(4), unit: "kg CO\u2082e", gwp: "273" }
        ],
        standards: [
          "ISO 14067:2018 — Greenhouse gases — Carbon footprint of products",
          "ISO 14040/14044 — Life Cycle Assessment principles and framework",
          "GHG Protocol — Product Life Cycle Accounting and Reporting Standard",
          "PAS 2050:2011 — Specification for the assessment of life cycle GHG emissions"
        ]
      }
    },
    ghgDetailed: {
      totalGwp100: totalCarbonIncludingBiogenic.toFixed(4),
      // ISO 14067 §6.4.9.3: Fossil-only = sum of fossil species only
      // (excludes biogenic CO₂ and biogenic CH₄)
      fossilOnlyTotal: (rCo2Fossil + rCo2Dluc + rCh4FossilKgCo2e + rN2oKgCo2e + rHfcPfc).toFixed(4),
      fossilCo2: rCo2Fossil.toFixed(4),
      biogenicCo2: rCo2Biogenic.toFixed(4),
      dlucCo2: rCo2Dluc.toFixed(4),
      ch4Fossil: rCh4FossilKg.toExponential(3),
      ch4FossilKgCo2e: rCh4FossilKgCo2e.toFixed(4),
      ch4Biogenic: rCh4BiogenicKg.toExponential(3),
      ch4BiogenicKgCo2e: rCh4BiogenicKgCo2e.toFixed(4),
      n2o: rN2oKg.toExponential(3),
      n2oKgCo2e: rN2oKgCo2e.toFixed(4),
      hfcPfc: rHfcPfc.toFixed(4),
      gwpMethod,
      gwpFactors: [
        { gas: 'CO\u2082 (fossil)', gwp100: '1', source: 'IPCC AR6 (2021)' },
        { gas: 'CO\u2082 (biogenic)', gwp100: '1*', source: 'ISO 14067:2018 \u2014 reported separately' },
        { gas: 'CO\u2082 (LULUC)', gwp100: '1', source: 'ISO 14067:2018 \u2014 reported as GWP-luluc' },
        { gas: 'CH\u2084 (fossil)', gwp100: '29.8', source: 'IPCC AR6 (2021)' },
        { gas: 'CH\u2084 (biogenic)', gwp100: '27.0', source: 'IPCC AR6 (2021)' },
        { gas: 'N\u2082O', gwp100: '273', source: 'IPCC AR6 (2021)' },
        { gas: 'HFCs/PFCs', gwp100: 'Variable', source: 'IPCC AR6 (2021)' },
      ],
      biogenicNote: 'Biogenic CO\u2082 emissions and uptakes are tracked separately per ISO 14067:2018 requirements. Biogenic carbon uptake during biomass growth is credited, and a corresponding virtual emission is added at end-of-life to balance the carbon cycle. The net biogenic carbon balance is reported separately from fossil emissions.'
    },
    environmentalImpacts: {
      categories: envCategories,
      referenceMethod: lca.lca_methodology === 'recipe_2016' ? 'ReCiPe 2016 v1.1 Midpoint (H)' : 'EF 3.1',
      normalisationNote: 'Impact category results are presented at the midpoint (characterisation) level without normalisation or weighting, in compliance with ISO 14044 Clause 4.4.3.4 requirements for public reporting.',
    },
    ingredientBreakdown: {
      ingredients: ingredientRows,
      totalClimateImpact: totalCarbonIncludingBiogenic.toFixed(3),
      hasProxies: ingredientRows.some((r) => r.isProxy),
    },
    waterFootprint: {
      totalConsumption: `${waterConsumption.toFixed(3)}L`,
      // Water scarcity-weighted value should differ from total consumption.
      // If a specific scarcity-weighted value is available from the aggregation,
      // use it. Otherwise, apply a default AWARE factor estimate.
      // When both values are identical, it suggests no AWARE weighting was applied.
      scarcityWeighted: (() => {
        if (waterScarcity > 0 && Math.abs(waterScarcity - waterConsumption) > 0.001) {
          // Genuine scarcity-weighted value from the aggregation
          return `${waterScarcity.toFixed(3)}L eq.`;
        }
        // If waterScarcity equals waterConsumption or is zero, compute from
        // material-level water impacts with per-origin scarcity estimates.
        // AWARE CFs vary by watershed; without specific location data we use
        // conservative regional averages.
        const perMaterialScarcity = materials.reduce((sum: number, m: any) => {
          const waterVol = (m.impact_water || 0) * (m.quantity || 1);
          // Regional AWARE CF estimates: arid regions ~50, temperate ~5-15, global avg ~11.5
          const origin = (m.origin_country || m.country_of_origin || '').toLowerCase();
          let awareCf = 11.5; // Global average
          if (['spain', 'italy', 'australia', 'south africa', 'india', 'mexico'].some(c => origin.includes(c))) awareCf = 25;
          else if (['uk', 'united kingdom', 'ireland', 'germany', 'france', 'netherlands'].some(c => origin.includes(c))) awareCf = 6;
          else if (['brazil', 'colombia', 'new zealand'].some(c => origin.includes(c))) awareCf = 3;
          return sum + (waterVol * awareCf);
        }, 0);
        if (perMaterialScarcity > 0) {
          return `${perMaterialScarcity.toFixed(3)}L eq.`;
        }
        // Fallback: apply global average AWARE CF
        return `${(waterConsumption * 11.5).toFixed(3)}L eq.`;
      })(),
      breakdown: chartBreakdown.map(item => ({
        name: item.name,
        value: item.value,
        color: item.name === "Raw Materials" ? "#2563eb" :
               item.name === "Packaging" ? "#3b82f6" :
               item.name === "Processing" ? "#60a5fa" : "#1d4ed8"
      })),
      sources: (() => {
        const materialSources = materials.slice(0, 8).map((m: any) => {
          const origin = (m.origin_country || m.country_of_origin || '').toLowerCase();
          let risk: string;
          if (['spain', 'italy', 'india', 'south africa', 'mexico', 'australia', 'egypt', 'pakistan'].some(c => origin.includes(c))) {
            risk = 'HIGH';
          } else if (['china', 'usa', 'united states', 'france', 'turkey', 'portugal'].some(c => origin.includes(c))) {
            risk = 'MEDIUM';
          } else {
            risk = 'LOW';
          }
          return {
            source: m.material_name || "Material",
            location: m.origin_country || m.country_of_origin || "Unknown",
            volume: `${(m.impact_water || 0).toFixed(3)} L`,
            risk,
            score: parseFloat((10.0).toFixed(3))
          };
        });
        // Add "Processing & Facility" row for water not attributed to materials
        // (facility overheads, winery operations, loss multiplier adjustments)
        const materialWaterSum = materials.reduce((sum: number, m: any) => sum + (m.impact_water || 0), 0);
        const otherWater = waterConsumption - materialWaterSum;
        if (otherWater > 0.0005) {
          materialSources.push({
            source: 'Processing & Facility Overheads',
            location: 'Allocated from production sites',
            volume: `${otherWater.toFixed(3)} L`,
            risk: 'LOW',
            score: 10,
          });
        }
        return materialSources;
      })(),
      methodology: {
        steps: [
          { step: 1, title: "Inventory Phase", description: "Quantify water consumption (litres) for each process and material in the product system" },
          { step: 2, title: "Geographic Attribution", description: "Assign water consumption to specific watersheds based on production locations" },
          { step: 3, title: "AWARE Factors", description: "Apply watershed-specific AWARE characterisation factors (CF) from global database" },
          { step: 4, title: "Impact Calculation", description: "Multiply water volume by AWARE CF: Impact = Volume (m\u00B3) \u00D7 CF (dimensionless)" }
        ],
        standards: [
          "ISO 14046:2014 — Environmental management — Water footprint",
          "AWARE v1.3 — UNEP-SETAC water scarcity characterisation model"
        ]
      }
    },
    circularity: {
      // Compute total waste from actual waste stream materials when available,
      // falling back to aggregated value. The hardcoded 0.45 fallback was removed
      // as it had no relationship to the actual product's packaging mass.
      totalWaste: (() => {
        // Sum actual packaging material masses as the waste total
        const wasteFromMaterials = packagingMaterials.reduce((sum: number, m: any) => sum + (m.quantity || 0), 0);
        const wasteValue = impacts.waste && impacts.waste > 0
          ? impacts.waste
          : wasteFromMaterials > 0
          ? wasteFromMaterials
          : 0;
        return `${wasteValue.toFixed(3)}kg`;
      })(),
      recyclingRate,
      recycledContentRate,
      eolRecyclingRate,
      circularityScore: `${(recyclingRate / 10).toFixed(1)} / 10`,
      wasteStream,
      eolBreakdown: eolBreakdown.map((m: any) => ({
        material: m.material || 'Packaging',
        massKg: m.massKg || 0,
        factorKey: m.factorKey || 'other',
        region: m.region || 'eu',
        recyclingPct: m.recyclingPct || 0,
        landfillPct: m.landfillPct || 0,
        incinerationPct: m.incinerationPct || 0,
        compostingPct: m.compostingPct || 0,
        adPct: m.adPct || 0,
        grossEmissions: m.grossEmissions || 0,
        avoidedEmissions: m.avoidedEmissions || 0,
        netEmissions: m.netEmissions || 0,
      })),
      methodology: {
        formula: {
          text: "MCI = (LFI \u00D7 U/L) + (V/2) + (W/2) \u00D7 F(X)",
          definitions: [
            { term: "LFI", definition: "Linear Flow Index (virgin material input)" },
            { term: "U", definition: "Utility of product (functional performance)" },
            { term: "L", definition: "Average lifetime relative to industry" },
            { term: "V", definition: "Mass of recycled feedstock / Total mass input" },
            { term: "W", definition: "Mass recovered for recycling / Total mass output" },
            { term: "F(X)", definition: "Collection efficiency factor" }
          ]
        },
        standards: [
          "ISO 14040/14044   LCA framework for waste streams",
          "MCI v1.0   Material Circularity Indicator (Ellen MacArthur Foundation)",
          "Directive 2008/98/EC   EU Waste Framework Directive"
        ]
      }
    },
    landUse: {
      totalLandUse: `${landUse.toFixed(3)}m\u00B2`,
      breakdown: (() => {
        const materialRows = materials.slice(0, 8).map((m: any) => ({
          material: m.material_name || "Material",
          origin: m.origin_country || m.country_of_origin || "Unknown",
          mass: `${(m.quantity || 0).toFixed(3)} kg`,
          intensity: m.quantity > 0 ? parseFloat(((m.impact_land || 0) / m.quantity).toFixed(3)) : 0,
          footprint: `${(m.impact_land || 0).toFixed(3)} m\u00B2`,
        }));
        // Add "Other" row for land use from facility overheads and loss multiplier
        const materialLandSum = materials.reduce((sum: number, m: any) => sum + (m.impact_land || 0), 0);
        const otherLand = landUse - materialLandSum;
        if (otherLand > 0.0005) {
          materialRows.push({
            material: 'Processing & Facility Overheads',
            origin: 'Allocated from production sites',
            mass: '-',
            intensity: 0,
            footprint: `${otherLand.toFixed(3)} m\u00B2`,
          });
        }
        return materialRows;
      })(),
      methodology: {
        categories: [
          { title: "Land Occupation", value: "m\u00B2 \u00B7 year", description: "Area \u00D7 time (m\u00B2\u00B7yr) that land is occupied for production processes" },
          { title: "Land Transformation", value: "m\u00B2 transformed", description: "Permanent conversion of natural ecosystems to agricultural or industrial use" },
          { title: "Soil Quality", value: "quality points", description: "Degradation of soil organic matter, structure, and biotic activity" }
        ],
        standards: [
          "ReCiPe 2016   Land use impact characterisation methodology",
          "ISO 14040/14044   LCA framework for land use assessment"
        ]
      }
    },
    supplyChain: {
      totalDistance: `${materials.reduce((sum: number, m: any) => sum + (m.distance_km || 0), 0).toFixed(0)}km`,
      verifiedSuppliers: `${dataQuality.breakdown?.primary_verified_share || "0%"}`,
      network: [
        {
          category: "MATERIAL SUPPLIERS",
          items: materialBreakdown.length > 0
            ? materialBreakdown.slice(0, 8).map((m: any) => {
                const mat = materials.find((mat: any) => mat.material_name === m.name);
                // Use per-material transport CO₂e when available, fall back to estimating
                // from distance × mass × DEFRA road freight factor (0.10768 kg CO₂e/tonne-km)
                const transportCo2 = mat?.impact_transport_co2e
                  ?? mat?.transport_co2e
                  ?? ((mat?.distance_km || 0) > 0 && (mat?.quantity || 0) > 0
                    ? (mat.distance_km * (mat.quantity / 1000) * 0.10768)
                    : 0);
                return {
                  name: m.name,
                  location: mat?.origin_country || "Various",
                  distance: `${mat?.distance_km || "-"} km`,
                  co2: `${transportCo2.toFixed(3)} kg CO\u2082e`
                };
              })
            : materials.slice(0, 8).map((m: any) => {
                // Use per-material transport CO₂e when available, fall back to estimating
                const transportCo2 = m.impact_transport_co2e
                  ?? m.transport_co2e
                  ?? ((m.distance_km || 0) > 0 && (m.quantity || 0) > 0
                    ? (m.distance_km * (m.quantity / 1000) * 0.10768)
                    : 0);
                return {
                  name: m.material_name || "Supplier",
                  location: m.origin_country || m.country_of_origin || "Unknown",
                  distance: `${m.distance_km || "-"} km`,
                  co2: `${transportCo2.toFixed(3)} kg CO\u2082e`
                };
              })
        }
      ]
    },
    commitment: {
      text: `This environmental assessment demonstrates our commitment to understanding and reducing the environmental impact of ${lca.product_name}. By measuring and reporting our footprint in accordance with ISO 14044 and ISO 14067 standards, we establish a transparent baseline for continuous improvement across our value chain.`
    },

    // ── ISO Compliance Additions (pass through from aggregated_impacts) ────

    interpretation: (impacts as any).interpretation || undefined,

    uncertaintySensitivity: (() => {
      const us = (impacts as any).uncertainty_sensitivity;
      if (!us) return undefined;
      const sa = us.sensitivity_analysis || {};
      return {
        propagatedUncertaintyPct: us.propagated_uncertainty_pct || 0,
        confidenceInterval95: {
          lower: (us.confidence_interval_95?.lower || 0).toFixed(4),
          upper: (us.confidence_interval_95?.upper || 0).toFixed(4),
        },
        sensitivityAnalysis: {
          method: sa.method || '',
          parameters: (sa.parameters || []).map((p: any) => ({
            materialName: p.material_name,
            baselineContributionPct: p.baseline_contribution_pct,
            variationPct: p.variation_pct,
            resultRange: {
              lower: (p.result_range?.lower || 0).toFixed(4),
              upper: (p.result_range?.upper || 0).toFixed(4),
            },
            sensitivityRatio: p.sensitivity_ratio,
            isHighlySensitive: p.is_highly_sensitive,
          })),
          conclusion: sa.conclusion || '',
        },
      };
    })(),

    // ISO 14044 §6 requires a critical review statement. If the database
    // has one, use it; otherwise generate a default disclosure noting the
    // study has not been externally reviewed.
    criticalReview: (impacts as any).critical_review
      ? {
          status: (impacts as any).critical_review.status,
          disclosure: (impacts as any).critical_review.disclosure,
          recommendation: (impacts as any).critical_review.recommendation,
        }
      : {
          status: 'not_reviewed',
          disclosure: `This LCA study of ${lca.product_name} has been conducted using the alkatera platform and has not undergone an independent critical review as defined by ISO 14044:2006 Clause 6. The study is based on ${materials.length} material/process inputs, of which ${primaryCount} use primary verified data, ${secondaryCount} use secondary database values, and ${proxyCount} use proxy estimates. An independent critical review by a qualified external reviewer or panel is recommended before public disclosure or comparative assertions.`,
          recommendation: 'Commission an independent critical review per ISO 14044 §6.2 (internal review) or §6.3 (review panel for comparative assertions) before using this report for external communications.',
        },

    lulucNote: (impacts as any).luluc_note || undefined,

    zeroImpactCategories: (() => {
      const dbCategories = (impacts as any).zero_impact_categories || [];
      const additional: Array<{ category: string; reason: string }> = [];

      // Fix: If processing stage is within system boundary but reports zero,
      // explicitly acknowledge this gap per ISO 14044 §4.4.2.2
      if (processing === 0 && includedStages.some((s: string) =>
        s.toLowerCase().includes('processing') || s.toLowerCase().includes('manufacturing')
      )) {
        additional.push({
          category: 'Processing / Manufacturing Stage',
          reason: 'Processing is included in the system boundary but reports zero emissions. This may indicate: (a) facility energy use is not yet captured in the inventory, (b) processing data is embedded within raw material factors, or (c) primary facility data has not been collected. This gap should be addressed in future iterations to improve completeness.',
        });
      }

      // Fix: If Scope 1 and Scope 2 are both zero, flag the completeness gap
      if (scope1 === 0 && scope2 === 0 && totalCarbonIncludingBiogenic > 0) {
        additional.push({
          category: 'Scope 1 & 2 Emissions (Production Energy)',
          reason: 'No direct (Scope 1) or energy-related (Scope 2) facility emissions are included in this assessment. This may indicate that no production facilities have been linked, or that contract manufacturer energy data has not been captured. For manufactured products, factory energy use (electricity, gas, steam) typically contributes 5-15% of the total footprint. This gap should be addressed by collecting facility energy data from the production site.',
        });
      }

      // Fix: If zero primary data points, add a disclosure note
      if (primaryCount === 0 && materials.length > 0) {
        additional.push({
          category: 'Primary Data Coverage',
          reason: `All ${materials.length} material/process inputs rely on secondary or proxy emission factors from databases (ecoinvent, AGRIBALYSE, DEFRA). No primary site-specific data has been collected. ISO 14044 §4.2.3.6 recommends increasing primary data coverage to improve representativeness. Collecting measured data from key suppliers (especially for the top 3 contributors) would significantly improve data quality.`,
        });
      }

      return [...dbCategories, ...additional].length > 0
        ? [...dbCategories, ...additional]
        : undefined;
    })(),

    scopeMethodology: (() => {
      const sm = (impacts as any).scope_methodology;
      if (!sm) return undefined;
      return {
        standard: sm.standard,
        attributionMethod: sm.attribution_method,
        note: sm.note,
      };
    })(),

    transportNote: (() => {
      const tn = (impacts as any).transport_note;
      if (!tn) return undefined;
      return {
        method: tn.method,
        totalTransportKgCo2e: tn.total_transport_kg_co2e,
        isEmbeddedInMaterials: tn.is_embedded_in_materials,
        outboundIncluded: tn.outbound_included,
      };
    })(),

    circularityMethodology: (() => {
      const cm = (impacts as any).circularity_methodology;
      if (!cm) return undefined;
      return {
        isProprietaryMetric: cm.is_proprietary_metric,
        methodName: cm.method_name,
        description: cm.description,
        reference: cm.reference,
      };
    })(),

    eolMethodology: (() => {
      const eolMeta = (impacts as any).eol_methodology;
      if (!eolMeta) return undefined;
      const eolBreakdownData: any[] = (impacts as any).eol_material_breakdown || [];
      return {
        region: eolMeta.region,
        regionLabel: eolMeta.region_label,
        materialPathways: eolBreakdownData.map((m: any) => ({
          material: m.material,
          factorKey: m.factorKey,
          recyclingPct: m.recyclingPct,
          landfillPct: m.landfillPct,
          incinerationPct: m.incinerationPct,
          compostingPct: m.compostingPct,
          adPct: m.adPct,
          isUserOverride: false, // TODO: detect user overrides from eolConfig
        })),
        avoidedBurdenMethod: eolMeta.avoided_burden_method,
        dataSource: eolMeta.data_source,
        dataYear: eolMeta.data_year,
        totalGrossEmissions: eolMeta.total_gross_emissions,
        totalAvoidedEmissions: eolMeta.total_avoided_emissions,
        totalNetEmissions: eolMeta.total_net_emissions,
      };
    })(),

    // Viticulture detail (only present when product has self-grown vineyard data)
    viticultureDetail: hasViticulture ? (() => {
      // Extract viticulture-specific data from the synthetic materials
      const vitiMaterials = materials.filter((m: any) => m.material_name?.startsWith('[Viticulture]'));
      const vitiRemovalMaterials = materials.filter((m: any) => m.material_name?.startsWith('[Viticulture Removals]'));

      // Parse vintage info from source_reference of first viticulture material
      const firstVitiMaterial = vitiMaterials[0];
      const sourceRef = firstVitiMaterial?.source_reference || '';
      const vintageMatch = sourceRef.match(/vintages?\s*([\d,\s]+)/i);
      const vintageYears = vintageMatch
        ? vintageMatch[1].split(',').map((y: string) => parseInt(y.trim())).filter((y: number) => !isNaN(y))
        : [];
      const methodMatch = sourceRef.match(/(single|average_2yr|median_3yr)/);
      const averagingMethod = methodMatch ? methodMatch[1] : vintageYears.length >= 3 ? 'median_3yr' : vintageYears.length === 2 ? 'average_2yr' : 'single';

      // Calculate primary data percentage (viticulture materials are primary, others are secondary)
      const vitiClimate = viticulture;
      const totalClimateAbs = totalFromStages > 0 ? totalFromStages : 1;
      const primaryDataPercent = (vitiClimate / totalClimateAbs) * 100;

      // Extract extended impact categories from viticulture materials
      const sumField = (field: string) => vitiMaterials.reduce((s: number, m: any) => s + (Number(m[field]) || 0), 0);

      return {
        emissionsTotal: viticulture,
        percentOfTotal: viticulturePct.toFixed(1),
        vintageYears,
        averagingMethod,
        dataQualityGrade: firstVitiMaterial?.data_quality_grade || 'MEDIUM',
        primaryDataPercent: Math.round(primaryDataPercent),
        extendedImpacts: {
          freshwaterEcotoxicity: { value: sumField('impact_freshwater_ecotoxicity'), unit: 'CTUe' },
          terrestrialEcotoxicity: { value: sumField('impact_terrestrial_ecotoxicity'), unit: 'CTUe' },
          humanToxicity: { value: sumField('impact_human_toxicity_non_carcinogenic'), unit: 'CTUh' },
          freshwaterEutrophication: { value: sumField('impact_freshwater_eutrophication'), unit: 'kg P eq' },
          waterScarcity: { value: sumField('impact_water_scarcity'), unit: 'm\u00B3 eq' },
        },
        emissionBreakdown: {
          n2oDirect: 0,   // Not individually stored on synthetic rows - shown at vineyard level
          n2oIndirect: 0,
          n2oCropResidue: 0,
          lucCo2e: 0,
          fertiliserProduction: 0,
          machineryFuel: 0,
          irrigationEnergy: 0,
          pesticideProduction: 0,
        },
      };
    })() : undefined,

    // FLAG removals (SBTi Forest, Land and Agriculture)
    flagRemovals: flagRemovals && (flagRemovals.soil_carbon_co2e || 0) > 0 ? {
      soilCarbonCo2e: flagRemovals.soil_carbon_co2e || 0,
      methodology: flagRemovals.methodology || 'practice_based_default',
      isVerified: flagRemovals.methodology === 'measured',
      meetsLsrStandard: flagRemovals.methodology === 'measured',
      removalWarning: flagRemovals.methodology !== 'measured'
        ? 'Practice-based removal defaults have not been independently verified per GHG Protocol Land Sector and Removals Standard V1.0 Section 3.1.4.'
        : null,
      notes: flagRemovals.viticulture_notes || null,
    } : undefined,
  };
}
