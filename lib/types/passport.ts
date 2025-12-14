export type SubscriptionTier = 'seed' | 'blossom' | 'canopy';

export type LifecycleStageIcon = 'material' | 'production' | 'distribution' | 'usage' | 'endOfLife';

export interface LCADataMeta {
  title: string;
  productName: string;
  version: string;
  date: string;
  author: string;
  heroImage: string | null;
  organizationName: string;
  organizationLogo: string | null;
  functionalUnit: string;
  methodologyPageUrl: string | null;
}

export interface LCADataExecutiveSummary {
  heading: string;
  content: string;
  keyHighlight: string;
}

export interface LCADataMethodologyStage {
  name: string;
  icon: LifecycleStageIcon;
  description: string;
}

export interface LCADataMethodology {
  functionalUnit: {
    title: string;
    description: string;
    value: string;
  };
  systemBoundaries: {
    title: string;
    stages: LCADataMethodologyStage[];
  };
  dataSources: string[];
  standards: string[];
}

export interface LCADataBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface WaterBreakdownItem {
  name: string;
  value: number;
  unit: string;
  color: string;
  description?: string;
}

export interface WasteBreakdownItem {
  name: string;
  value: number;
  unit: string;
  color: string;
  recyclable: boolean;
  description?: string;
}

export interface LCADataWaterFootprint {
  total: number;
  unit: string;
  breakdown: WaterBreakdownItem[];
  scarcityWeighted: number | null;
}

export interface LCADataWasteFootprint {
  total: number;
  unit: string;
  breakdown: WasteBreakdownItem[];
  recyclingRate: number | null;
  circularityScore: number | null;
}

export interface LCADataResults {
  totalCarbon: number;
  unit: string;
  breakdown: LCADataBreakdownItem[];
  comparison: {
    benchmarkName: string;
    benchmarkValue: number;
    reductionPercentage: number;
  } | null;
  waterFootprint: LCADataWaterFootprint | null;
  wasteFootprint: LCADataWasteFootprint | null;
  landUse: number | null;
}

export interface LCADataConclusion {
  title: string;
  content: string;
}

export interface LCAData {
  meta: LCADataMeta;
  executiveSummary: LCADataExecutiveSummary;
  methodology: LCADataMethodology;
  results: LCADataResults;
  conclusion: LCADataConclusion;
}

export interface TierVisibility {
  showExecutiveSummary: boolean;
  showKeyHighlight: boolean;
  showMethodology: boolean;
  showFullBreakdown: boolean;
  showWaterMetrics: boolean;
  showWaterBreakdown: boolean;
  showWasteMetrics: boolean;
  showWasteBreakdown: boolean;
  showLandUseMetrics: boolean;
  showBenchmarkComparison: boolean;
  showDownloadPDF: boolean;
  showDataSources: boolean;
  showMethodologyLink: boolean;
}

export const TIER_VISIBILITY: Record<SubscriptionTier, TierVisibility> = {
  seed: {
    showExecutiveSummary: true,
    showKeyHighlight: false,
    showMethodology: false,
    showFullBreakdown: false,
    showWaterMetrics: false,
    showWaterBreakdown: false,
    showWasteMetrics: false,
    showWasteBreakdown: false,
    showLandUseMetrics: false,
    showBenchmarkComparison: false,
    showDownloadPDF: false,
    showDataSources: false,
    showMethodologyLink: false,
  },
  blossom: {
    showExecutiveSummary: true,
    showKeyHighlight: true,
    showMethodology: true,
    showFullBreakdown: true,
    showWaterMetrics: true,
    showWaterBreakdown: true,
    showWasteMetrics: true,
    showWasteBreakdown: true,
    showLandUseMetrics: false,
    showBenchmarkComparison: false,
    showDownloadPDF: false,
    showDataSources: true,
    showMethodologyLink: true,
  },
  canopy: {
    showExecutiveSummary: true,
    showKeyHighlight: true,
    showMethodology: true,
    showFullBreakdown: true,
    showWaterMetrics: true,
    showWaterBreakdown: true,
    showWasteMetrics: true,
    showWasteBreakdown: true,
    showLandUseMetrics: true,
    showBenchmarkComparison: true,
    showDownloadPDF: true,
    showDataSources: true,
    showMethodologyLink: true,
  },
};
