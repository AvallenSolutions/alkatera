/**
 * OpenLCA API Utility Functions
 * Transforms internal data structures to OpenLCA-compatible formats
 */

interface DQIScores {
  reliability: number;
  temporal: number;
  geographical: number;
  technological: number;
  completeness: number;
}

interface PedigreeMatrix {
  reliability: number;
  completeness: number;
  temporalCorrelation: number;
  geographicalCorrelation: number;
  technologicalCorrelation: number;
}

interface LCAInput {
  label: string;
  value: number;
  unit: string;
  dqi: DQIScores;
  evidenceUrl?: string;
  stage: string;
  category: string;
}

interface OpenLCAExchange {
  "@type": string;
  amount: number;
  unit: {
    "@type": string;
    name: string;
  };
  flow: {
    "@type": string;
    name: string;
    category: string;
  };
  dqEntry?: string;
  pedigreeMatrix?: PedigreeMatrix;
}

interface OpenLCAProcess {
  "@context": string;
  "@type": string;
  name: string;
  processType: string;
  exchanges: OpenLCAExchange[];
}

/**
 * Maps our internal DQI scores to OpenLCA's PedigreeMatrix format
 *
 * Our DQI structure:
 * - reliability (1-5): How trustworthy is the data source
 * - temporal (1-5): How recent is the data
 * - geographical (1-5): Location match quality
 * - technological (1-5): Technology match quality
 * - completeness (1-5): Data coverage completeness
 *
 * OpenLCA PedigreeMatrix expects the same dimensions but with specific naming
 */
export function mapDqiToOpenLcaFormat(dqi: DQIScores): PedigreeMatrix {
  return {
    reliability: dqi.reliability,
    completeness: dqi.completeness,
    temporalCorrelation: dqi.temporal,
    geographicalCorrelation: dqi.geographical,
    technologicalCorrelation: dqi.technological,
  };
}

/**
 * Constructs a DQ entry string from DQI scores
 * Format: (reliability;completeness;temporal;geographical;technological)
 */
export function buildDqEntryString(dqi: DQIScores): string {
  return `(${dqi.reliability};${dqi.completeness};${dqi.temporal};${dqi.geographical};${dqi.technological})`;
}

/**
 * Transforms our LCA inputs into OpenLCA process format
 */
export function transformToOpenLcaProcess(
  productName: string,
  functionalUnit: string,
  inputs: LCAInput[]
): OpenLCAProcess {
  const exchanges: OpenLCAExchange[] = inputs.map((input) => ({
    "@type": "Exchange",
    amount: input.value,
    unit: {
      "@type": "Unit",
      name: input.unit,
    },
    flow: {
      "@type": "Flow",
      name: input.label,
      category: input.stage,
    },
    dqEntry: buildDqEntryString(input.dqi),
    pedigreeMatrix: mapDqiToOpenLcaFormat(input.dqi),
  }));

  return {
    "@context": "http://greendelta.github.io/olca-schema",
    "@type": "Process",
    name: productName,
    processType: "UNIT_PROCESS",
    exchanges,
  };
}

/**
 * Calculates overall data quality score from DQI
 * Lower is better (1 = highest quality, 5 = lowest quality)
 */
export function calculateDataQualityScore(dqi: DQIScores): number {
  const total = dqi.reliability + dqi.completeness + dqi.temporal +
                dqi.geographical + dqi.technological;
  return total / 5;
}

/**
 * Validates that all required evidence is present for high-quality data
 */
export function validateEvidenceRequirements(inputs: LCAInput[]): {
  valid: boolean;
  missingEvidence: string[];
} {
  const missingEvidence: string[] = [];

  inputs.forEach((input) => {
    const needsEvidence = input.dqi.reliability === 1 || input.dqi.reliability === 2;
    if (needsEvidence && !input.evidenceUrl) {
      missingEvidence.push(input.label);
    }
  });

  return {
    valid: missingEvidence.length === 0,
    missingEvidence,
  };
}

/**
 * Standard impact categories supported by the platform
 */
export const IMPACT_CATEGORIES = [
  { name: "Climate Change", unit: "kg CO₂ eq" },
  { name: "Ozone Depletion", unit: "kg CFC-11 eq" },
  { name: "Human Toxicity", unit: "kg 1,4-DB eq" },
  { name: "Freshwater Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Terrestrial Ecotoxicity", unit: "kg 1,4-DB eq" },
  { name: "Eutrophication", unit: "kg PO₄³⁻ eq" },
  { name: "Acidification", unit: "kg SO₂ eq" },
  { name: "Land Use", unit: "m² a" },
  { name: "Water Depletion", unit: "m³" },
  { name: "Mineral Resource Depletion", unit: "kg Fe eq" },
  { name: "Fossil Resource Depletion", unit: "kg oil eq" },
] as const;
