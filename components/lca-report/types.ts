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
  };
  functionalUnit: {
    value: string;
    description: string;
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
    dataSources: Array<{ name: string; count: number }>;
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
