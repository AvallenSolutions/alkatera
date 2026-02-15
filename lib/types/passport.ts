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
  referenceYear: number | null;
  systemBoundary: string | null;
  totalCarbon: number;
  carbonUnit: string;
}

export interface LCADataProductIdentity {
  productImage: string | null;
  productCategory: string | null;
  volumeDisplay: string | null;
  productDescription: string | null;
  organizationName: string;
  organizationLogo: string | null;
  certifications: Array<{ name: string }>;
  awards: Array<{ name: string }>;
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

export interface OriginItem {
  name: string;
  originCountry: string;
  originCountryCode: string | null;
  isOrganic: boolean;
  type: 'ingredient' | 'packaging';
  packagingCategory?: string;
}

export interface LCADataOrigins {
  ingredients: OriginItem[];
  packaging: OriginItem[];
  totalIngredients: number;
  totalCountries: number;
}

export interface PackagingComponentItem {
  name: string;
  packagingCategory: string;
  recycledContentPercentage: number | null;
  recyclabilityScore: number | null;
  endOfLifePathway: string | null;
  isReusable: boolean;
  isCompostable: boolean;
}

export interface LCADataPackaging {
  components: PackagingComponentItem[];
  averageRecycledContent: number | null;
  circularityScore: number | null;
  circularEndOfLifePercentage: number | null;
}

export interface LCADataConclusion {
  title: string;
  content: string;
}

export interface LCAData {
  meta: LCADataMeta;
  productIdentity: LCADataProductIdentity;
  executiveSummary: LCADataExecutiveSummary;
  methodology: LCADataMethodology;
  origins: LCADataOrigins | null;
  packaging: LCADataPackaging | null;
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
  showCertifications: boolean;
  showOrigins: boolean;
  showPackagingSummary: boolean;
  showPackagingDetail: boolean;
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
    showCertifications: false,
    showOrigins: false,
    showPackagingSummary: true,
    showPackagingDetail: false,
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
    showCertifications: true,
    showOrigins: true,
    showPackagingSummary: true,
    showPackagingDetail: true,
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
    showCertifications: true,
    showOrigins: true,
    showPackagingSummary: true,
    showPackagingDetail: true,
  },
};
