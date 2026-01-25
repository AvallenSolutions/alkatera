// Rosa Industry Benchmarking Module
// Feature 2: Industry Comparisons and Context

import { createClient } from '@supabase/supabase-js';
import type {
  RosaIndustryBenchmarks,
  RosaBenchmarkMetric,
  RosaBenchmarkComparison,
} from '@/lib/types/gaia';

// Re-export types for consumers
export type { RosaIndustryBenchmarks, RosaBenchmarkMetric, RosaBenchmarkComparison };

type SupabaseClient = ReturnType<typeof createClient>;

// Industry benchmark data for drinks industry
// Based on industry averages and research data
const DRINKS_INDUSTRY_BENCHMARKS = {
  brewery: {
    carbonIntensityPerHL: { average: 35, topQuartile: 20, bottomQuartile: 55, unit: 'kgCO2e/HL' },
    waterIntensityPerHL: { average: 4.5, topQuartile: 3.0, bottomQuartile: 7.0, unit: 'L/L' },
    renewableEnergyShare: { average: 35, topQuartile: 75, bottomQuartile: 10, unit: '%' },
    wasteRecyclingRate: { average: 85, topQuartile: 95, bottomQuartile: 70, unit: '%' },
    scope1PerRevenue: { average: 15, topQuartile: 8, bottomQuartile: 25, unit: 'tCO2e/£M' },
    scope2PerRevenue: { average: 25, topQuartile: 12, bottomQuartile: 45, unit: 'tCO2e/£M' },
    scope3PerRevenue: { average: 120, topQuartile: 80, bottomQuartile: 180, unit: 'tCO2e/£M' },
    lcaCoverageRate: { average: 40, topQuartile: 80, bottomQuartile: 15, unit: '%' },
    supplierEngagementRate: { average: 25, topQuartile: 60, bottomQuartile: 5, unit: '%' },
  },
  distillery: {
    carbonIntensityPerHL: { average: 85, topQuartile: 55, bottomQuartile: 130, unit: 'kgCO2e/HL' },
    waterIntensityPerHL: { average: 12, topQuartile: 7, bottomQuartile: 20, unit: 'L/L' },
    renewableEnergyShare: { average: 25, topQuartile: 60, bottomQuartile: 5, unit: '%' },
    wasteRecyclingRate: { average: 75, topQuartile: 92, bottomQuartile: 55, unit: '%' },
    scope1PerRevenue: { average: 30, topQuartile: 15, bottomQuartile: 50, unit: 'tCO2e/£M' },
    scope2PerRevenue: { average: 20, topQuartile: 10, bottomQuartile: 35, unit: 'tCO2e/£M' },
    scope3PerRevenue: { average: 150, topQuartile: 100, bottomQuartile: 220, unit: 'tCO2e/£M' },
    lcaCoverageRate: { average: 35, topQuartile: 70, bottomQuartile: 10, unit: '%' },
    supplierEngagementRate: { average: 20, topQuartile: 50, bottomQuartile: 5, unit: '%' },
  },
  winery: {
    carbonIntensityPerHL: { average: 45, topQuartile: 25, bottomQuartile: 75, unit: 'kgCO2e/HL' },
    waterIntensityPerHL: { average: 6, topQuartile: 3.5, bottomQuartile: 10, unit: 'L/L' },
    renewableEnergyShare: { average: 45, topQuartile: 85, bottomQuartile: 15, unit: '%' },
    wasteRecyclingRate: { average: 80, topQuartile: 95, bottomQuartile: 60, unit: '%' },
    scope1PerRevenue: { average: 12, topQuartile: 6, bottomQuartile: 22, unit: 'tCO2e/£M' },
    scope2PerRevenue: { average: 18, topQuartile: 8, bottomQuartile: 32, unit: 'tCO2e/£M' },
    scope3PerRevenue: { average: 100, topQuartile: 65, bottomQuartile: 150, unit: 'tCO2e/£M' },
    lcaCoverageRate: { average: 30, topQuartile: 65, bottomQuartile: 10, unit: '%' },
    supplierEngagementRate: { average: 30, topQuartile: 65, bottomQuartile: 10, unit: '%' },
  },
  rtd: { // Ready-to-drink
    carbonIntensityPerHL: { average: 55, topQuartile: 35, bottomQuartile: 85, unit: 'kgCO2e/HL' },
    waterIntensityPerHL: { average: 3.5, topQuartile: 2.2, bottomQuartile: 5.5, unit: 'L/L' },
    renewableEnergyShare: { average: 30, topQuartile: 65, bottomQuartile: 8, unit: '%' },
    wasteRecyclingRate: { average: 82, topQuartile: 94, bottomQuartile: 65, unit: '%' },
    scope1PerRevenue: { average: 18, topQuartile: 10, bottomQuartile: 30, unit: 'tCO2e/£M' },
    scope2PerRevenue: { average: 22, topQuartile: 11, bottomQuartile: 38, unit: 'tCO2e/£M' },
    scope3PerRevenue: { average: 135, topQuartile: 90, bottomQuartile: 195, unit: 'tCO2e/£M' },
    lcaCoverageRate: { average: 45, topQuartile: 85, bottomQuartile: 20, unit: '%' },
    supplierEngagementRate: { average: 35, topQuartile: 70, bottomQuartile: 10, unit: '%' },
  },
  // Default for general drinks industry
  drinks: {
    carbonIntensityPerHL: { average: 50, topQuartile: 30, bottomQuartile: 80, unit: 'kgCO2e/HL' },
    waterIntensityPerHL: { average: 5, topQuartile: 3, bottomQuartile: 8, unit: 'L/L' },
    renewableEnergyShare: { average: 35, topQuartile: 70, bottomQuartile: 10, unit: '%' },
    wasteRecyclingRate: { average: 80, topQuartile: 93, bottomQuartile: 60, unit: '%' },
    scope1PerRevenue: { average: 20, topQuartile: 10, bottomQuartile: 35, unit: 'tCO2e/£M' },
    scope2PerRevenue: { average: 22, topQuartile: 10, bottomQuartile: 40, unit: 'tCO2e/£M' },
    scope3PerRevenue: { average: 130, topQuartile: 85, bottomQuartile: 190, unit: 'tCO2e/£M' },
    lcaCoverageRate: { average: 40, topQuartile: 75, bottomQuartile: 15, unit: '%' },
    supplierEngagementRate: { average: 28, topQuartile: 60, bottomQuartile: 8, unit: '%' },
  },
};

type IndustryType = keyof typeof DRINKS_INDUSTRY_BENCHMARKS;

/**
 * Get industry benchmarks for an organization
 */
export async function getIndustryBenchmarks(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RosaIndustryBenchmarks> {
  // Fetch organization data for comparison
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, industry, company_type')
    .eq('id', organizationId)
    .single();

  const org = orgData as { name: string; industry: string | null; company_type: string[] | null } | null;

  // Determine industry type
  const industryType = determineIndustryType(org?.company_type, org?.industry);
  const benchmarks = DRINKS_INDUSTRY_BENCHMARKS[industryType];

  // Fetch organization metrics for comparison
  const metrics = await fetchOrganizationMetrics(supabase, organizationId);

  // Build benchmark comparisons
  const benchmarkMetrics: RosaIndustryBenchmarks['metrics'] = {};
  const insights: string[] = [];
  const quickWins: string[] = [];

  // Carbon intensity comparison
  if (metrics.carbonIntensityPerHL !== null) {
    benchmarkMetrics.carbonIntensity = createBenchmarkMetric(
      'Carbon Intensity',
      'carbonIntensityPerHL',
      metrics.carbonIntensityPerHL,
      benchmarks.carbonIntensityPerHL,
      true // Lower is better
    );

    if (benchmarkMetrics.carbonIntensity.comparison === 'top_quartile') {
      insights.push(`Your carbon intensity of ${metrics.carbonIntensityPerHL.toFixed(1)} ${benchmarks.carbonIntensityPerHL.unit} is industry-leading`);
    } else if (benchmarkMetrics.carbonIntensity.comparison === 'bottom_quartile') {
      insights.push(`Your carbon intensity is ${Math.abs(benchmarkMetrics.carbonIntensity.percentileDifference).toFixed(0)}% higher than the industry average`);
      quickWins.push('Focus on energy efficiency to reduce carbon intensity');
    }
  }

  // Water intensity comparison
  if (metrics.waterIntensityPerHL !== null) {
    benchmarkMetrics.waterIntensity = createBenchmarkMetric(
      'Water Intensity',
      'waterIntensityPerHL',
      metrics.waterIntensityPerHL,
      benchmarks.waterIntensityPerHL,
      true
    );

    if (benchmarkMetrics.waterIntensity.comparison === 'bottom_quartile') {
      quickWins.push('Water recycling and efficiency improvements could significantly reduce water use');
    }
  }

  // Renewable energy share
  if (metrics.renewableEnergyShare !== null) {
    benchmarkMetrics.renewableEnergyShare = createBenchmarkMetric(
      'Renewable Energy Share',
      'renewableEnergyShare',
      metrics.renewableEnergyShare,
      benchmarks.renewableEnergyShare,
      false // Higher is better
    );

    if (benchmarkMetrics.renewableEnergyShare.comparison === 'bottom_quartile') {
      quickWins.push('Switching to renewable energy could quickly improve your sustainability metrics');
    } else if (benchmarkMetrics.renewableEnergyShare.comparison === 'top_quartile') {
      insights.push(`Your ${metrics.renewableEnergyShare.toFixed(0)}% renewable energy usage is well above industry average`);
    }
  }

  // LCA coverage
  if (metrics.lcaCoverageRate !== null) {
    benchmarkMetrics.lcaCoverageRate = createBenchmarkMetric(
      'LCA Coverage',
      'lcaCoverageRate',
      metrics.lcaCoverageRate,
      benchmarks.lcaCoverageRate,
      false
    );

    if (benchmarkMetrics.lcaCoverageRate.comparison === 'bottom_quartile') {
      quickWins.push('Completing LCAs for your top products will improve reporting accuracy');
    }
  }

  // Supplier engagement
  if (metrics.supplierEngagementRate !== null) {
    benchmarkMetrics.supplierEngagementRate = createBenchmarkMetric(
      'Supplier Engagement Rate',
      'supplierEngagementRate',
      metrics.supplierEngagementRate,
      benchmarks.supplierEngagementRate,
      false
    );

    if (benchmarkMetrics.supplierEngagementRate.comparison === 'top_quartile') {
      insights.push('Your supplier engagement rate is industry-leading');
    }
  }

  // Generate overall insights
  const metricsAboveAverage = Object.values(benchmarkMetrics).filter(
    m => m && (m.comparison === 'top_quartile' || m.comparison === 'above_average')
  ).length;
  const metricsBelowAverage = Object.values(benchmarkMetrics).filter(
    m => m && (m.comparison === 'bottom_quartile' || m.comparison === 'below_average')
  ).length;

  if (metricsAboveAverage > metricsBelowAverage) {
    insights.unshift(`You're performing above industry average in ${metricsAboveAverage} key metrics`);
  } else if (metricsBelowAverage > metricsAboveAverage) {
    insights.unshift(`There are ${metricsBelowAverage} areas where you could improve to match industry peers`);
  }

  return {
    industry: industryType,
    companySize: undefined, // Could be enhanced with size-based benchmarks
    region: undefined, // Could be enhanced with regional benchmarks
    benchmarkDate: new Date().toISOString(),
    metrics: benchmarkMetrics,
    insights,
    quickWins: quickWins.slice(0, 3),
  };
}

/**
 * Determine industry type from company data
 */
function determineIndustryType(companyTypes?: string[] | null, industry?: string | null): IndustryType {
  if (companyTypes && companyTypes.length > 0) {
    const types = companyTypes.map(t => t.toLowerCase());
    if (types.some(t => t.includes('brewery') || t.includes('beer') || t.includes('cider'))) {
      return 'brewery';
    }
    if (types.some(t => t.includes('distillery') || t.includes('spirits') || t.includes('whisky') || t.includes('gin'))) {
      return 'distillery';
    }
    if (types.some(t => t.includes('winery') || t.includes('wine'))) {
      return 'winery';
    }
    if (types.some(t => t.includes('rtd') || t.includes('ready to drink'))) {
      return 'rtd';
    }
  }

  if (industry) {
    const ind = industry.toLowerCase();
    if (ind.includes('brew')) return 'brewery';
    if (ind.includes('distill') || ind.includes('spirit')) return 'distillery';
    if (ind.includes('wine')) return 'winery';
    if (ind.includes('rtd')) return 'rtd';
  }

  return 'drinks';
}

/**
 * Fetch organization metrics for benchmarking
 */
async function fetchOrganizationMetrics(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  carbonIntensityPerHL: number | null;
  waterIntensityPerHL: number | null;
  renewableEnergyShare: number | null;
  wasteRecyclingRate: number | null;
  lcaCoverageRate: number | null;
  supplierEngagementRate: number | null;
}> {
  // Fetch various data points
  const [productsData, suppliersData, facilitiesData, waterData, activityData] = await Promise.all([
    supabase.from('products').select('id, has_lca').eq('organization_id', organizationId),
    supabase.from('suppliers').select('id, engagement_status').eq('organization_id', organizationId),
    supabase.from('facilities').select('id').eq('organization_id', organizationId),
    supabase.from('facility_water_data').select('consumption_m3, facility_id').eq('organization_id', organizationId),
    supabase.from('facility_activity_entries').select('activity_type, quantity, unit, emissions_kg_co2e').eq('organization_id', organizationId),
  ]);

  const products = productsData.data as Array<{ id: string; has_lca: boolean }> | null;
  const suppliers = suppliersData.data as Array<{ id: string; engagement_status: string }> | null;
  const activities = activityData.data as Array<{
    activity_type: string;
    quantity: number;
    unit: string;
    emissions_kg_co2e: number;
  }> | null;
  const water = waterData.data as Array<{ consumption_m3: number; facility_id: string }> | null;

  // Calculate LCA coverage
  const lcaCoverageRate = products && products.length > 0
    ? (products.filter(p => p.has_lca).length / products.length) * 100
    : null;

  // Calculate supplier engagement rate
  const supplierEngagementRate = suppliers && suppliers.length > 0
    ? (suppliers.filter(s => s.engagement_status === 'engaged' || s.engagement_status === 'responding').length / suppliers.length) * 100
    : null;

  // Calculate water intensity (simplified - would need production volume data for accurate calculation)
  const totalWater = water?.reduce((sum, w) => sum + (w.consumption_m3 || 0), 0) || 0;
  // Assuming a proxy for production volume based on facilities count
  const waterIntensityPerHL = totalWater > 0 ? totalWater / 1000 : null; // Simplified proxy

  // Calculate renewable energy share
  let renewableEnergy = 0;
  let totalEnergy = 0;
  if (activities) {
    for (const activity of activities) {
      if (activity.activity_type?.toLowerCase().includes('electricity')) {
        totalEnergy += activity.quantity || 0;
        if (activity.activity_type.toLowerCase().includes('renewable') ||
            activity.activity_type.toLowerCase().includes('green')) {
          renewableEnergy += activity.quantity || 0;
        }
      }
    }
  }
  const renewableEnergyShare = totalEnergy > 0 ? (renewableEnergy / totalEnergy) * 100 : null;

  // Calculate carbon intensity (simplified)
  const totalEmissions = activities?.reduce((sum, a) => sum + (a.emissions_kg_co2e || 0), 0) || 0;
  const carbonIntensityPerHL = totalEmissions > 0 ? totalEmissions / 100 : null; // Simplified proxy

  return {
    carbonIntensityPerHL,
    waterIntensityPerHL,
    renewableEnergyShare,
    wasteRecyclingRate: null, // Would need waste data
    lcaCoverageRate,
    supplierEngagementRate,
  };
}

/**
 * Create a benchmark metric comparison
 */
function createBenchmarkMetric(
  name: string,
  key: string,
  userValue: number,
  benchmark: { average: number; topQuartile: number; bottomQuartile: number; unit: string },
  lowerIsBetter: boolean
): RosaBenchmarkMetric {
  const { average, topQuartile, bottomQuartile, unit } = benchmark;

  let comparison: RosaBenchmarkComparison;
  let percentileDifference: number;

  if (lowerIsBetter) {
    // For metrics where lower is better (emissions, water use, etc.)
    if (userValue <= topQuartile) {
      comparison = 'top_quartile';
    } else if (userValue <= average) {
      comparison = 'above_average';
    } else if (userValue <= bottomQuartile) {
      comparison = 'below_average';
    } else {
      comparison = 'bottom_quartile';
    }
    percentileDifference = ((average - userValue) / average) * 100;
  } else {
    // For metrics where higher is better (renewable %, coverage %, etc.)
    if (userValue >= topQuartile) {
      comparison = 'top_quartile';
    } else if (userValue >= average) {
      comparison = 'above_average';
    } else if (userValue >= bottomQuartile) {
      comparison = 'below_average';
    } else {
      comparison = 'bottom_quartile';
    }
    percentileDifference = ((userValue - average) / average) * 100;
  }

  return {
    metricName: name,
    metricKey: key,
    userValue,
    benchmarkValue: average,
    unit,
    comparison,
    percentileDifference: Math.round(percentileDifference * 10) / 10,
    industryAverage: average,
    topQuartile,
    bottomQuartile,
  };
}

/**
 * Format benchmarks for Rosa's context
 */
export function formatBenchmarksForPrompt(benchmarks: RosaIndustryBenchmarks): string {
  const lines: string[] = [];

  lines.push('### Industry Benchmarking');
  lines.push(`Comparing against: ${benchmarks.industry} industry`);
  lines.push('');

  const metrics = benchmarks.metrics;
  const metricEntries = Object.entries(metrics).filter(([, v]) => v !== undefined);

  if (metricEntries.length > 0) {
    lines.push('**Your Performance vs Industry:**');
    for (const [, metric] of metricEntries) {
      if (!metric) continue;
      const icon = getComparisonIcon(metric.comparison);
      const diff = metric.percentileDifference >= 0 ? `+${metric.percentileDifference}%` : `${metric.percentileDifference}%`;
      lines.push(`- ${icon} ${metric.metricName}: ${metric.userValue.toFixed(1)} ${metric.unit} (${diff} vs avg)`);
      lines.push(`  - Industry average: ${metric.industryAverage} | Top quartile: ${metric.topQuartile} | Bottom quartile: ${metric.bottomQuartile}`);
    }
    lines.push('');
  }

  if (benchmarks.insights.length > 0) {
    lines.push('**Key Insights:**');
    for (const insight of benchmarks.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  if (benchmarks.quickWins.length > 0) {
    lines.push('**Quick Win Opportunities:**');
    for (const quickWin of benchmarks.quickWins) {
      lines.push(`- ${quickWin}`);
    }
  }

  return lines.join('\n');
}

function getComparisonIcon(comparison: RosaBenchmarkComparison): string {
  switch (comparison) {
    case 'top_quartile': return '🏆';
    case 'above_average': return '✅';
    case 'average': return '➡️';
    case 'below_average': return '⚠️';
    case 'bottom_quartile': return '🔴';
    default: return '•';
  }
}
