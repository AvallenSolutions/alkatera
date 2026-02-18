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
    }>;
    totalClimateImpact: string;
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
