// Rosa Temporal Trend Analysis Module
// Feature 3: Time-Series Analysis for Sustainability Metrics

import { createClient } from '@supabase/supabase-js';
import type {
  RosaTrendReport,
  RosaTrendAnalysis,
  RosaTrendDataPoint,
  RosaTrendDirection,
} from '@/lib/types/gaia';

type SupabaseClient = ReturnType<typeof createClient>;

interface RawTimeSeriesData {
  date: string;
  value: number;
  category?: string;
}

/**
 * Generate a comprehensive trend report for an organization
 */
export async function generateTrendReport(
  supabase: SupabaseClient,
  organizationId: string,
  periodType: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  lookbackMonths: number = 12
): Promise<RosaTrendReport> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setMonth(periodStart.getMonth() - lookbackMonths);

  // Fetch time-series data for all metrics
  const [emissionsData, waterData, energyData, vitalityData] = await Promise.all([
    fetchEmissionsTrend(supabase, organizationId, periodStart, periodEnd),
    fetchWaterTrend(supabase, organizationId, periodStart, periodEnd),
    fetchEnergyTrend(supabase, organizationId, periodStart, periodEnd),
    fetchVitalityTrend(supabase, organizationId, periodStart, periodEnd),
  ]);

  const trends: RosaTrendReport['trends'] = {};

  // Analyze emissions trends
  if (emissionsData.scope1.length > 0) {
    trends.scope1Emissions = analyzeTrend(
      'Scope 1 Emissions',
      'scope1Emissions',
      'tCO2e',
      aggregateByPeriod(emissionsData.scope1, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  if (emissionsData.scope2.length > 0) {
    trends.scope2Emissions = analyzeTrend(
      'Scope 2 Emissions',
      'scope2Emissions',
      'tCO2e',
      aggregateByPeriod(emissionsData.scope2, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  if (emissionsData.scope3.length > 0) {
    trends.scope3Emissions = analyzeTrend(
      'Scope 3 Emissions',
      'scope3Emissions',
      'tCO2e',
      aggregateByPeriod(emissionsData.scope3, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  // Total emissions trend
  const totalEmissions = combineTimeSeriesData([
    emissionsData.scope1,
    emissionsData.scope2,
    emissionsData.scope3,
  ]);
  if (totalEmissions.length > 0) {
    trends.totalEmissions = analyzeTrend(
      'Total Emissions',
      'totalEmissions',
      'tCO2e',
      aggregateByPeriod(totalEmissions, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  // Water trend
  if (waterData.length > 0) {
    trends.waterConsumption = analyzeTrend(
      'Water Consumption',
      'waterConsumption',
      'm³',
      aggregateByPeriod(waterData, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  // Energy trend
  if (energyData.length > 0) {
    trends.energyConsumption = analyzeTrend(
      'Energy Consumption',
      'energyConsumption',
      'kWh',
      aggregateByPeriod(energyData, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  // Vitality score trend
  if (vitalityData.length > 0) {
    trends.vitalityScore = analyzeTrend(
      'Vitality Score',
      'vitalityScore',
      'points',
      aggregateByPeriod(vitalityData, periodType),
      periodType,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
  }

  // Calculate year-over-year summary if we have enough data
  const yearOverYearSummary = calculateYearOverYear(trends);

  // Generate key findings
  const keyFindings = generateKeyFindings(trends);

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    reportingPeriod: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    trends,
    yearOverYearSummary,
    keyFindings,
  };
}

/**
 * Fetch emissions time-series data
 */
async function fetchEmissionsTrend(
  supabase: SupabaseClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ scope1: RawTimeSeriesData[]; scope2: RawTimeSeriesData[]; scope3: RawTimeSeriesData[] }> {
  // Fetch facility activity entries
  const { data: facilityData } = await supabase
    .from('facility_activity_entries')
    .select('activity_date, emissions_kg_co2e, scope')
    .eq('organization_id', organizationId)
    .gte('activity_date', periodStart.toISOString())
    .lte('activity_date', periodEnd.toISOString())
    .order('activity_date', { ascending: true });

  // Fetch fleet activities (Scope 1)
  const { data: fleetData } = await supabase
    .from('fleet_activities')
    .select('activity_date, total_emissions_kg')
    .eq('organization_id', organizationId)
    .gte('activity_date', periodStart.toISOString())
    .lte('activity_date', periodEnd.toISOString())
    .order('activity_date', { ascending: true });

  const facilityActivities = facilityData as Array<{
    activity_date: string;
    emissions_kg_co2e: number;
    scope: number;
  }> | null;

  const fleetActivities = fleetData as Array<{
    activity_date: string;
    total_emissions_kg: number;
  }> | null;

  const scope1: RawTimeSeriesData[] = [];
  const scope2: RawTimeSeriesData[] = [];
  const scope3: RawTimeSeriesData[] = [];

  // Process facility activities by scope
  if (facilityActivities) {
    for (const activity of facilityActivities) {
      const dataPoint = {
        date: activity.activity_date,
        value: (activity.emissions_kg_co2e || 0) / 1000, // Convert to tonnes
      };

      if (activity.scope === 1) scope1.push(dataPoint);
      else if (activity.scope === 2) scope2.push(dataPoint);
      else if (activity.scope === 3) scope3.push(dataPoint);
    }
  }

  // Add fleet activities to Scope 1
  if (fleetActivities) {
    for (const activity of fleetActivities) {
      scope1.push({
        date: activity.activity_date,
        value: (activity.total_emissions_kg || 0) / 1000,
      });
    }
  }

  return { scope1, scope2, scope3 };
}

/**
 * Fetch water consumption time-series data
 */
async function fetchWaterTrend(
  supabase: SupabaseClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RawTimeSeriesData[]> {
  const { data } = await supabase
    .from('facility_water_data')
    .select('period_end, consumption_m3')
    .eq('organization_id', organizationId)
    .gte('period_end', periodStart.toISOString())
    .lte('period_end', periodEnd.toISOString())
    .order('period_end', { ascending: true });

  const waterData = data as Array<{ period_end: string; consumption_m3: number }> | null;

  return (waterData || []).map(w => ({
    date: w.period_end,
    value: w.consumption_m3 || 0,
  }));
}

/**
 * Fetch energy consumption time-series data
 */
async function fetchEnergyTrend(
  supabase: SupabaseClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RawTimeSeriesData[]> {
  const { data } = await supabase
    .from('facility_activity_entries')
    .select('activity_date, quantity, unit, activity_type')
    .eq('organization_id', organizationId)
    .gte('activity_date', periodStart.toISOString())
    .lte('activity_date', periodEnd.toISOString())
    .order('activity_date', { ascending: true });

  const activities = data as Array<{
    activity_date: string;
    quantity: number;
    unit: string;
    activity_type: string;
  }> | null;

  // Filter for energy-related activities
  return (activities || [])
    .filter(a =>
      a.activity_type?.toLowerCase().includes('electricity') ||
      a.activity_type?.toLowerCase().includes('energy') ||
      a.unit?.toLowerCase().includes('kwh') ||
      a.unit?.toLowerCase().includes('mwh')
    )
    .map(a => ({
      date: a.activity_date,
      value: a.unit?.toLowerCase().includes('mwh') ? (a.quantity || 0) * 1000 : (a.quantity || 0),
    }));
}

/**
 * Fetch vitality score time-series data
 */
async function fetchVitalityTrend(
  supabase: SupabaseClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RawTimeSeriesData[]> {
  const { data } = await supabase
    .from('organization_vitality_scores')
    .select('calculated_at, overall_score')
    .eq('organization_id', organizationId)
    .gte('calculated_at', periodStart.toISOString())
    .lte('calculated_at', periodEnd.toISOString())
    .order('calculated_at', { ascending: true });

  const scores = data as Array<{ calculated_at: string; overall_score: number }> | null;

  return (scores || []).map(s => ({
    date: s.calculated_at,
    value: s.overall_score || 0,
  }));
}

/**
 * Aggregate time-series data by period (monthly, quarterly, yearly)
 */
function aggregateByPeriod(
  data: RawTimeSeriesData[],
  periodType: 'monthly' | 'quarterly' | 'yearly'
): RosaTrendDataPoint[] {
  const aggregated = new Map<string, { total: number; count: number }>();

  for (const point of data) {
    const date = new Date(point.date);
    let periodKey: string;

    switch (periodType) {
      case 'monthly':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'quarterly':
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        periodKey = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'yearly':
        periodKey = `${date.getFullYear()}`;
        break;
    }

    const existing = aggregated.get(periodKey) || { total: 0, count: 0 };
    aggregated.set(periodKey, {
      total: existing.total + point.value,
      count: existing.count + 1,
    });
  }

  return Array.from(aggregated.entries())
    .map(([key, { total }]) => ({
      date: key,
      value: total,
      label: formatPeriodLabel(key, periodType),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format period label for display
 */
function formatPeriodLabel(periodKey: string, periodType: 'monthly' | 'quarterly' | 'yearly'): string {
  switch (periodType) {
    case 'monthly': {
      const [year, month] = periodKey.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    case 'quarterly':
      return periodKey.replace('-', ' ');
    case 'yearly':
      return periodKey;
    default:
      return periodKey;
  }
}

/**
 * Combine multiple time-series into one
 */
function combineTimeSeriesData(series: RawTimeSeriesData[][]): RawTimeSeriesData[] {
  const combined = new Map<string, number>();

  for (const data of series) {
    for (const point of data) {
      const date = point.date.split('T')[0]; // Normalize to date only
      combined.set(date, (combined.get(date) || 0) + point.value);
    }
  }

  return Array.from(combined.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Analyze a trend from time-series data
 */
function analyzeTrend(
  metricName: string,
  metricKey: string,
  unit: string,
  dataPoints: RosaTrendDataPoint[],
  periodType: 'monthly' | 'quarterly' | 'yearly',
  periodStart: string,
  periodEnd: string
): RosaTrendAnalysis {
  if (dataPoints.length === 0) {
    return {
      metricName,
      metricKey,
      unit,
      currentValue: 0,
      previousValue: 0,
      changePercent: 0,
      trendDirection: 'stable',
      dataPoints: [],
      periodStart,
      periodEnd,
      periodType,
      insights: ['No data available for this period'],
    };
  }

  const currentValue = dataPoints[dataPoints.length - 1]?.value || 0;
  const previousValue = dataPoints.length > 1 ? dataPoints[dataPoints.length - 2]?.value || 0 : currentValue;

  const changePercent = previousValue !== 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : 0;

  const trendDirection = determineTrendDirection(dataPoints);
  const anomalies = detectAnomalies(dataPoints);
  const insights = generateTrendInsights(metricName, dataPoints, trendDirection, changePercent, unit);

  // Simple forecast using linear regression
  const forecast = dataPoints.length >= 3 ? generateForecast(dataPoints, periodType) : undefined;

  return {
    metricName,
    metricKey,
    unit,
    currentValue,
    previousValue,
    changePercent: Math.round(changePercent * 10) / 10,
    trendDirection,
    dataPoints,
    periodStart,
    periodEnd,
    periodType,
    forecast,
    anomalies: anomalies.length > 0 ? anomalies : undefined,
    insights,
  };
}

/**
 * Determine overall trend direction
 */
function determineTrendDirection(dataPoints: RosaTrendDataPoint[]): RosaTrendDirection {
  if (dataPoints.length < 2) return 'stable';

  const values = dataPoints.map(d => d.value);
  const n = values.length;

  // Calculate slope using simple linear regression
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate coefficient of variation for volatility check
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - yMean) ** 2, 0) / n);
  const cv = yMean !== 0 ? (stdDev / yMean) * 100 : 0;

  // High volatility
  if (cv > 30) return 'volatile';

  // Determine direction based on slope relative to mean
  const slopePercent = yMean !== 0 ? (slope / yMean) * 100 : 0;

  if (slopePercent > 5) return 'increasing';
  if (slopePercent < -5) return 'decreasing';
  return 'stable';
}

/**
 * Detect anomalies in time-series data
 */
function detectAnomalies(
  dataPoints: RosaTrendDataPoint[]
): Array<{ date: string; value: number; expectedValue: number; deviationPercent: number; description: string }> {
  if (dataPoints.length < 4) return [];

  const values = dataPoints.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

  const anomalies: Array<{
    date: string;
    value: number;
    expectedValue: number;
    deviationPercent: number;
    description: string;
  }> = [];

  // Use 2 standard deviations as threshold
  const threshold = 2 * stdDev;

  for (const point of dataPoints) {
    const deviation = Math.abs(point.value - mean);
    if (deviation > threshold) {
      const deviationPercent = mean !== 0 ? ((point.value - mean) / mean) * 100 : 0;
      anomalies.push({
        date: point.date,
        value: point.value,
        expectedValue: mean,
        deviationPercent: Math.round(deviationPercent),
        description: point.value > mean
          ? `Unusually high value (${Math.abs(deviationPercent).toFixed(0)}% above average)`
          : `Unusually low value (${Math.abs(deviationPercent).toFixed(0)}% below average)`,
      });
    }
  }

  return anomalies;
}

/**
 * Generate simple forecast using linear regression
 */
function generateForecast(
  dataPoints: RosaTrendDataPoint[],
  periodType: 'monthly' | 'quarterly' | 'yearly'
): { predictedValue: number; confidence: number; targetDate: string } | undefined {
  const values = dataPoints.map(d => d.value);
  const n = values.length;

  if (n < 3) return undefined;

  // Simple linear regression
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Predict next period
  const predictedValue = Math.max(0, intercept + slope * n);

  // Calculate R-squared for confidence
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;
  const confidence = Math.max(0, Math.min(1, rSquared));

  // Calculate target date
  const lastDate = new Date(dataPoints[dataPoints.length - 1].date.replace(/Q(\d)/, (_, q) => {
    const month = (parseInt(q) - 1) * 3 + 1;
    return `-${String(month).padStart(2, '0')}-01`;
  }));

  switch (periodType) {
    case 'monthly':
      lastDate.setMonth(lastDate.getMonth() + 1);
      break;
    case 'quarterly':
      lastDate.setMonth(lastDate.getMonth() + 3);
      break;
    case 'yearly':
      lastDate.setFullYear(lastDate.getFullYear() + 1);
      break;
  }

  return {
    predictedValue: Math.round(predictedValue * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    targetDate: lastDate.toISOString(),
  };
}

/**
 * Generate insights from trend analysis
 */
function generateTrendInsights(
  metricName: string,
  dataPoints: RosaTrendDataPoint[],
  direction: RosaTrendDirection,
  changePercent: number,
  unit: string
): string[] {
  const insights: string[] = [];

  if (dataPoints.length < 2) {
    insights.push(`Limited historical data available for ${metricName}`);
    return insights;
  }

  // Direction insight
  switch (direction) {
    case 'increasing':
      if (metricName.toLowerCase().includes('emissions') || metricName.toLowerCase().includes('consumption')) {
        insights.push(`${metricName} is trending upward - consider investigating the causes`);
      } else {
        insights.push(`${metricName} is improving over time`);
      }
      break;
    case 'decreasing':
      if (metricName.toLowerCase().includes('emissions') || metricName.toLowerCase().includes('consumption')) {
        insights.push(`${metricName} is trending downward - your reduction efforts are working`);
      } else if (metricName.toLowerCase().includes('score')) {
        insights.push(`${metricName} is declining - this may need attention`);
      }
      break;
    case 'stable':
      insights.push(`${metricName} has remained relatively stable`);
      break;
    case 'volatile':
      insights.push(`${metricName} shows high variability - consider investigating the causes`);
      break;
  }

  // Recent change insight
  if (Math.abs(changePercent) > 10) {
    const direction = changePercent > 0 ? 'increased' : 'decreased';
    insights.push(`${metricName} ${direction} by ${Math.abs(changePercent).toFixed(1)}% in the most recent period`);
  }

  // Peak/trough insight
  const values = dataPoints.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const currentValue = values[values.length - 1];

  if (currentValue === maxValue && dataPoints.length > 2) {
    insights.push(`Current ${metricName} is at its highest recorded level`);
  } else if (currentValue === minValue && dataPoints.length > 2) {
    insights.push(`Current ${metricName} is at its lowest recorded level`);
  }

  return insights.slice(0, 3);
}

/**
 * Calculate year-over-year summary
 */
function calculateYearOverYear(
  trends: RosaTrendReport['trends']
): RosaTrendReport['yearOverYearSummary'] | undefined {
  // Only calculate if we have trend data
  if (!trends.totalEmissions && !trends.waterConsumption && !trends.vitalityScore) {
    return undefined;
  }

  return {
    totalEmissionsChange: trends.totalEmissions?.changePercent || 0,
    waterChange: trends.waterConsumption?.changePercent || 0,
    energyChange: trends.energyConsumption?.changePercent || 0,
    vitalityScoreChange: trends.vitalityScore?.changePercent || 0,
  };
}

/**
 * Generate key findings from all trends
 */
function generateKeyFindings(trends: RosaTrendReport['trends']): string[] {
  const findings: string[] = [];

  // Check emissions trends
  if (trends.totalEmissions) {
    if (trends.totalEmissions.trendDirection === 'decreasing') {
      findings.push(`Total emissions are decreasing (${Math.abs(trends.totalEmissions.changePercent)}% reduction)`);
    } else if (trends.totalEmissions.trendDirection === 'increasing') {
      findings.push(`Total emissions are increasing - review recent changes to identify causes`);
    }
  }

  // Check water trends
  if (trends.waterConsumption?.trendDirection === 'decreasing') {
    findings.push('Water consumption is trending downward');
  }

  // Check vitality score
  if (trends.vitalityScore) {
    if (trends.vitalityScore.trendDirection === 'increasing') {
      findings.push('Vitality Score is improving over time');
    } else if (trends.vitalityScore.trendDirection === 'decreasing') {
      findings.push('Vitality Score is declining - consider reviewing sustainability initiatives');
    }
  }

  // Check for anomalies across all trends
  const allAnomalies = [
    ...(trends.scope1Emissions?.anomalies || []),
    ...(trends.scope2Emissions?.anomalies || []),
    ...(trends.totalEmissions?.anomalies || []),
  ];

  if (allAnomalies.length > 0) {
    findings.push(`Detected ${allAnomalies.length} unusual data point(s) that may warrant investigation`);
  }

  return findings.slice(0, 5);
}

/**
 * Format trend report for Rosa's context
 */
export function formatTrendReportForPrompt(report: RosaTrendReport): string {
  const lines: string[] = [];

  lines.push('### Trend Analysis');
  lines.push(`Reporting Period: ${formatDateRange(report.reportingPeriod.start, report.reportingPeriod.end)}`);
  lines.push('');

  // Key findings first
  if (report.keyFindings.length > 0) {
    lines.push('**Key Findings:**');
    for (const finding of report.keyFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
  }

  // Year-over-year summary
  if (report.yearOverYearSummary) {
    lines.push('**Period-over-Period Changes:**');
    const yoy = report.yearOverYearSummary;
    if (yoy.totalEmissionsChange !== 0) {
      const icon = yoy.totalEmissionsChange < 0 ? '📉' : '📈';
      lines.push(`- ${icon} Total Emissions: ${yoy.totalEmissionsChange > 0 ? '+' : ''}${yoy.totalEmissionsChange.toFixed(1)}%`);
    }
    if (yoy.waterChange !== 0) {
      const icon = yoy.waterChange < 0 ? '📉' : '📈';
      lines.push(`- ${icon} Water: ${yoy.waterChange > 0 ? '+' : ''}${yoy.waterChange.toFixed(1)}%`);
    }
    if (yoy.vitalityScoreChange !== 0) {
      const icon = yoy.vitalityScoreChange > 0 ? '📈' : '📉';
      lines.push(`- ${icon} Vitality Score: ${yoy.vitalityScoreChange > 0 ? '+' : ''}${yoy.vitalityScoreChange.toFixed(1)}%`);
    }
    lines.push('');
  }

  // Individual metric trends
  const trendEntries = Object.entries(report.trends).filter(([, v]) => v !== undefined);
  if (trendEntries.length > 0) {
    lines.push('**Metric Trends:**');
    for (const [, trend] of trendEntries) {
      if (!trend) continue;
      const directionIcon = getTrendIcon(trend.trendDirection);
      lines.push(`- ${directionIcon} ${trend.metricName}: ${trend.currentValue.toFixed(2)} ${trend.unit} (${trend.trendDirection})`);

      if (trend.forecast) {
        lines.push(`  - Forecast: ${trend.forecast.predictedValue.toFixed(2)} ${trend.unit} (${(trend.forecast.confidence * 100).toFixed(0)}% confidence)`);
      }
    }
  }

  return lines.join('\n');
}

function getTrendIcon(direction: RosaTrendDirection): string {
  switch (direction) {
    case 'increasing': return '📈';
    case 'decreasing': return '📉';
    case 'stable': return '➡️';
    case 'volatile': return '📊';
    default: return '•';
  }
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return `${months[startDate.getMonth()]} ${startDate.getFullYear()} - ${months[endDate.getMonth()]} ${endDate.getFullYear()}`;
}
