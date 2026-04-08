/**
 * Footprint Data Completeness Calculator
 *
 * Shared utility used by FootprintHeroSummary, FootprintProgressBanner,
 * and FootprintSummaryDashboard to ensure consistent completeness scoring.
 */

export interface CategoryStatus {
  key: string;
  label: string;
  shortLabel: string;
  hasData: boolean;
  emissions: number;
  isAutoCalculated: boolean;
  isComingSoon: boolean;
  isNotApplicable: boolean;
  scope: 1 | 2 | 3;
}

export interface Scope3BreakdownInput {
  products?: number;
  business_travel?: number;
  purchased_services?: number;
  employee_commuting?: number;
  capital_goods?: number;
  operational_waste?: number;
  downstream_logistics?: number;
  marketing_materials?: number;
  upstream_transport?: number;
  downstream_transport?: number;
  use_phase?: number;
}

export interface DataCompletenessResult {
  score: number;
  completedCount: number;
  totalCount: number;
  categories: CategoryStatus[];
  firstIncompleteCategory: CategoryStatus | null;
}

export function calculateDataCompleteness(params: {
  operationsEmissions: number;
  fleetEmissions: number;
  scope3Breakdown?: Scope3BreakdownInput;
  notApplicableCategories?: string[];
}): DataCompletenessResult {
  const { operationsEmissions, fleetEmissions, scope3Breakdown, notApplicableCategories = [] } = params;

  const na = new Set(notApplicableCategories);

  const categories: CategoryStatus[] = [
    {
      key: 'operations',
      label: 'Operations & Energy',
      shortLabel: 'Operations',
      hasData: operationsEmissions > 0,
      emissions: operationsEmissions,
      isAutoCalculated: true,
      isComingSoon: false,
      isNotApplicable: na.has('operations'),
      scope: 1,
    },
    {
      key: 'fleet',
      label: 'Company Fleet',
      shortLabel: 'Fleet',
      hasData: fleetEmissions > 0,
      emissions: fleetEmissions,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('fleet'),
      scope: 1,
    },
    {
      key: 'products',
      label: 'Products & Supply Chain',
      shortLabel: 'Products',
      hasData: (scope3Breakdown?.products || 0) > 0,
      emissions: scope3Breakdown?.products || 0,
      isAutoCalculated: true,
      isComingSoon: false,
      isNotApplicable: na.has('products'),
      scope: 3,
    },
    {
      key: 'business_travel',
      label: 'Business Travel',
      shortLabel: 'Travel',
      hasData: (scope3Breakdown?.business_travel || 0) > 0,
      emissions: scope3Breakdown?.business_travel || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('business_travel'),
      scope: 3,
    },
    {
      key: 'employee_commuting',
      label: 'Team Commuting',
      shortLabel: 'Commuting',
      hasData: (scope3Breakdown?.employee_commuting || 0) > 0,
      emissions: scope3Breakdown?.employee_commuting || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('employee_commuting'),
      scope: 3,
    },
    {
      key: 'capital_goods',
      label: 'Capital Goods',
      shortLabel: 'Capital',
      hasData: (scope3Breakdown?.capital_goods || 0) > 0,
      emissions: scope3Breakdown?.capital_goods || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('capital_goods'),
      scope: 3,
    },
    {
      key: 'purchased_services',
      label: 'Services & Overhead',
      shortLabel: 'Services',
      hasData: (scope3Breakdown?.purchased_services || 0) > 0,
      emissions: scope3Breakdown?.purchased_services || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('purchased_services'),
      scope: 3,
    },
    {
      key: 'marketing_materials',
      label: 'Marketing Materials',
      shortLabel: 'Marketing',
      hasData: (scope3Breakdown?.marketing_materials || 0) > 0,
      emissions: scope3Breakdown?.marketing_materials || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('marketing_materials'),
      scope: 3,
    },
    {
      key: 'downstream_logistics',
      label: 'Logistics & Distribution',
      shortLabel: 'Logistics',
      hasData: (scope3Breakdown?.downstream_logistics || 0) > 0,
      emissions: scope3Breakdown?.downstream_logistics || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('downstream_logistics'),
      scope: 3,
    },
    {
      key: 'operational_waste',
      label: 'Operational Waste',
      shortLabel: 'Waste',
      hasData: (scope3Breakdown?.operational_waste || 0) > 0,
      emissions: scope3Breakdown?.operational_waste || 0,
      isAutoCalculated: false,
      isComingSoon: false,
      isNotApplicable: na.has('operational_waste'),
      scope: 3,
    },
    {
      key: 'upstream_transport',
      label: 'Upstream Transport',
      shortLabel: 'Upstream',
      hasData: (scope3Breakdown?.upstream_transport || 0) > 0,
      emissions: scope3Breakdown?.upstream_transport || 0,
      isAutoCalculated: true,
      isComingSoon: false,
      isNotApplicable: na.has('upstream_transport'),
      scope: 3,
    },
    {
      key: 'downstream_transport',
      label: 'Downstream Transport',
      shortLabel: 'Downstream',
      hasData: (scope3Breakdown?.downstream_transport || 0) > 0,
      emissions: scope3Breakdown?.downstream_transport || 0,
      isAutoCalculated: false,
      isComingSoon: true,
      isNotApplicable: na.has('downstream_transport'),
      scope: 3,
    },
    {
      key: 'use_phase',
      label: 'Use of Products',
      shortLabel: 'Use Phase',
      // Use phase is auto-calculated. If products have data, use phase has been
      // assessed too — a result of 0 is valid (e.g. still wine needs no refrigeration).
      hasData: (scope3Breakdown?.use_phase || 0) > 0 || (scope3Breakdown?.products || 0) > 0,
      emissions: scope3Breakdown?.use_phase || 0,
      isAutoCalculated: true,
      isComingSoon: false,
      isNotApplicable: na.has('use_phase'),
      scope: 3,
    },
  ];

  // Only count non-coming-soon, non-N/A categories for completeness
  const trackableCategories = categories.filter(c => !c.isComingSoon && !c.isNotApplicable);
  const completedCount = trackableCategories.filter(c => c.hasData).length;
  const totalCount = trackableCategories.length;
  const score = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const firstIncompleteCategory = trackableCategories.find(c => !c.hasData && !c.isAutoCalculated) || null;

  return {
    score,
    completedCount,
    totalCount,
    categories,
    firstIncompleteCategory,
  };
}
