/**
 * ISO 14044 Data Quality Assessment Module
 *
 * Implements the Pedigree Matrix approach per Weidema & Wesnaes (1996)
 * for systematic data quality evaluation in LCA studies.
 *
 * Key features:
 * - 5-dimensional Pedigree Matrix scoring (1-5 scale)
 * - Uncertainty propagation through calculations
 * - Temporal representativeness validation
 * - Aggregate DQI calculation for PCF reports
 * - ISO 14044 Section 4.2.3.6 compliance
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Pedigree Matrix scores per ISO 14044 / ecoinvent methodology
 * Score 1 = Best quality, Score 5 = Worst quality
 */
export interface PedigreeMatrix {
  reliability: 1 | 2 | 3 | 4 | 5;
  completeness: 1 | 2 | 3 | 4 | 5;
  temporal: 1 | 2 | 3 | 4 | 5;
  geographical: 1 | 2 | 3 | 4 | 5;
  technological: 1 | 2 | 3 | 4 | 5;
}

/**
 * Uncertainty factors for geometric standard deviation calculation
 * Based on Frischknecht et al. (2007) ecoinvent uncertainty methodology
 */
export interface UncertaintyFactors {
  basicUncertainty: number;      // Base uncertainty from measurement type (σ_b)
  pedigreeUncertainty: number;   // Additional uncertainty from pedigree scores (σ_p)
  totalUncertainty: number;      // Combined geometric standard deviation (σ_g)
  confidenceInterval95: {        // 95% confidence bounds
    lower: number;               // Multiplier for lower bound
    upper: number;               // Multiplier for upper bound
  };
}

/**
 * Material-level data quality assessment
 */
export interface MaterialDataQuality {
  materialName: string;
  materialId: string;
  impactValue: number;
  impactUnit: string;
  dataSource: string;
  dataSourceTier: 'primary_verified' | 'secondary_modelled' | 'secondary_estimated';
  qualityGrade: 'HIGH' | 'MEDIUM' | 'LOW';
  pedigreeMatrix: PedigreeMatrix;
  pedigreeDqi: number;           // 0-100 score from pedigree
  uncertaintyPercent: number;    // Uncertainty as % of value
  uncertainty: UncertaintyFactors;
  temporalRepresentativeness: {
    dataYear: number | null;
    referenceYear: number;
    yearsDifference: number | null;
    isStale: boolean;            // >3 years difference
    isVeryStale: boolean;        // >6 years difference
  };
  geographicMatch: {
    dataRegion: string;
    studyRegion: string;
    isExactMatch: boolean;
    isRegionalMatch: boolean;
  };
  flags: string[];               // Quality warnings
}

/**
 * Aggregate PCF data quality assessment
 */
export interface AggregateDataQuality {
  overallDqi: number;                      // Weighted average DQI (0-100)
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  weightedUncertainty: number;             // Propagated uncertainty %
  dataSourceBreakdown: {
    primaryVerified: { count: number; impactShare: number };
    secondaryModelled: { count: number; impactShare: number };
    secondaryEstimated: { count: number; impactShare: number };
  };
  pedigreeAggregate: {
    reliability: number;       // Weighted average (1-5)
    completeness: number;
    temporal: number;
    geographical: number;
    technological: number;
  };
  temporalCoverage: {
    oldestData: number | null;
    newestData: number | null;
    averageAge: number | null;
    staleMaterialCount: number;
    staleImpactShare: number;
  };
  qualityFlags: QualityFlag[];
  isoCompliant: boolean;
  complianceGaps: string[];
}

export interface QualityFlag {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  affectedMaterials?: string[];
}

// ============================================================================
// PEDIGREE MATRIX SCORING CRITERIA
// ============================================================================

/**
 * Reference documentation for Pedigree Matrix scoring criteria
 * Per Weidema & Wesnaes (1996) and ecoinvent Data Quality Guidelines
 */
export const PEDIGREE_CRITERIA: Record<keyof PedigreeMatrix, Record<1 | 2 | 3 | 4 | 5, string>> = {
  reliability: {
    1: 'Verified data based on measurements',
    2: 'Verified data partly based on assumptions, or non-verified data based on measurements',
    3: 'Non-verified data partly based on qualified estimates',
    4: 'Qualified estimate (e.g., by industrial expert)',
    5: 'Non-qualified estimate',
  },
  completeness: {
    1: 'Representative data from all sites relevant for the market, over adequate period',
    2: 'Representative data from >50% of sites, over adequate period',
    3: 'Representative data from <50% of sites, OR >50% but shorter periods',
    4: 'Representative data from only one site, OR some sites but shorter periods',
    5: 'Unknown representativeness or very limited data',
  },
  temporal: {
    1: 'Less than 3 years difference to reference year',
    2: '3-6 years difference to reference year',
    3: '6-10 years difference to reference year',
    4: '10-15 years difference to reference year',
    5: 'Age unknown or more than 15 years difference',
  },
  geographical: {
    1: 'Data from area under study',
    2: 'Average data from larger area in which study area is included',
    3: 'Data from area with similar production conditions',
    4: 'Data from area with slightly similar production conditions',
    5: 'Data from unknown or distinctly different area',
  },
  technological: {
    1: 'Data from enterprises, processes and materials under study',
    2: 'Data from processes and materials under study, but different enterprises',
    3: 'Data from processes and materials under study, but different technology',
    4: 'Data on related processes or materials',
    5: 'Data on related processes at laboratory scale or different technology',
  },
};

/**
 * Basic uncertainty factors by flow type
 * Based on ecoinvent uncertainty methodology
 */
export const BASIC_UNCERTAINTY: Record<string, number> = {
  'combustion_emissions': 0.05,      // σ² = 0.0006 (very well known)
  'process_emissions': 0.10,         // σ² = 0.0006
  'agricultural_emissions': 0.20,    // Higher due to variability
  'transport_emissions': 0.10,
  'electricity_use': 0.05,
  'material_inputs': 0.10,
  'packaging_materials': 0.10,
  'water_use': 0.15,
  'waste_generation': 0.20,
  'land_use': 0.30,                  // High uncertainty
  'default': 0.15,
};

/**
 * Additional uncertainty from pedigree scores
 * σ² values per Frischknecht et al. (2007)
 */
export const PEDIGREE_UNCERTAINTY: Record<keyof PedigreeMatrix, Record<1 | 2 | 3 | 4 | 5, number>> = {
  reliability: { 1: 0.00, 2: 0.0006, 3: 0.002, 4: 0.008, 5: 0.04 },
  completeness: { 1: 0.00, 2: 0.0001, 3: 0.0006, 4: 0.002, 5: 0.008 },
  temporal: { 1: 0.00, 2: 0.0002, 3: 0.002, 4: 0.008, 5: 0.04 },
  geographical: { 1: 0.00, 2: 0.000025, 3: 0.0001, 4: 0.0006, 5: 0.002 },
  technological: { 1: 0.00, 2: 0.0006, 3: 0.008, 4: 0.04, 5: 0.12 },
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate DQI score (0-100) from Pedigree Matrix scores
 * Perfect score (all 1s) = 100%, Worst score (all 5s) = 0%
 */
export function calculatePedigreeDqi(pedigree: PedigreeMatrix): number {
  const sum = pedigree.reliability + pedigree.completeness +
              pedigree.temporal + pedigree.geographical +
              pedigree.technological;
  // Sum ranges from 5 (best) to 25 (worst)
  // Convert to 0-100 scale where 100 is best
  return Math.round(100 - ((sum - 5) / 20) * 100);
}

/**
 * Calculate uncertainty factors from pedigree scores
 * Returns geometric standard deviation and 95% confidence interval
 */
export function calculateUncertainty(
  pedigree: PedigreeMatrix,
  flowType: string = 'default',
  explicitUncertaintyPercent?: number
): UncertaintyFactors {
  // If explicit uncertainty is provided, use it
  if (explicitUncertaintyPercent !== undefined && explicitUncertaintyPercent > 0) {
    const sigma = explicitUncertaintyPercent / 100;
    return {
      basicUncertainty: sigma,
      pedigreeUncertainty: 0,
      totalUncertainty: sigma,
      confidenceInterval95: {
        lower: Math.exp(-1.96 * sigma),
        upper: Math.exp(1.96 * sigma),
      },
    };
  }

  // Calculate from pedigree matrix
  const basicVariance = Math.pow(BASIC_UNCERTAINTY[flowType] || BASIC_UNCERTAINTY.default, 2);

  const pedigreeVariance =
    PEDIGREE_UNCERTAINTY.reliability[pedigree.reliability] +
    PEDIGREE_UNCERTAINTY.completeness[pedigree.completeness] +
    PEDIGREE_UNCERTAINTY.temporal[pedigree.temporal] +
    PEDIGREE_UNCERTAINTY.geographical[pedigree.geographical] +
    PEDIGREE_UNCERTAINTY.technological[pedigree.technological];

  const totalVariance = basicVariance + pedigreeVariance;
  const totalSigma = Math.sqrt(totalVariance);

  return {
    basicUncertainty: Math.sqrt(basicVariance),
    pedigreeUncertainty: Math.sqrt(pedigreeVariance),
    totalUncertainty: totalSigma,
    confidenceInterval95: {
      lower: Math.exp(-1.96 * totalSigma),
      upper: Math.exp(1.96 * totalSigma),
    },
  };
}

/**
 * Map data quality grade to default Pedigree Matrix scores
 */
export function gradeToDefaultPedigree(grade: 'HIGH' | 'MEDIUM' | 'LOW'): PedigreeMatrix {
  switch (grade) {
    case 'HIGH':
      return { reliability: 2, completeness: 2, temporal: 2, geographical: 2, technological: 2 };
    case 'MEDIUM':
      return { reliability: 3, completeness: 3, temporal: 3, geographical: 3, technological: 3 };
    case 'LOW':
      return { reliability: 4, completeness: 4, temporal: 4, geographical: 4, technological: 4 };
  }
}

/**
 * Calculate temporal score based on data age
 */
export function calculateTemporalScore(
  dataYear: number | null,
  referenceYear: number
): { score: 1 | 2 | 3 | 4 | 5; isStale: boolean; isVeryStale: boolean } {
  if (!dataYear) {
    return { score: 5, isStale: true, isVeryStale: true };
  }

  const diff = Math.abs(referenceYear - dataYear);

  if (diff < 3) return { score: 1, isStale: false, isVeryStale: false };
  if (diff < 6) return { score: 2, isStale: false, isVeryStale: false };
  if (diff < 10) return { score: 3, isStale: true, isVeryStale: false };
  if (diff < 15) return { score: 4, isStale: true, isVeryStale: true };
  return { score: 5, isStale: true, isVeryStale: true };
}

/**
 * Calculate geographical score based on region matching
 */
export function calculateGeographicalScore(
  dataRegion: string,
  studyRegion: string
): { score: 1 | 2 | 3 | 4 | 5; isExactMatch: boolean; isRegionalMatch: boolean } {
  const dataRegionUpper = dataRegion.toUpperCase();
  const studyRegionUpper = studyRegion.toUpperCase();

  // Exact match
  if (dataRegionUpper === studyRegionUpper) {
    return { score: 1, isExactMatch: true, isRegionalMatch: true };
  }

  // Regional groupings
  const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
  const northAmerica = ['US', 'CA', 'MX'];
  const seAsia = ['TH', 'VN', 'ID', 'MY', 'PH', 'SG'];

  // Check if both are in same region
  const isInSameRegion = (countries: string[]) =>
    countries.includes(dataRegionUpper) && countries.includes(studyRegionUpper);

  // EU average for EU country, or vice versa
  if ((dataRegionUpper === 'EU' && euCountries.includes(studyRegionUpper)) ||
      (studyRegionUpper === 'EU' && euCountries.includes(dataRegionUpper)) ||
      isInSameRegion(euCountries)) {
    return { score: 2, isExactMatch: false, isRegionalMatch: true };
  }

  // Global average
  if (dataRegionUpper === 'GLO' || studyRegionUpper === 'GLO') {
    return { score: 3, isExactMatch: false, isRegionalMatch: false };
  }

  // Same continent/region
  if (isInSameRegion(northAmerica) || isInSameRegion(seAsia)) {
    return { score: 3, isExactMatch: false, isRegionalMatch: true };
  }

  // Different regions
  return { score: 4, isExactMatch: false, isRegionalMatch: false };
}

// ============================================================================
// MATERIAL-LEVEL ASSESSMENT
// ============================================================================

export interface MaterialAssessmentInput {
  materialName: string;
  materialId: string;
  impactValue: number;
  impactUnit: string;
  dataSource: string;
  dataSourceTier: 'primary_verified' | 'secondary_modelled' | 'secondary_estimated';
  qualityGrade: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertaintyPercent?: number;
  pedigree?: Partial<PedigreeMatrix>;
  dataYear?: number | null;
  dataRegion?: string;
  studyRegion?: string;
  referenceYear?: number;
}

/**
 * Assess data quality for a single material
 */
export function assessMaterialDataQuality(input: MaterialAssessmentInput): MaterialDataQuality {
  const referenceYear = input.referenceYear || new Date().getFullYear();
  const dataRegion = input.dataRegion || 'GLO';
  const studyRegion = input.studyRegion || 'GLO';

  // Calculate temporal score
  const temporal = calculateTemporalScore(input.dataYear ?? null, referenceYear);

  // Calculate geographical score
  const geographical = calculateGeographicalScore(dataRegion, studyRegion);

  // Build pedigree matrix
  const defaultPedigree = gradeToDefaultPedigree(input.qualityGrade);
  const pedigree: PedigreeMatrix = {
    reliability: input.pedigree?.reliability ?? defaultPedigree.reliability,
    completeness: input.pedigree?.completeness ?? defaultPedigree.completeness,
    temporal: input.pedigree?.temporal ?? temporal.score,
    geographical: input.pedigree?.geographical ?? geographical.score,
    technological: input.pedigree?.technological ?? defaultPedigree.technological,
  };

  // Calculate DQI and uncertainty
  const pedigreeDqi = calculatePedigreeDqi(pedigree);
  const uncertainty = calculateUncertainty(
    pedigree,
    'material_inputs',
    input.uncertaintyPercent
  );

  // Generate quality flags
  const flags: string[] = [];

  if (temporal.isVeryStale) {
    flags.push('DATA_VERY_STALE: Data is >6 years old');
  } else if (temporal.isStale) {
    flags.push('DATA_STALE: Data is >3 years old');
  }

  if (geographical.score >= 4) {
    flags.push('GEO_MISMATCH: Data from different geographic region');
  }

  if (input.qualityGrade === 'LOW') {
    flags.push('LOW_QUALITY: Factor has low data quality grade');
  }

  if (uncertainty.totalUncertainty > 0.5) {
    flags.push('HIGH_UNCERTAINTY: Uncertainty exceeds 50%');
  }

  return {
    materialName: input.materialName,
    materialId: input.materialId,
    impactValue: input.impactValue,
    impactUnit: input.impactUnit,
    dataSource: input.dataSource,
    dataSourceTier: input.dataSourceTier,
    qualityGrade: input.qualityGrade,
    pedigreeMatrix: pedigree,
    pedigreeDqi,
    uncertaintyPercent: input.uncertaintyPercent ?? Math.round(uncertainty.totalUncertainty * 100),
    uncertainty,
    temporalRepresentativeness: {
      dataYear: input.dataYear ?? null,
      referenceYear,
      yearsDifference: input.dataYear ? Math.abs(referenceYear - input.dataYear) : null,
      isStale: temporal.isStale,
      isVeryStale: temporal.isVeryStale,
    },
    geographicMatch: {
      dataRegion,
      studyRegion,
      isExactMatch: geographical.isExactMatch,
      isRegionalMatch: geographical.isRegionalMatch,
    },
    flags,
  };
}

// ============================================================================
// AGGREGATE ASSESSMENT
// ============================================================================

/**
 * Propagate uncertainties through aggregation
 * Uses root-sum-of-squares for independent uncertainties
 */
export function propagateUncertainty(
  materials: MaterialDataQuality[],
  totalImpact: number
): number {
  if (totalImpact === 0) return 0;

  // Calculate weighted variance
  let sumVariance = 0;
  for (const m of materials) {
    const weight = m.impactValue / totalImpact;
    const variance = Math.pow(m.uncertainty.totalUncertainty, 2);
    sumVariance += Math.pow(weight, 2) * variance;
  }

  // Return as percentage
  return Math.round(Math.sqrt(sumVariance) * 100);
}

/**
 * Aggregate data quality assessment for entire PCF
 */
export function assessAggregateDataQuality(
  materials: MaterialDataQuality[],
  referenceYear: number = new Date().getFullYear()
): AggregateDataQuality {
  if (materials.length === 0) {
    return {
      overallDqi: 0,
      overallConfidence: 'LOW',
      weightedUncertainty: 100,
      dataSourceBreakdown: {
        primaryVerified: { count: 0, impactShare: 0 },
        secondaryModelled: { count: 0, impactShare: 0 },
        secondaryEstimated: { count: 0, impactShare: 0 },
      },
      pedigreeAggregate: { reliability: 5, completeness: 5, temporal: 5, geographical: 5, technological: 5 },
      temporalCoverage: { oldestData: null, newestData: null, averageAge: null, staleMaterialCount: 0, staleImpactShare: 0 },
      qualityFlags: [{ severity: 'critical', code: 'NO_DATA', message: 'No materials to assess' }],
      isoCompliant: false,
      complianceGaps: ['No materials added'],
    };
  }

  const totalImpact = materials.reduce((sum, m) => sum + Math.abs(m.impactValue), 0);

  // Calculate weighted DQI
  let weightedDqi = 0;
  for (const m of materials) {
    const weight = Math.abs(m.impactValue) / totalImpact;
    weightedDqi += m.pedigreeDqi * weight;
  }
  const overallDqi = Math.round(weightedDqi);

  // Calculate data source breakdown
  const breakdown = {
    primaryVerified: { count: 0, impactShare: 0 },
    secondaryModelled: { count: 0, impactShare: 0 },
    secondaryEstimated: { count: 0, impactShare: 0 },
  };

  for (const m of materials) {
    const share = Math.abs(m.impactValue) / totalImpact;
    if (m.dataSourceTier === 'primary_verified') {
      breakdown.primaryVerified.count++;
      breakdown.primaryVerified.impactShare += share;
    } else if (m.dataSourceTier === 'secondary_modelled') {
      breakdown.secondaryModelled.count++;
      breakdown.secondaryModelled.impactShare += share;
    } else {
      breakdown.secondaryEstimated.count++;
      breakdown.secondaryEstimated.impactShare += share;
    }
  }

  // Round shares
  breakdown.primaryVerified.impactShare = Math.round(breakdown.primaryVerified.impactShare * 100);
  breakdown.secondaryModelled.impactShare = Math.round(breakdown.secondaryModelled.impactShare * 100);
  breakdown.secondaryEstimated.impactShare = Math.round(breakdown.secondaryEstimated.impactShare * 100);

  // Calculate weighted pedigree aggregate
  const pedigreeAggregate = { reliability: 0, completeness: 0, temporal: 0, geographical: 0, technological: 0 };
  for (const m of materials) {
    const weight = Math.abs(m.impactValue) / totalImpact;
    pedigreeAggregate.reliability += m.pedigreeMatrix.reliability * weight;
    pedigreeAggregate.completeness += m.pedigreeMatrix.completeness * weight;
    pedigreeAggregate.temporal += m.pedigreeMatrix.temporal * weight;
    pedigreeAggregate.geographical += m.pedigreeMatrix.geographical * weight;
    pedigreeAggregate.technological += m.pedigreeMatrix.technological * weight;
  }

  // Round to 1 decimal
  pedigreeAggregate.reliability = Math.round(pedigreeAggregate.reliability * 10) / 10;
  pedigreeAggregate.completeness = Math.round(pedigreeAggregate.completeness * 10) / 10;
  pedigreeAggregate.temporal = Math.round(pedigreeAggregate.temporal * 10) / 10;
  pedigreeAggregate.geographical = Math.round(pedigreeAggregate.geographical * 10) / 10;
  pedigreeAggregate.technological = Math.round(pedigreeAggregate.technological * 10) / 10;

  // Calculate temporal coverage
  const dataYears = materials
    .map(m => m.temporalRepresentativeness.dataYear)
    .filter((y): y is number => y !== null);

  const staleMaterials = materials.filter(m => m.temporalRepresentativeness.isStale);
  const staleImpact = staleMaterials.reduce((sum, m) => sum + Math.abs(m.impactValue), 0);

  const temporalCoverage = {
    oldestData: dataYears.length > 0 ? Math.min(...dataYears) : null,
    newestData: dataYears.length > 0 ? Math.max(...dataYears) : null,
    averageAge: dataYears.length > 0
      ? Math.round(dataYears.reduce((sum, y) => sum + (referenceYear - y), 0) / dataYears.length)
      : null,
    staleMaterialCount: staleMaterials.length,
    staleImpactShare: Math.round((staleImpact / totalImpact) * 100),
  };

  // Propagate uncertainty
  const weightedUncertainty = propagateUncertainty(materials, totalImpact);

  // Generate quality flags
  const qualityFlags: QualityFlag[] = [];
  const complianceGaps: string[] = [];

  // Check for stale data
  if (temporalCoverage.staleImpactShare > 20) {
    qualityFlags.push({
      severity: 'warning',
      code: 'STALE_DATA',
      message: `${temporalCoverage.staleImpactShare}% of impact uses data >3 years old`,
      affectedMaterials: staleMaterials.map(m => m.materialName),
    });
    complianceGaps.push('ISO 14044 4.2.3.6: Temporal representativeness - significant data is outdated');
  }

  // Check for low-quality data
  const lowQualityMaterials = materials.filter(m => m.qualityGrade === 'LOW');
  const lowQualityImpact = lowQualityMaterials.reduce((sum, m) => sum + Math.abs(m.impactValue), 0);
  const lowQualityShare = Math.round((lowQualityImpact / totalImpact) * 100);

  if (lowQualityShare > 30) {
    qualityFlags.push({
      severity: 'warning',
      code: 'LOW_QUALITY_DATA',
      message: `${lowQualityShare}% of impact uses LOW quality data`,
      affectedMaterials: lowQualityMaterials.map(m => m.materialName),
    });
    complianceGaps.push('ISO 14044 4.2.3.6: Data quality - significant reliance on low-quality estimates');
  }

  // Check for geographic mismatches
  const geoMismatchMaterials = materials.filter(m => m.pedigreeMatrix.geographical >= 4);
  if (geoMismatchMaterials.length > 0) {
    qualityFlags.push({
      severity: 'info',
      code: 'GEO_MISMATCH',
      message: `${geoMismatchMaterials.length} material(s) use data from different geographic regions`,
      affectedMaterials: geoMismatchMaterials.map(m => m.materialName),
    });
  }

  // Check for high uncertainty
  if (weightedUncertainty > 40) {
    qualityFlags.push({
      severity: 'warning',
      code: 'HIGH_UNCERTAINTY',
      message: `Overall uncertainty is ${weightedUncertainty}% (recommend <40%)`,
    });
    complianceGaps.push('ISO 14044 4.5.3.3: Uncertainty analysis - overall uncertainty exceeds recommended threshold');
  }

  // Check for missing primary data
  if (breakdown.primaryVerified.impactShare < 20) {
    qualityFlags.push({
      severity: 'info',
      code: 'LOW_PRIMARY_DATA',
      message: `Only ${breakdown.primaryVerified.impactShare}% of impact uses verified primary data`,
    });
  }

  // Determine overall confidence
  let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  if (overallDqi >= 80 && weightedUncertainty <= 30 && breakdown.primaryVerified.impactShare >= 50) {
    overallConfidence = 'HIGH';
  } else if (overallDqi >= 60 && weightedUncertainty <= 50) {
    overallConfidence = 'MEDIUM';
  } else {
    overallConfidence = 'LOW';
  }

  // Check ISO compliance
  const isoCompliant = complianceGaps.length === 0 && overallDqi >= 60;

  return {
    overallDqi,
    overallConfidence,
    weightedUncertainty,
    dataSourceBreakdown: breakdown,
    pedigreeAggregate,
    temporalCoverage,
    qualityFlags,
    isoCompliant,
    complianceGaps,
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate ISO 14044 Section 4.2.3.6 compliant data quality statement
 */
export function generateDataQualityStatement(
  aggregate: AggregateDataQuality,
  referenceYear: number
): string {
  const lines: string[] = [];

  lines.push('## Data Quality Assessment (ISO 14044 Section 4.2.3.6)');
  lines.push('');
  lines.push(`**Overall Data Quality Index:** ${aggregate.overallDqi}% (${aggregate.overallConfidence} confidence)`);
  lines.push(`**Propagated Uncertainty:** ±${aggregate.weightedUncertainty}% (95% CI)`);
  lines.push('');
  lines.push('### Data Source Distribution');
  lines.push(`- Primary verified data: ${aggregate.dataSourceBreakdown.primaryVerified.count} materials (${aggregate.dataSourceBreakdown.primaryVerified.impactShare}% of impact)`);
  lines.push(`- Secondary modelled data: ${aggregate.dataSourceBreakdown.secondaryModelled.count} materials (${aggregate.dataSourceBreakdown.secondaryModelled.impactShare}% of impact)`);
  lines.push(`- Estimated/proxy data: ${aggregate.dataSourceBreakdown.secondaryEstimated.count} materials (${aggregate.dataSourceBreakdown.secondaryEstimated.impactShare}% of impact)`);
  lines.push('');
  lines.push('### Pedigree Matrix Summary (Weighted Average)');
  lines.push(`| Dimension | Score (1-5) | Interpretation |`);
  lines.push(`|-----------|-------------|----------------|`);
  lines.push(`| Reliability | ${aggregate.pedigreeAggregate.reliability.toFixed(1)} | ${getScoreInterpretation('reliability', aggregate.pedigreeAggregate.reliability)} |`);
  lines.push(`| Completeness | ${aggregate.pedigreeAggregate.completeness.toFixed(1)} | ${getScoreInterpretation('completeness', aggregate.pedigreeAggregate.completeness)} |`);
  lines.push(`| Temporal | ${aggregate.pedigreeAggregate.temporal.toFixed(1)} | ${getScoreInterpretation('temporal', aggregate.pedigreeAggregate.temporal)} |`);
  lines.push(`| Geographical | ${aggregate.pedigreeAggregate.geographical.toFixed(1)} | ${getScoreInterpretation('geographical', aggregate.pedigreeAggregate.geographical)} |`);
  lines.push(`| Technological | ${aggregate.pedigreeAggregate.technological.toFixed(1)} | ${getScoreInterpretation('technological', aggregate.pedigreeAggregate.technological)} |`);
  lines.push('');
  lines.push('### Temporal Coverage');
  if (aggregate.temporalCoverage.oldestData && aggregate.temporalCoverage.newestData) {
    lines.push(`- Data collection period: ${aggregate.temporalCoverage.oldestData}–${aggregate.temporalCoverage.newestData}`);
    lines.push(`- Average data age: ${aggregate.temporalCoverage.averageAge} years (reference year: ${referenceYear})`);
  }
  if (aggregate.temporalCoverage.staleMaterialCount > 0) {
    lines.push(`- **Warning:** ${aggregate.temporalCoverage.staleMaterialCount} materials use data >3 years old (${aggregate.temporalCoverage.staleImpactShare}% of impact)`);
  }

  if (aggregate.qualityFlags.length > 0) {
    lines.push('');
    lines.push('### Quality Flags');
    for (const flag of aggregate.qualityFlags) {
      const icon = flag.severity === 'critical' ? '🔴' : flag.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`- ${icon} **${flag.code}:** ${flag.message}`);
    }
  }

  if (!aggregate.isoCompliant && aggregate.complianceGaps.length > 0) {
    lines.push('');
    lines.push('### ISO 14044 Compliance Gaps');
    for (const gap of aggregate.complianceGaps) {
      lines.push(`- ⚠️ ${gap}`);
    }
  }

  return lines.join('\n');
}

function getScoreInterpretation(dimension: keyof PedigreeMatrix, score: number): string {
  const roundedScore = Math.round(score) as 1 | 2 | 3 | 4 | 5;
  const criteria = PEDIGREE_CRITERIA[dimension][roundedScore];
  // Truncate for table display
  return criteria.length > 60 ? criteria.substring(0, 57) + '...' : criteria;
}
