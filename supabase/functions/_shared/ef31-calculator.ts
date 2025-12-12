export interface EF31NormalisationFactors {
  CC: number;
  OD: number;
  IR: number;
  POF: number;
  PM: number;
  HTC: number;
  HTNC: number;
  AC: number;
  EUF: number;
  EUM: number;
  EUT: number;
  ETF: number;
  LU: number;
  WU: number;
  RUF: number;
  RUM: number;
}

export interface EF31WeightingFactors {
  CC: number;
  OD: number;
  IR: number;
  POF: number;
  PM: number;
  HTC: number;
  HTNC: number;
  AC: number;
  EUF: number;
  EUM: number;
  EUT: number;
  ETF: number;
  LU: number;
  WU: number;
  RUF: number;
  RUM: number;
}

export interface EF31ImpactValues {
  climate_change_total: number;
  climate_change_fossil: number;
  climate_change_biogenic: number;
  climate_change_luluc: number;
  ozone_depletion: number;
  ionising_radiation: number;
  photochemical_ozone_formation: number;
  particulate_matter: number;
  human_toxicity_cancer: number;
  human_toxicity_non_cancer: number;
  acidification: number;
  eutrophication_freshwater: number;
  eutrophication_marine: number;
  eutrophication_terrestrial: number;
  ecotoxicity_freshwater: number;
  land_use: number;
  water_use: number;
  resource_use_fossils: number;
  resource_use_minerals_metals: number;
}

export interface EF31AggregatedImpacts {
  raw_impacts: EF31ImpactValues;
  normalised_impacts: Record<string, number>;
  weighted_impacts: Record<string, number>;
  single_score: number;
  methodology_version: string;
  calculated_at: string;
}

export const EU27_2010_NORMALISATION_FACTORS: EF31NormalisationFactors = {
  CC: 8090,
  OD: 0.0536,
  IR: 4220,
  POF: 40.6,
  PM: 0.000594,
  HTC: 0.0000169,
  HTNC: 0.000233,
  AC: 55.5,
  EUF: 1.61,
  EUM: 19.5,
  EUT: 177,
  ETF: 17500,
  LU: 819000,
  WU: 11500,
  RUF: 65000,
  RUM: 0.0636,
};

export const DEFAULT_WEIGHTING_FACTORS: EF31WeightingFactors = {
  CC: 0.2106,
  OD: 0.0631,
  IR: 0.0501,
  POF: 0.0478,
  PM: 0.0896,
  HTC: 0.0213,
  HTNC: 0.0184,
  AC: 0.0620,
  EUF: 0.0280,
  EUM: 0.0296,
  EUT: 0.0371,
  ETF: 0.0192,
  LU: 0.0794,
  WU: 0.0851,
  RUF: 0.0832,
  RUM: 0.0755,
};

export const IMPACT_CATEGORY_UNITS: Record<string, string> = {
  CC: 'kg CO2 eq',
  OD: 'kg CFC-11 eq',
  IR: 'kBq U235 eq',
  POF: 'kg NMVOC eq',
  PM: 'disease incidence',
  HTC: 'CTUh',
  HTNC: 'CTUh',
  AC: 'mol H+ eq',
  EUF: 'kg P eq',
  EUM: 'kg N eq',
  EUT: 'mol N eq',
  ETF: 'CTUe',
  LU: 'pt',
  WU: 'm3 world eq',
  RUF: 'MJ',
  RUM: 'kg Sb eq',
};

export function normaliseImpact(
  categoryCode: keyof EF31NormalisationFactors,
  impactValue: number
): number {
  const normFactor = EU27_2010_NORMALISATION_FACTORS[categoryCode];
  if (!normFactor || normFactor === 0) return 0;
  return impactValue / normFactor;
}

export function weightImpact(
  categoryCode: keyof EF31WeightingFactors,
  normalisedValue: number,
  customWeights?: Partial<EF31WeightingFactors>
): number {
  const weights = customWeights || DEFAULT_WEIGHTING_FACTORS;
  const weight = weights[categoryCode] || DEFAULT_WEIGHTING_FACTORS[categoryCode];
  return normalisedValue * weight;
}

export function calculateEF31SingleScore(
  impacts: EF31ImpactValues,
  customWeights?: Partial<EF31WeightingFactors>
): {
  normalised: Record<string, number>;
  weighted: Record<string, number>;
  singleScore: number;
} {
  const categoryMapping: Record<string, keyof EF31ImpactValues> = {
    CC: 'climate_change_total',
    OD: 'ozone_depletion',
    IR: 'ionising_radiation',
    POF: 'photochemical_ozone_formation',
    PM: 'particulate_matter',
    HTC: 'human_toxicity_cancer',
    HTNC: 'human_toxicity_non_cancer',
    AC: 'acidification',
    EUF: 'eutrophication_freshwater',
    EUM: 'eutrophication_marine',
    EUT: 'eutrophication_terrestrial',
    ETF: 'ecotoxicity_freshwater',
    LU: 'land_use',
    WU: 'water_use',
    RUF: 'resource_use_fossils',
    RUM: 'resource_use_minerals_metals',
  };

  const normalised: Record<string, number> = {};
  const weighted: Record<string, number> = {};
  let singleScore = 0;

  for (const [code, impactKey] of Object.entries(categoryMapping)) {
    const rawValue = impacts[impactKey] || 0;
    const normValue = normaliseImpact(code as keyof EF31NormalisationFactors, rawValue);
    const weightedValue = weightImpact(code as keyof EF31WeightingFactors, normValue, customWeights);

    normalised[code] = normValue;
    weighted[code] = weightedValue;
    singleScore += weightedValue;
  }

  return { normalised, weighted, singleScore };
}

export function aggregateMaterialEF31Impacts(materials: any[]): EF31ImpactValues {
  const totals: EF31ImpactValues = {
    climate_change_total: 0,
    climate_change_fossil: 0,
    climate_change_biogenic: 0,
    climate_change_luluc: 0,
    ozone_depletion: 0,
    ionising_radiation: 0,
    photochemical_ozone_formation: 0,
    particulate_matter: 0,
    human_toxicity_cancer: 0,
    human_toxicity_non_cancer: 0,
    acidification: 0,
    eutrophication_freshwater: 0,
    eutrophication_marine: 0,
    eutrophication_terrestrial: 0,
    ecotoxicity_freshwater: 0,
    land_use: 0,
    water_use: 0,
    resource_use_fossils: 0,
    resource_use_minerals_metals: 0,
  };

  for (const material of materials) {
    totals.climate_change_total += Number(material.ef_climate_change_total) || 0;
    totals.climate_change_fossil += Number(material.ef_climate_change_fossil) || 0;
    totals.climate_change_biogenic += Number(material.ef_climate_change_biogenic) || 0;
    totals.climate_change_luluc += Number(material.ef_climate_change_luluc) || 0;
    totals.ozone_depletion += Number(material.ef_ozone_depletion) || 0;
    totals.ionising_radiation += Number(material.ef_ionising_radiation) || 0;
    totals.photochemical_ozone_formation += Number(material.ef_photochemical_ozone_formation) || 0;
    totals.particulate_matter += Number(material.ef_particulate_matter) || 0;
    totals.human_toxicity_cancer += Number(material.ef_human_toxicity_cancer) || 0;
    totals.human_toxicity_non_cancer += Number(material.ef_human_toxicity_non_cancer) || 0;
    totals.acidification += Number(material.ef_acidification) || 0;
    totals.eutrophication_freshwater += Number(material.ef_eutrophication_freshwater) || 0;
    totals.eutrophication_marine += Number(material.ef_eutrophication_marine) || 0;
    totals.eutrophication_terrestrial += Number(material.ef_eutrophication_terrestrial) || 0;
    totals.ecotoxicity_freshwater += Number(material.ef_ecotoxicity_freshwater) || 0;
    totals.land_use += Number(material.ef_land_use) || 0;
    totals.water_use += Number(material.ef_water_use) || 0;
    totals.resource_use_fossils += Number(material.ef_resource_use_fossils) || 0;
    totals.resource_use_minerals_metals += Number(material.ef_resource_use_minerals_metals) || 0;
  }

  return totals;
}

export function buildEF31AggregatedImpacts(
  materials: any[],
  customWeights?: Partial<EF31WeightingFactors>
): EF31AggregatedImpacts {
  const rawImpacts = aggregateMaterialEF31Impacts(materials);
  const { normalised, weighted, singleScore } = calculateEF31SingleScore(rawImpacts, customWeights);

  return {
    raw_impacts: rawImpacts,
    normalised_impacts: normalised,
    weighted_impacts: weighted,
    single_score: singleScore,
    methodology_version: '3.1',
    calculated_at: new Date().toISOString(),
  };
}

export function convertRecipeToEF31Estimate(recipeImpacts: any): Partial<EF31ImpactValues> {
  return {
    climate_change_total: Number(recipeImpacts.climate_change_gwp100) || 0,
    climate_change_fossil: (Number(recipeImpacts.climate_change_gwp100) || 0) * 0.85,
    climate_change_biogenic: (Number(recipeImpacts.climate_change_gwp100) || 0) * 0.10,
    climate_change_luluc: (Number(recipeImpacts.climate_change_gwp100) || 0) * 0.05,
    ozone_depletion: Number(recipeImpacts.ozone_depletion) || 0,
    ionising_radiation: Number(recipeImpacts.ionising_radiation) || 0,
    photochemical_ozone_formation: Number(recipeImpacts.photochemical_ozone_formation) || 0,
    particulate_matter: Number(recipeImpacts.particulate_matter) || 0,
    human_toxicity_cancer: Number(recipeImpacts.human_toxicity_carcinogenic) || 0,
    human_toxicity_non_cancer: Number(recipeImpacts.human_toxicity_non_carcinogenic) || 0,
    acidification: Number(recipeImpacts.terrestrial_acidification) || 0,
    eutrophication_freshwater: Number(recipeImpacts.freshwater_eutrophication) || 0,
    eutrophication_marine: Number(recipeImpacts.marine_eutrophication) || 0,
    eutrophication_terrestrial: 0,
    ecotoxicity_freshwater: Number(recipeImpacts.freshwater_ecotoxicity) || 0,
    land_use: Number(recipeImpacts.land_use) || 0,
    water_use: Number(recipeImpacts.water_consumption) || 0,
    resource_use_fossils: Number(recipeImpacts.fossil_resource_scarcity) || 0,
    resource_use_minerals_metals: Number(recipeImpacts.mineral_resource_scarcity) || 0,
  };
}
