export interface LCAReportData {
  meta: {
    productName: string;
    refId: string;
    date: string;
    organization: string;
    generatedBy: string;
    version: string;
    assessmentPeriod: string;
    publishedDate: string;
    heroImage?: string;
    productImageUrl?: string;
    productDescription?: string;
    referenceYear?: number;
    lcaScopeType?: string;
  };
  functionalUnit: {
    value: string;
    description: string;
  };
  goalAndScope: {
    intendedApplication: string;
    reasonsForStudy: string;
    intendedAudience: string[];
    isComparativeAssertion: boolean;
    systemBoundary: string;
    systemBoundaryDescription: string;
    cutOffCriteria: string;
    allocationProcedure: string;
    assumptionsAndLimitations: Array<{ type: string; text: string }>;
    referenceStandards: string[];
  };
  executiveSummary: {
    content: string;
    keyHighlight: {
      value: string;
      label: string;
      subtext: string;
    };
    dataQualityScore: number;
  };
  methodology: {
    includedStages: string[];
    excludedStages: string[];
    dataSources: Array<{ name: string; count: number; version?: string; description?: string }>;
    lciaMethod: string;
    lciaMethodDescription: string;
    characterizationModels: Array<{ category: string; model: string; reference: string }>;
    softwareAndDatabases: Array<{ name: string; version: string; purpose: string }>;
  };
  dataQuality: {
    overallScore: number;
    overallRating: string;
    pedigreeMatrix: {
      reliability: number;
      completeness: number;
      temporalRepresentativeness: number;
      geographicRepresentativeness: number;
      technologicalRepresentativeness: number;
    };
    coverageSummary: {
      primaryDataShare: number;
      secondaryDataShare: number;
      proxyDataShare: number;
      primaryCount: number;
      secondaryCount: number;
      proxyCount: number;
      totalMaterials: number;
    };
    materialQuality: Array<{
      name: string;
      source: string;
      grade: string;
      confidence: number;
      temporalCoverage: string;
      geographicCoverage: string;
    }>;
    missingDataTreatment: string;
    uncertaintyNote: string;
  };
  climateImpact: {
    totalCarbon: string;
    breakdown: Array<{ name: string; value: number; color: string }>;
    stages: Array<{ label: string; value: number; unit: string; percentage: string; color: string }>;
    scopes: Array<{ name: string; value: string }>;
    methodology: {
      ghgBreakdown: Array<{ label: string; value: string; unit: string; gwp: string }>;
      standards: string[];
    };
  };
  ghgDetailed: {
    totalGwp100: string;
    fossilCo2: string;
    biogenicCo2: string;
    dlucCo2: string;
    ch4Fossil: string;
    ch4FossilKgCo2e: string;
    ch4Biogenic: string;
    ch4BiogenicKgCo2e: string;
    n2o: string;
    n2oKgCo2e: string;
    hfcPfc: string;
    gwpMethod: string;
    gwpFactors: Array<{ gas: string; gwp100: string; source: string }>;
    biogenicNote: string;
  };
  environmentalImpacts: {
    categories: Array<{
      name: string;
      indicator: string;
      unit: string;
      totalValue: string;
      topContributors: Array<{ name: string; value: string; percentage: string }>;
      description: string;
    }>;
    referenceMethod: string;
    normalisationNote: string;
  };
  ingredientBreakdown: {
    ingredients: Array<{
      name: string;
      /** The factor name actually used for calculation — may differ from `name` when a proxy was used */
      calculationFactor: string;
      /** Whether a proxy factor was used (calculationFactor !== name) */
      isProxy: boolean;
      /** Human-readable data source (e.g. "ecoinvent 3.12", "AGRIBALYSE 3.2", "Supplier verified") */
      factorDatabase: string;
      category: string;
      quantity: string;
      unit: string;
      origin: string;
      climateImpact: string;
      climatePercentage: string;
      waterImpact: string;
      landUseImpact: string;
      acidification: string;
      eutrophication: string;
      dataSource: string;
      dataQualityGrade: string;
      /** Confidence score 0–100 */
      confidenceScore: number;
    }>;
    totalClimateImpact: string;
    /** True if any ingredients use proxy factors */
    hasProxies: boolean;
  };
  waterFootprint: {
    totalConsumption: string;
    scarcityWeighted: string;
    breakdown: Array<{ name: string; value: number; color: string }>;
    sources: Array<{ source: string; location: string; volume: string; risk: string; score: number }>;
    methodology: {
      steps: Array<{ step: number; title: string; description: string }>;
      standards: string[];
    };
  };
  circularity: {
    totalWaste: string;
    recyclingRate: number;
    circularityScore: string;
    wasteStream: Array<{ label: string; value: string; recycled: boolean }>;
    methodology: {
      formula: {
        text: string;
        definitions: Array<{ term: string; definition: string }>;
      };
      standards: string[];
    };
  };
  landUse: {
    totalLandUse: string;
    breakdown: Array<{
      material: string;
      origin: string;
      mass: string;
      intensity: number;
      footprint: string;
    }>;
    methodology: {
      categories: Array<{ title: string; value: string; description: string }>;
      standards: string[];
    };
  };
  supplyChain: {
    totalDistance: string;
    verifiedSuppliers: string;
    network: Array<{
      category: string;
      items: Array<{
        name: string;
        location: string;
        distance: string;
        co2: string;
      }>;
    }>;
  };
  commitment: {
    text: string;
  };

  // ── ISO Compliance Additions ──────────────────────────────────────────

  /** ISO 14044 §4.5 Interpretation chapter */
  interpretation?: {
    significant_issues: {
      hotspots: Array<{ name: string; impact_kg_co2e: number; contribution_pct: number; category: string }>;
      dominant_lifecycle_stage: string;
      dominant_stage_pct: number;
      dominant_scope: string;
      dominant_scope_pct: number;
      summary: string;
    };
    evaluation: {
      completeness: { is_complete: boolean; coverage_pct: number; missing_stages: string[]; notes: string[] };
      sensitivity: { has_analysis: boolean; highly_sensitive_count: number; max_sensitivity_ratio: number; conclusion: string };
      consistency: { is_consistent: boolean; issues: string[]; notes: string[] };
    };
    conclusions: {
      key_findings: string[];
      limitations: string[];
      recommendations: string[];
      improvement_opportunities: string[];
    };
  };

  /** ISO 14044 §4.5.3 Uncertainty and sensitivity analysis */
  uncertaintySensitivity?: {
    propagatedUncertaintyPct: number;
    confidenceInterval95: { lower: string; upper: string };
    sensitivityAnalysis: {
      method: string;
      parameters: Array<{
        materialName: string;
        baselineContributionPct: number;
        variationPct: number;
        resultRange: { lower: string; upper: string };
        sensitivityRatio: number;
        isHighlySensitive: boolean;
      }>;
      conclusion: string;
    };
  };

  /** ISO 14044 §6 Critical review disclosure */
  criticalReview?: {
    status: string;
    disclosure: string;
    recommendation: string;
  };

  /** LULUC justification note */
  lulucNote?: string;

  /** Zero-impact categories with justification */
  zeroImpactCategories?: Array<{ category: string; reason: string }>;

  /** Scope 1/2/3 methodology note */
  scopeMethodology?: {
    standard: string;
    attributionMethod: string;
    note: string;
  };

  /** Transport emissions accounting note */
  transportNote?: {
    method: string;
    totalTransportKgCo2e: number;
    isEmbeddedInMaterials: boolean;
    outboundIncluded: boolean;
  };

  /** Circularity methodology disclaimer */
  circularityMethodology?: {
    isProprietaryMetric: boolean;
    methodName: string;
    description: string;
    reference: string;
  };
}

export interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  theme?: 'light' | 'dark';
  pageNumber?: number;
}

export interface SectionHeaderProps {
  number: string;
  title: string;
  theme?: 'light' | 'dark';
  className?: string;
}
