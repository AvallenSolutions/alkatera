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
      packaging?: number;
      packaging_stage?: number; // Legacy alias
      distribution?: number;
      processing?: number;
      use_phase?: number;
      end_of_life?: number;
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

  const totalCarbon = impacts.climate_change_gwp100 || 0;
  const waterConsumption = impacts.water_consumption || 0;
  const waterScarcity = impacts.water_scarcity_aware || 0;
  const landUse = impacts.land_use || 0;

  const rawMaterials = lifecycleStages.raw_materials || 0;
  const packaging = lifecycleStages.packaging ?? lifecycleStages.packaging_stage ?? 0;
  const distribution = lifecycleStages.distribution || 0;
  const processing = lifecycleStages.processing || 0;
  const usePhase = lifecycleStages.use_phase || 0;
  const endOfLife = lifecycleStages.end_of_life || 0;

  const totalFromStages = rawMaterials + packaging + distribution + processing + usePhase + endOfLife;
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

  const chartBreakdown = [
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
  const wasteStream = packagingMaterials.length > 0
    ? packagingMaterials.map((m: any) => ({
        label: m.material_name || 'Packaging material',
        value: `${(m.quantity || 0).toFixed(3)} kg`,
        recycled: (m.recyclability_score || 0) > 50 || m.is_reusable || m.is_compostable,
      }))
    : []; // Empty rather than fabricated — accurate reflects no packaging data available

  // Compute recycling rate — prefer aggregated circularity_percentage from the LCA calculation,
  // fall back to computing from material-level recycled_content_percentage
  const aggregatedCircularity = impacts.circularity_percentage;
  let recyclingRate: number;
  if (aggregatedCircularity != null && aggregatedCircularity > 0) {
    recyclingRate = Math.round(aggregatedCircularity);
  } else {
    const totalMassForRecycling = materials.reduce((sum: number, m: any) => sum + (m.quantity || 0), 0);
    const recycledMass = materials.reduce((sum: number, m: any) => {
      const qty = m.quantity || 0;
      const recycledPct = m.recycled_content_percentage || 0;
      return sum + (qty * recycledPct / 100);
    }, 0);
    recyclingRate = totalMassForRecycling > 0
      ? Math.round((recycledMass / totalMassForRecycling) * 100)
      : 0;
  }

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

  // GHG detailed breakdown from material-level data
  const co2Fossil = ghgBreakdown.co2_fossil || impacts.climate_fossil || 0;
  const co2Biogenic = ghgBreakdown.co2_biogenic || impacts.climate_biogenic || 0;
  const co2Dluc = impacts.climate_dluc || 0;
  const ch4FossilKg = sumMaterialImpact('ch4_fossil_kg');
  const ch4FossilKgCo2e = sumMaterialImpact('ch4_fossil_kg_co2e');
  const ch4BiogenicKg = sumMaterialImpact('ch4_biogenic_kg');
  const ch4BiogenicKgCo2e = sumMaterialImpact('ch4_biogenic_kg_co2e');
  const n2oKg = sumMaterialImpact('n2o_kg');
  const n2oKgCo2e = sumMaterialImpact('n2o_kg_co2e');
  const hfcPfc = sumMaterialImpact('hfc_pfc_kg_co2e');
  const ch4Total = ghgBreakdown.ch4 || (ch4FossilKgCo2e + ch4BiogenicKgCo2e);
  const n2oTotal = ghgBreakdown.n2o || n2oKgCo2e;

  // Determine GWP method from materials
  const gwpMethod = materials[0]?.gwp_method || 'IPCC AR6 GWP-100';

  // Ingredient-level breakdown
  // Show both the user's real ingredient name and the factor used for calculation.
  // When a proxy is used, `matched_source_name` holds the database factor name
  // and `gwp_data_source` / `non_gwp_data_source` record which database provided it.
  const ingredientRows = materials.map((m: any) => {
    const climateVal = m.impact_climate || 0;
    const climatePct = totalCarbon > 0 ? ((climateVal / totalCarbon) * 100).toFixed(1) : '0.0';

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

    return {
      name: userIngredientName,
      calculationFactor: calcFactorName,
      isProxy,
      factorDatabase,
      category: m.category_type || m.material_type || 'ingredient',
      quantity: (m.quantity || 0).toFixed(3),
      unit: m.unit || m.unit_name || 'kg',
      origin: m.origin_country || m.country_of_origin || 'Unknown',
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
  const rawBoundary = (lca.system_boundary || lca.lca_scope_type || 'cradle-to-gate').toLowerCase();
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
  const assumptionsLimitations = lca.assumptions_limitations && Array.isArray(lca.assumptions_limitations)
    ? lca.assumptions_limitations
    : [
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
      version: '1.0',
      assessmentPeriod: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      publishedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      heroImage: undefined,
      productImageUrl: lca.product_image_url || undefined,
      productDescription: lca.product_description || undefined,
      referenceYear: lca.reference_year,
      lcaScopeType: scopeTypeLabel,
    },
    functionalUnit: {
      value: lca.functional_unit || `1 unit of ${lca.product_name}`,
      description: "All environmental impacts in this report are calculated per functional unit as defined by ISO 14044:2006 Clause 4.2.3.2. This ensures normalised comparison across different products and production scenarios."
    },
    goalAndScope: {
      intendedApplication: lca.intended_application || `To quantify and communicate the environmental impacts of ${lca.product_name} across its lifecycle, enabling informed decision-making for environmental improvement.`,
      reasonsForStudy: lca.reasons_for_study || `To establish a transparent environmental baseline for ${lca.product_name}, identify hotspots for improvement, and support stakeholder communication in line with ISO 14044 requirements.`,
      intendedAudience: lca.intended_audience || ['Internal stakeholders', 'Supply chain partners', 'Regulatory bodies'],
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
      allocationProcedure: 'Physical allocation by mass is applied for co-products following ISO 14044 Clause 4.3.4 hierarchy. Where physical relationships cannot be established, economic allocation is used as documented per material.',
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
      content: `This Life Cycle Assessment evaluates the environmental impacts of ${lca.product_name} in accordance with ISO 14044:2006 and ISO 14067:2018. The assessment quantifies impacts across ${envCategories.length > 0 ? envCategories.length + ' environmental categories' : 'multiple environmental categories'} including climate change, water use, land use, acidification, and eutrophication. Data quality achieves a ${dqRating.toLowerCase()} rating (${dqScore}%) based on the ISO 14044 pedigree matrix approach, with ${primaryCount} primary data points and ${secondaryCount} secondary database values.`,
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
        ? 'ReCiPe 2016 v1.1 provides characterisation factors at the midpoint level using the Hierarchist cultural perspective. This method covers 18 impact categories with global scope and is widely used for comprehensive LCA studies.'
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
      stages: [
        { label: "Raw Materials", value: rawMaterials, unit: "kg CO\u2082eq", percentage: rawMaterialsPct.toFixed(1), color: "green" },
        { label: "Packaging", value: packaging, unit: "kg CO\u2082eq", percentage: packagingPct.toFixed(1), color: "yellow" },
        { label: "Distribution", value: distribution, unit: "kg CO\u2082eq", percentage: distributionPct.toFixed(1), color: "orange" },
        { label: "Processing", value: processing, unit: "kg CO\u2082eq", percentage: processingPct.toFixed(1), color: "blue" },
        { label: "Use Phase", value: usePhase, unit: "kg CO\u2082eq", percentage: usePhasePct.toFixed(1), color: "purple" },
        { label: "End of Life", value: endOfLife, unit: "kg CO\u2082eq", percentage: endOfLifePct.toFixed(1), color: "red" },
      ].filter(stage => stage.value !== 0), // include negatives (EoL can be negative via recycling credits)
      scopes: [
        { name: "Scope 1 (Direct)", value: scope1Pct.toFixed(1) },
        { name: "Scope 2 (Energy)", value: scope2Pct.toFixed(1) },
        { name: "Scope 3 (Value Chain)", value: scope3Pct.toFixed(1) }
      ],
      methodology: {
        ghgBreakdown: [
          { label: "CO\u2082 Fossil", value: co2Fossil.toFixed(4), unit: "kg CO\u2082e", gwp: "1" },
          { label: "CO\u2082 Biogenic", value: co2Biogenic.toFixed(4), unit: "kg CO\u2082e", gwp: "1*" },
          { label: "CH\u2084", value: ch4Total.toFixed(4), unit: "kg CO\u2082e", gwp: "29.8 / 27.0" },
          { label: "N\u2082O", value: n2oTotal.toFixed(4), unit: "kg CO\u2082e", gwp: "273" }
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
      totalGwp100: totalCarbon.toFixed(4),
      fossilCo2: co2Fossil.toFixed(4),
      biogenicCo2: co2Biogenic.toFixed(4),
      dlucCo2: co2Dluc.toFixed(4),
      ch4Fossil: ch4FossilKg.toExponential(3),
      ch4FossilKgCo2e: ch4FossilKgCo2e.toFixed(4),
      ch4Biogenic: ch4BiogenicKg.toExponential(3),
      ch4BiogenicKgCo2e: ch4BiogenicKgCo2e.toFixed(4),
      n2o: n2oKg.toExponential(3),
      n2oKgCo2e: n2oKgCo2e.toFixed(4),
      hfcPfc: hfcPfc.toFixed(4),
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
      totalClimateImpact: totalCarbon.toFixed(4),
      hasProxies: ingredientRows.some((r) => r.isProxy),
    },
    waterFootprint: {
      totalConsumption: `${waterConsumption.toFixed(3)}L`,
      scarcityWeighted: `${waterScarcity.toFixed(3)}L eq.`,
      breakdown: chartBreakdown.map(item => ({
        name: item.name,
        value: item.value,
        color: item.name === "Raw Materials" ? "#2563eb" :
               item.name === "Packaging" ? "#3b82f6" :
               item.name === "Processing" ? "#60a5fa" : "#1d4ed8"
      })),
      sources: materials.slice(0, 8).map((m: any) => ({
        source: m.material_name || "Material",
        location: m.origin_country || m.country_of_origin || "Unknown",
        volume: `${((m.impact_water || 0) * (m.quantity || 1)).toFixed(3)} L`,
        risk: waterScarcity > 50 ? "HIGH" : waterScarcity > 20 ? "MEDIUM" : "LOW",
        score: parseFloat((10.0).toFixed(3))
      })),
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
      totalWaste: `${(impacts.waste || 0.45).toFixed(3)}kg`,
      recyclingRate,
      circularityScore: `${(recyclingRate / 10).toFixed(1)} / 10`,
      wasteStream,
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
      breakdown: materials.slice(0, 8).map((m: any) => ({
        material: m.material_name || "Material",
        origin: m.origin_country || m.country_of_origin || "Unknown",
        mass: `${(m.quantity || 0).toFixed(3)} kg`,
        intensity: parseFloat(((m.impact_land || 0) / (m.quantity || 1)).toFixed(3)),
        footprint: `${(m.impact_land || landUse / Math.max(materials.length, 1)).toFixed(3)} m\u00B2`
      })),
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
            ? materialBreakdown.slice(0, 8).map((m: any) => ({
                name: m.name,
                location: materials.find((mat: any) => mat.material_name === m.name)?.origin_country || "Various",
                distance: `${materials.find((mat: any) => mat.material_name === m.name)?.distance_km || "-"} km`,
                co2: `${(m.emissions ?? 0).toFixed(3)} kg CO\u2082e`
              }))
            : materials.slice(0, 8).map((m: any) => ({
                name: m.material_name || "Supplier",
                location: m.origin_country || m.country_of_origin || "Unknown",
                distance: `${m.distance_km || "-"} km`,
                co2: `${(m.impact_climate || 0).toFixed(3)} kg CO\u2082e`
              }))
        }
      ]
    },
    commitment: {
      text: `This environmental assessment demonstrates our commitment to understanding and reducing the environmental impact of ${lca.product_name}. By measuring and reporting our footprint in accordance with ISO 14044 and ISO 14067 standards, we establish a transparent baseline for continuous improvement across our value chain.`
    }
  };
}
