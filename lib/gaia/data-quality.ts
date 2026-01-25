// Rosa Data Quality Analysis Module
// Feature 1: Proactive Data Quality Insights

import { createClient } from '@supabase/supabase-js';
import type {
  RosaDataQualityMetrics,
  RosaDataQualityIssue,
  RosaDataQualityStatus,
  RosaDataQualitySeverity,
} from '@/lib/types/gaia';

type SupabaseClient = ReturnType<typeof createClient>;

interface DataQualityCheck {
  category: string;
  check: string;
  passed: boolean;
  severity: RosaDataQualitySeverity;
  issue?: string;
  recommendation?: string;
  actionPath?: string;
  impactDescription?: string;
  lastUpdated?: string;
}

/**
 * Analyze data quality for an organization
 * Returns comprehensive metrics about data completeness, freshness, and accuracy
 */
export async function analyzeDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RosaDataQualityMetrics> {
  const checks: DataQualityCheck[] = [];
  const issues: RosaDataQualityIssue[] = [];
  const recommendations: string[] = [];

  // Run all quality checks
  const [productChecks, facilityChecks, fleetChecks, supplierChecks, emissionsChecks] = await Promise.all([
    checkProductDataQuality(supabase, organizationId),
    checkFacilityDataQuality(supabase, organizationId),
    checkFleetDataQuality(supabase, organizationId),
    checkSupplierDataQuality(supabase, organizationId),
    checkEmissionsDataQuality(supabase, organizationId),
  ]);

  checks.push(...productChecks, ...facilityChecks, ...fleetChecks, ...supplierChecks, ...emissionsChecks);

  // Convert failed checks to issues
  for (const check of checks) {
    if (!check.passed && check.issue) {
      issues.push({
        category: check.category,
        issue: check.issue,
        severity: check.severity,
        recommendation: check.recommendation || 'Review and update this data',
        actionPath: check.actionPath,
        impactDescription: check.impactDescription,
      });
    }
  }

  // Calculate category scores
  const categoryScores = calculateCategoryScores(checks);

  // Calculate overall scores
  const completenessScore = calculateCompletenessScore(checks);
  const freshnessScore = calculateFreshnessScore(checks);
  const accuracyScore = calculateAccuracyScore(checks);
  const overallScore = Math.round((completenessScore + freshnessScore + accuracyScore) / 3);

  // Generate recommendations based on issues
  recommendations.push(...generateRecommendations(issues, categoryScores));

  return {
    overallScore,
    completenessScore,
    freshnessScore,
    accuracyScore,
    issues: issues.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    categoryScores,
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
  };
}

function severityOrder(severity: RosaDataQualitySeverity): number {
  switch (severity) {
    case 'critical': return 0;
    case 'warning': return 1;
    case 'info': return 2;
    default: return 3;
  }
}

/**
 * Check product data quality
 */
async function checkProductDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataQualityCheck[]> {
  const checks: DataQualityCheck[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get products with related data
  const { data: products, count } = await supabase
    .from('products')
    .select(`
      id, name, has_lca, updated_at,
      product_ingredients (id),
      product_packaging (id)
    `, { count: 'exact' })
    .eq('organization_id', organizationId);

  const productList = products as Array<{
    id: string;
    name: string;
    has_lca: boolean;
    updated_at: string;
    product_ingredients: { id: string }[];
    product_packaging: { id: string }[];
  }> | null;

  // Check: Has products
  if (!productList || productList.length === 0) {
    checks.push({
      category: 'products',
      check: 'has_products',
      passed: false,
      severity: 'critical',
      issue: 'No products have been added to the platform',
      recommendation: 'Add your products to start tracking their environmental impact',
      actionPath: '/products',
      impactDescription: 'Cannot calculate product carbon footprints without product data',
    });
  } else {
    checks.push({ category: 'products', check: 'has_products', passed: true, severity: 'info' });

    // Check: LCA coverage
    const withLca = productList.filter(p => p.has_lca).length;
    const lcaCoverage = (withLca / productList.length) * 100;

    if (lcaCoverage < 25) {
      checks.push({
        category: 'products',
        check: 'lca_coverage',
        passed: false,
        severity: 'critical',
        issue: `Only ${withLca} of ${productList.length} products (${lcaCoverage.toFixed(0)}%) have LCA calculations`,
        recommendation: 'Complete LCA calculations for your key products to understand their carbon footprint',
        actionPath: '/products',
        impactDescription: 'Low LCA coverage means your Scope 3 emissions are likely underestimated',
      });
    } else if (lcaCoverage < 75) {
      checks.push({
        category: 'products',
        check: 'lca_coverage',
        passed: false,
        severity: 'warning',
        issue: `${withLca} of ${productList.length} products (${lcaCoverage.toFixed(0)}%) have LCA calculations`,
        recommendation: 'Increase LCA coverage to improve emission accuracy',
        actionPath: '/products',
        impactDescription: 'Completing more LCAs will give you a more accurate carbon footprint',
      });
    } else {
      checks.push({ category: 'products', check: 'lca_coverage', passed: true, severity: 'info' });
    }

    // Check: Products with ingredients
    const withIngredients = productList.filter(p => p.product_ingredients && p.product_ingredients.length > 0).length;
    if (withIngredients < productList.length * 0.5) {
      checks.push({
        category: 'products',
        check: 'has_ingredients',
        passed: false,
        severity: 'warning',
        issue: `Only ${withIngredients} of ${productList.length} products have ingredient data`,
        recommendation: 'Add ingredients to your products for more accurate LCA calculations',
        actionPath: '/products',
        impactDescription: 'Ingredient data is essential for accurate product carbon footprints',
      });
    } else {
      checks.push({ category: 'products', check: 'has_ingredients', passed: true, severity: 'info' });
    }

    // Check: Products with packaging
    const withPackaging = productList.filter(p => p.product_packaging && p.product_packaging.length > 0).length;
    if (withPackaging < productList.length * 0.5) {
      checks.push({
        category: 'products',
        check: 'has_packaging',
        passed: false,
        severity: 'warning',
        issue: `Only ${withPackaging} of ${productList.length} products have packaging data`,
        recommendation: 'Add packaging details to improve LCA accuracy (packaging typically accounts for 20-30% of product footprint)',
        actionPath: '/products',
        impactDescription: 'Packaging is a significant contributor to product carbon footprints',
      });
    } else {
      checks.push({ category: 'products', check: 'has_packaging', passed: true, severity: 'info' });
    }

    // Check: Data freshness
    const staleProducts = productList.filter(p => new Date(p.updated_at) < thirtyDaysAgo).length;
    if (staleProducts > productList.length * 0.5) {
      checks.push({
        category: 'products',
        check: 'data_freshness',
        passed: false,
        severity: 'info',
        issue: `${staleProducts} products haven't been updated in over 30 days`,
        recommendation: 'Review and update product data to ensure accuracy',
        actionPath: '/products',
        lastUpdated: productList[0]?.updated_at,
      });
    } else {
      checks.push({
        category: 'products',
        check: 'data_freshness',
        passed: true,
        severity: 'info',
        lastUpdated: productList[0]?.updated_at,
      });
    }
  }

  return checks;
}

/**
 * Check facility data quality
 */
async function checkFacilityDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataQualityCheck[]> {
  const checks: DataQualityCheck[] = [];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Get facilities with related data
  const { data: facilities } = await supabase
    .from('facilities')
    .select(`
      id, name, type, updated_at,
      facility_water_data (id, period_end),
      facility_activity_entries (id, activity_date, activity_type)
    `)
    .eq('organization_id', organizationId);

  const facilityList = facilities as Array<{
    id: string;
    name: string;
    type: string;
    updated_at: string;
    facility_water_data: { id: string; period_end: string }[];
    facility_activity_entries: { id: string; activity_date: string; activity_type: string }[];
  }> | null;

  if (!facilityList || facilityList.length === 0) {
    checks.push({
      category: 'facilities',
      check: 'has_facilities',
      passed: false,
      severity: 'critical',
      issue: 'No facilities have been added',
      recommendation: 'Add your production sites, offices, and warehouses to track their environmental impact',
      actionPath: '/company/facilities',
      impactDescription: 'Facility data is required for Scope 1 and Scope 2 emissions tracking',
    });
  } else {
    checks.push({ category: 'facilities', check: 'has_facilities', passed: true, severity: 'info' });

    // Check: Utility data coverage
    const withUtilityData = facilityList.filter(f =>
      f.facility_activity_entries && f.facility_activity_entries.length > 0
    ).length;

    if (withUtilityData === 0) {
      checks.push({
        category: 'facilities',
        check: 'has_utility_data',
        passed: false,
        severity: 'critical',
        issue: 'No facilities have utility data (electricity, gas, etc.)',
        recommendation: 'Add utility consumption data from your bills to calculate Scope 1 & 2 emissions',
        actionPath: '/company/facilities',
        impactDescription: 'Cannot calculate facility emissions without utility data',
      });
    } else if (withUtilityData < facilityList.length) {
      checks.push({
        category: 'facilities',
        check: 'has_utility_data',
        passed: false,
        severity: 'warning',
        issue: `Only ${withUtilityData} of ${facilityList.length} facilities have utility data`,
        recommendation: 'Add utility data for all facilities for complete emissions tracking',
        actionPath: '/company/facilities',
      });
    } else {
      checks.push({ category: 'facilities', check: 'has_utility_data', passed: true, severity: 'info' });
    }

    // Check: Water data coverage
    const withWaterData = facilityList.filter(f =>
      f.facility_water_data && f.facility_water_data.length > 0
    ).length;

    if (withWaterData < facilityList.length * 0.5) {
      checks.push({
        category: 'facilities',
        check: 'has_water_data',
        passed: false,
        severity: 'warning',
        issue: `Only ${withWaterData} of ${facilityList.length} facilities have water consumption data`,
        recommendation: 'Add water consumption data to track water usage and improve your Water Vitality Score',
        actionPath: '/company/facilities',
        impactDescription: 'Water data is important for drinks industry sustainability reporting',
      });
    } else {
      checks.push({ category: 'facilities', check: 'has_water_data', passed: true, severity: 'info' });
    }

    // Check: Data freshness (utility data)
    const staleUtilityData = facilityList.filter(f => {
      if (!f.facility_activity_entries || f.facility_activity_entries.length === 0) return false;
      const latestDate = f.facility_activity_entries
        .map(e => new Date(e.activity_date))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return latestDate < sixMonthsAgo;
    }).length;

    if (staleUtilityData > 0) {
      checks.push({
        category: 'facilities',
        check: 'utility_data_freshness',
        passed: false,
        severity: 'warning',
        issue: `${staleUtilityData} facilities have utility data older than 6 months`,
        recommendation: 'Update utility data with recent consumption figures',
        actionPath: '/company/facilities',
        impactDescription: 'Stale data may not reflect current energy efficiency improvements',
      });
    } else {
      checks.push({ category: 'facilities', check: 'utility_data_freshness', passed: true, severity: 'info' });
    }
  }

  return checks;
}

/**
 * Check fleet data quality
 */
async function checkFleetDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataQualityCheck[]> {
  const checks: DataQualityCheck[] = [];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Get fleet data
  const { data: vehicles } = await supabase
    .from('fleet_vehicles')
    .select('id, registration, vehicle_type')
    .eq('organization_id', organizationId);

  const { data: activities } = await supabase
    .from('fleet_activities')
    .select('id, vehicle_id, activity_date, distance_km')
    .eq('organization_id', organizationId)
    .order('activity_date', { ascending: false });

  const vehicleList = vehicles as Array<{ id: string; registration: string; vehicle_type: string }> | null;
  const activityList = activities as Array<{ id: string; vehicle_id: string; activity_date: string; distance_km: number }> | null;

  // Check: Has fleet vehicles (this is optional for many companies)
  if (!vehicleList || vehicleList.length === 0) {
    checks.push({
      category: 'fleet',
      check: 'has_vehicles',
      passed: true, // Not critical if company doesn't have fleet
      severity: 'info',
      issue: 'No fleet vehicles registered',
      recommendation: 'If you have company vehicles, add them to track fleet emissions',
      actionPath: '/company/fleet',
    });
  } else {
    checks.push({ category: 'fleet', check: 'has_vehicles', passed: true, severity: 'info' });

    // Check: Activity data for vehicles
    const vehicleIds = vehicleList.map(v => v.id);
    const vehiclesWithActivity = new Set(activityList?.map(a => a.vehicle_id) || []);
    const vehiclesWithoutActivity = vehicleIds.filter(id => !vehiclesWithActivity.has(id));

    if (vehiclesWithoutActivity.length > 0) {
      checks.push({
        category: 'fleet',
        check: 'has_activity_data',
        passed: false,
        severity: 'warning',
        issue: `${vehiclesWithoutActivity.length} vehicles have no recorded activity`,
        recommendation: 'Add mileage and fuel data for all fleet vehicles',
        actionPath: '/company/fleet',
        impactDescription: 'Missing activity data means incomplete fleet emissions',
      });
    } else {
      checks.push({ category: 'fleet', check: 'has_activity_data', passed: true, severity: 'info' });
    }

    // Check: Recent activity data
    if (activityList && activityList.length > 0) {
      const latestActivity = new Date(activityList[0].activity_date);
      if (latestActivity < threeMonthsAgo) {
        checks.push({
          category: 'fleet',
          check: 'activity_data_freshness',
          passed: false,
          severity: 'warning',
          issue: 'Fleet activity data is more than 3 months old',
          recommendation: 'Update fleet mileage data regularly for accurate emissions tracking',
          actionPath: '/company/fleet',
          lastUpdated: activityList[0].activity_date,
        });
      } else {
        checks.push({
          category: 'fleet',
          check: 'activity_data_freshness',
          passed: true,
          severity: 'info',
          lastUpdated: activityList[0].activity_date,
        });
      }
    }
  }

  return checks;
}

/**
 * Check supplier data quality
 */
async function checkSupplierDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataQualityCheck[]> {
  const checks: DataQualityCheck[] = [];

  // Get suppliers
  const { data: suppliers, count } = await supabase
    .from('suppliers')
    .select('id, name, engagement_status, data_quality_score', { count: 'exact' })
    .eq('organization_id', organizationId);

  const supplierList = suppliers as Array<{
    id: string;
    name: string;
    engagement_status: string;
    data_quality_score: number | null;
  }> | null;

  if (!supplierList || supplierList.length === 0) {
    checks.push({
      category: 'suppliers',
      check: 'has_suppliers',
      passed: false,
      severity: 'warning',
      issue: 'No suppliers have been added',
      recommendation: 'Add your key suppliers to track Scope 3 supply chain emissions',
      actionPath: '/suppliers',
      impactDescription: 'Supplier data is essential for accurate Scope 3 emissions',
    });
  } else {
    checks.push({ category: 'suppliers', check: 'has_suppliers', passed: true, severity: 'info' });

    // Check: Supplier engagement
    const engaged = supplierList.filter(s =>
      s.engagement_status === 'engaged' || s.engagement_status === 'responding'
    ).length;
    const engagementRate = (engaged / supplierList.length) * 100;

    if (engagementRate < 20) {
      checks.push({
        category: 'suppliers',
        check: 'supplier_engagement',
        passed: false,
        severity: 'warning',
        issue: `Only ${engagementRate.toFixed(0)}% of suppliers are engaged`,
        recommendation: 'Engage more suppliers to improve Scope 3 data accuracy',
        actionPath: '/suppliers',
        impactDescription: 'Low supplier engagement means relying on industry averages for emissions',
      });
    } else {
      checks.push({ category: 'suppliers', check: 'supplier_engagement', passed: true, severity: 'info' });
    }

    // Check: Data quality scores
    const suppliersWithScores = supplierList.filter(s => s.data_quality_score !== null);
    const avgQualityScore = suppliersWithScores.length > 0
      ? suppliersWithScores.reduce((sum, s) => sum + (s.data_quality_score || 0), 0) / suppliersWithScores.length
      : 0;

    if (avgQualityScore < 50) {
      checks.push({
        category: 'suppliers',
        check: 'data_quality_scores',
        passed: false,
        severity: 'info',
        issue: `Average supplier data quality score is ${avgQualityScore.toFixed(0)}%`,
        recommendation: 'Work with suppliers to improve the quality of their emissions data',
        actionPath: '/suppliers',
      });
    } else {
      checks.push({ category: 'suppliers', check: 'data_quality_scores', passed: true, severity: 'info' });
    }
  }

  return checks;
}

/**
 * Check emissions data quality
 */
async function checkEmissionsDataQuality(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DataQualityCheck[]> {
  const checks: DataQualityCheck[] = [];

  // Get emissions data
  const { data: facilityActivities } = await supabase
    .from('facility_activity_entries')
    .select('scope, emissions_kg_co2e')
    .eq('organization_id', organizationId);

  const { data: fleetActivities } = await supabase
    .from('fleet_activities')
    .select('total_emissions_kg')
    .eq('organization_id', organizationId);

  const { data: overheads } = await supabase
    .from('corporate_overheads')
    .select('overhead_type, total_emissions_kg')
    .eq('organization_id', organizationId);

  const activities = facilityActivities as Array<{ scope: number; emissions_kg_co2e: number }> | null;
  const fleet = fleetActivities as Array<{ total_emissions_kg: number }> | null;
  const overheadList = overheads as Array<{ overhead_type: string; total_emissions_kg: number }> | null;

  // Calculate scope coverage
  const hasScope1 = (activities?.some(a => a.scope === 1) || (fleet && fleet.length > 0));
  const hasScope2 = activities?.some(a => a.scope === 2);
  const hasScope3 = activities?.some(a => a.scope === 3) || (overheadList && overheadList.length > 0);

  if (!hasScope1) {
    checks.push({
      category: 'emissions',
      check: 'has_scope1',
      passed: false,
      severity: 'critical',
      issue: 'No Scope 1 emissions data (direct emissions from facilities/fleet)',
      recommendation: 'Add fuel consumption and fleet data to capture Scope 1 emissions',
      actionPath: '/company/facilities',
      impactDescription: 'Scope 1 is mandatory for most sustainability reporting frameworks',
    });
  } else {
    checks.push({ category: 'emissions', check: 'has_scope1', passed: true, severity: 'info' });
  }

  if (!hasScope2) {
    checks.push({
      category: 'emissions',
      check: 'has_scope2',
      passed: false,
      severity: 'critical',
      issue: 'No Scope 2 emissions data (electricity and purchased energy)',
      recommendation: 'Add electricity consumption data from your utility bills',
      actionPath: '/company/facilities',
      impactDescription: 'Scope 2 is mandatory for most sustainability reporting frameworks',
    });
  } else {
    checks.push({ category: 'emissions', check: 'has_scope2', passed: true, severity: 'info' });
  }

  if (!hasScope3) {
    checks.push({
      category: 'emissions',
      check: 'has_scope3',
      passed: false,
      severity: 'warning',
      issue: 'Limited Scope 3 emissions data (supply chain and value chain)',
      recommendation: 'Add product LCAs, supplier data, and business travel to capture Scope 3',
      actionPath: '/products',
      impactDescription: 'Scope 3 typically accounts for 80%+ of drinks industry emissions',
    });
  } else {
    checks.push({ category: 'emissions', check: 'has_scope3', passed: true, severity: 'info' });
  }

  return checks;
}

/**
 * Calculate category scores from checks
 */
function calculateCategoryScores(checks: DataQualityCheck[]) {
  const categories = ['products', 'facilities', 'fleet', 'suppliers', 'emissions'];
  const scores: Record<string, { score: number; status: RosaDataQualityStatus; lastUpdated?: string }> = {};

  for (const category of categories) {
    const categoryChecks = checks.filter(c => c.category === category);
    if (categoryChecks.length === 0) {
      scores[category] = { score: 0, status: 'missing' };
      continue;
    }

    const passedCount = categoryChecks.filter(c => c.passed).length;
    const score = Math.round((passedCount / categoryChecks.length) * 100);

    let status: RosaDataQualityStatus;
    if (score === 100) status = 'complete';
    else if (score >= 50) status = 'partial';
    else if (score > 0) status = 'stale';
    else status = 'missing';

    const lastUpdated = categoryChecks.find(c => c.lastUpdated)?.lastUpdated;

    scores[category] = { score, status, lastUpdated };
  }

  return scores as RosaDataQualityMetrics['categoryScores'];
}

/**
 * Calculate completeness score
 */
function calculateCompletenessScore(checks: DataQualityCheck[]): number {
  const completenessChecks = checks.filter(c =>
    c.check.includes('has_') || c.check.includes('coverage')
  );
  if (completenessChecks.length === 0) return 0;

  const passed = completenessChecks.filter(c => c.passed).length;
  return Math.round((passed / completenessChecks.length) * 100);
}

/**
 * Calculate freshness score
 */
function calculateFreshnessScore(checks: DataQualityCheck[]): number {
  const freshnessChecks = checks.filter(c => c.check.includes('freshness'));
  if (freshnessChecks.length === 0) return 100; // No freshness checks means data is current

  const passed = freshnessChecks.filter(c => c.passed).length;
  return Math.round((passed / freshnessChecks.length) * 100);
}

/**
 * Calculate accuracy score (based on data quality scores and engagement)
 */
function calculateAccuracyScore(checks: DataQualityCheck[]): number {
  const accuracyChecks = checks.filter(c =>
    c.check.includes('quality') || c.check.includes('engagement')
  );
  if (accuracyChecks.length === 0) return 75; // Default to moderate accuracy

  const passed = accuracyChecks.filter(c => c.passed).length;
  return Math.round((passed / accuracyChecks.length) * 100);
}

/**
 * Generate recommendations based on issues
 */
function generateRecommendations(
  issues: RosaDataQualityIssue[],
  categoryScores: RosaDataQualityMetrics['categoryScores']
): string[] {
  const recommendations: string[] = [];

  // Critical issues first
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push(
      `Priority: Address ${criticalIssues.length} critical data gap${criticalIssues.length > 1 ? 's' : ''} - ${criticalIssues[0].recommendation}`
    );
  }

  // Category-specific recommendations
  if (categoryScores.products.score < 50) {
    recommendations.push('Focus on adding product ingredients and completing LCA calculations for your top-selling products');
  }

  if (categoryScores.facilities.score < 50) {
    recommendations.push('Add utility consumption data (electricity, gas, water) for all your facilities');
  }

  if (categoryScores.emissions.score < 75) {
    recommendations.push('Ensure you have data for all three emission scopes for complete carbon footprint reporting');
  }

  if (categoryScores.suppliers.score < 50) {
    recommendations.push('Engage your top suppliers to improve Scope 3 data accuracy');
  }

  // General improvement recommendation
  const lowestCategory = Object.entries(categoryScores)
    .sort(([, a], [, b]) => a.score - b.score)[0];

  if (lowestCategory && lowestCategory[1].score < 75) {
    recommendations.push(
      `Your ${lowestCategory[0]} data is your biggest improvement opportunity (currently ${lowestCategory[1].score}% complete)`
    );
  }

  return recommendations;
}

/**
 * Format data quality for Rosa's context
 */
export function formatDataQualityForPrompt(metrics: RosaDataQualityMetrics): string {
  const lines: string[] = [];

  lines.push('### Data Quality Assessment');
  lines.push(`- **Overall Data Quality Score**: ${metrics.overallScore}/100`);
  lines.push(`  - Completeness: ${metrics.completenessScore}%`);
  lines.push(`  - Freshness: ${metrics.freshnessScore}%`);
  lines.push(`  - Accuracy: ${metrics.accuracyScore}%`);
  lines.push('');

  // Category breakdown
  lines.push('**Category Scores:**');
  for (const [category, data] of Object.entries(metrics.categoryScores)) {
    lines.push(`- ${category.charAt(0).toUpperCase() + category.slice(1)}: ${data.score}/100 (${data.status})`);
  }
  lines.push('');

  // Issues
  if (metrics.issues.length > 0) {
    lines.push('**Data Issues to Address:**');
    for (const issue of metrics.issues.slice(0, 5)) {
      const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`- ${severityIcon} ${issue.issue}`);
      if (issue.recommendation) {
        lines.push(`  → ${issue.recommendation}`);
      }
    }
    lines.push('');
  }

  // Top recommendations
  if (metrics.recommendations.length > 0) {
    lines.push('**Top Recommendations:**');
    for (const rec of metrics.recommendations.slice(0, 3)) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join('\n');
}
