"use client";

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';

import { useCompanyMetrics, CompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useVitalityBenchmarks } from '@/hooks/data/useVitalityBenchmarks';
import { useFacilityWaterData } from '@/hooks/data/useFacilityWaterData';
import { useOrganization } from '@/lib/organizationContext';
import { usePersistedYear, useLatestDataYear } from '@/hooks/usePersistedYear';
import type {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

import { supabase } from '@/lib/supabaseClient';
import { calculateVitalityScores } from '@/components/vitality/VitalityScoreHero';
import { EsgVitalityScoreHero } from '@/components/vitality/EsgVitalityScoreHero';
import { Eyebrow } from '@/components/studio/eyebrow';
import type { VitalityComposite } from '@/lib/vitality/composite';
import {
  listMissingSubScores,
  listStrongSubScores,
  listWeakSubScores,
} from '@/lib/vitality/read-prompt';
import { getBenchmarkForProductType } from '@/lib/industry-benchmarks';
import { fetchProducts } from '@/lib/products';
import type {
  ClimateScoreBreakdown,
  WaterScoreBreakdown,
  CircularityScoreBreakdown,
  NatureScoreBreakdown,
} from '@/lib/vitality/environmental';
import { PillarCard, PillarGrid, PerformanceSummary } from '@/components/vitality/PillarCard';
// Round 3 (auto-research): these deep-dive / sheet panels render only inside an
// expanded pillar or an opened sheet, so their recharts-heavy bundles shouldn't
// sit in /performance's First Load JS. Lazy-load them.
const CarbonDeepDive = dynamic(() => import('@/components/vitality/CarbonDeepDive').then((m) => m.CarbonDeepDive), { ssr: false });
const WaterDeepDive = dynamic(() => import('@/components/vitality/WaterDeepDive').then((m) => m.WaterDeepDive), { ssr: false });
const WasteDeepDive = dynamic(() => import('@/components/vitality/WasteDeepDive').then((m) => m.WasteDeepDive), { ssr: false });
const NatureDeepDive = dynamic(() => import('@/components/vitality/NatureDeepDive').then((m) => m.NatureDeepDive), { ssr: false });
const CarbonBreakdownSheet = dynamic(() => import('@/components/vitality/CarbonBreakdownSheet').then((m) => m.CarbonBreakdownSheet), { ssr: false });
const WaterImpactSheet = dynamic(() => import('@/components/vitality/WaterImpactSheet').then((m) => m.WaterImpactSheet), { ssr: false });
const CircularitySheet = dynamic(() => import('@/components/vitality/CircularitySheet').then((m) => m.CircularitySheet), { ssr: false });
const NatureImpactSheet = dynamic(() => import('@/components/vitality/NatureImpactSheet').then((m) => m.NatureImpactSheet), { ssr: false });
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { NatureMetrics } from '@/hooks/data/useCompanyMetrics';

/**
 * Derive biodiversity risk from per-unit nature metrics using the established
 * NATURE_PERFORMANCE_THRESHOLDS. Evaluates all 4 impact categories and averages
 * their performance levels to determine overall risk.
 *
 * Previously this used raw totals (land_use + ecotoxicity) with arbitrary thresholds,
 * which produced misleading results — e.g. showing "high" risk (score 30) when all
 * individual per-unit metrics were rated "Excellent".
 */
function deriveBiodiversityRisk(natureMetrics: NatureMetrics | null): 'high' | 'medium' | 'low' | undefined {
  if (!natureMetrics) return undefined;
  if (!natureMetrics.per_unit) return undefined;

  const pu = natureMetrics.per_unit;

  // Score each metric: 3 = excellent, 2 = good, 1 = needs work
  function rateMetric(value: number, excellent: number, good: number): number {
    if (value <= excellent) return 3; // Excellent
    if (value <= good) return 2;     // Good
    return 1;                         // Needs work
  }

  const scores = [
    rateMetric(pu.land_use || 0, 500, 2000),
    rateMetric(pu.terrestrial_ecotoxicity || 0, 5, 15),
    rateMetric(pu.freshwater_eutrophication || 0, 0.3, 0.7),
    rateMetric(pu.terrestrial_acidification || 0, 1.5, 3.0),
  ];

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Map average metric score to risk level
  if (avgScore >= 2.5) return 'low';    // Mostly excellent → low risk
  if (avgScore >= 1.5) return 'medium'; // Mixed performance → medium risk
  return 'high';                         // Mostly needs work → high risk
}

interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: number;
}

const SCOPE3_CATEGORY_DEFINITIONS = [
  { category: 1, name: 'Purchased Goods & Services', description: 'Upstream emissions from purchased goods and services' },
  { category: 2, name: 'Capital Goods', description: 'Upstream emissions from capital goods' },
  { category: 3, name: 'Fuel & Energy Related Activities', description: 'Not included in Scope 1 or 2' },
  { category: 4, name: 'Upstream Transportation', description: 'Transportation of purchased goods' },
  { category: 5, name: 'Waste Generated in Operations', description: 'Disposal of waste generated' },
  { category: 6, name: 'Business Travel', description: 'Employee business travel' },
  { category: 7, name: 'Employee Commuting', description: 'Employee travel to work' },
  { category: 8, name: 'Upstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 9, name: 'Downstream Transportation', description: 'Transportation of sold products' },
  { category: 10, name: 'Processing of Sold Products', description: 'Processing by third parties' },
  { category: 11, name: 'Use of Sold Products', description: 'End use of products' },
  { category: 12, name: 'End-of-Life Treatment', description: 'Disposal of sold products' },
  { category: 13, name: 'Downstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 14, name: 'Franchises', description: 'Emissions from franchises' },
  { category: 15, name: 'Investments', description: 'Emissions from investments' },
];

function transformFootprintToScope3Categories(
  footprintData: any
): {
  categories: Scope3CategoryData[];
  productDetails: ProductEmissionDetail[];
  travelDetails: BusinessTravelDetail[];
  logisticsDetails: LogisticsDetail[];
  wasteDetails: WasteDetail[];
  totalScope3: number;
} {
  if (!footprintData?.breakdown?.scope3) {
    return {
      categories: [],
      productDetails: [],
      travelDetails: [],
      logisticsDetails: [],
      wasteDetails: [],
      totalScope3: 0,
    };
  }

  const scope3Data = footprintData.breakdown.scope3;

  // Map all available scope 3 category data from corporate emissions calculator
  // Categories not populated remain as 0 with 'missing' quality
  // GHG Protocol Category Mapping:
  // - Cat 1: Purchased goods & services (includes products, purchased_services, marketing_materials)
  // - Cat 8: Upstream leased assets (only for actual leased asset emissions, NOT purchased services)
  const cat1Value = (scope3Data.products || 0) + (scope3Data.purchased_services || 0) + (scope3Data.marketing_materials || scope3Data.marketing || 0) + (scope3Data.hospitality || 0);
  const cat1HasData = cat1Value > 0;

  const categoryMapping: Record<number, { value: number; dataQuality: 'primary' | 'secondary' | 'estimated' | 'missing' }> = {
    // Cat 1: Purchased Goods & Services (products + purchased services + marketing materials)
    1: { value: cat1Value, dataQuality: cat1HasData ? 'primary' : 'missing' },
    // Cat 2: Capital Goods
    2: { value: scope3Data.capital_goods || 0, dataQuality: scope3Data.capital_goods > 0 ? 'secondary' : 'missing' },
    // Cat 3: Fuel & Energy Related (WTT) - estimated as ~15% of fuel-related emissions
    3: { value: 0, dataQuality: 'missing' },
    // Cat 4: Upstream Transportation (from product LCA transport impacts)
    4: { value: scope3Data.upstream_transport || 0, dataQuality: scope3Data.upstream_transport > 0 ? 'secondary' : 'missing' },
    // Cat 5: Waste Generated in Operations
    5: { value: scope3Data.waste || scope3Data.operational_waste || 0, dataQuality: (scope3Data.waste || scope3Data.operational_waste) > 0 ? 'secondary' : 'missing' },
    // Cat 6: Business Travel
    6: { value: scope3Data.business_travel || 0, dataQuality: scope3Data.business_travel > 0 ? 'primary' : 'missing' },
    // Cat 7: Employee Commuting
    7: { value: scope3Data.employee_commuting || 0, dataQuality: scope3Data.employee_commuting > 0 ? 'secondary' : 'missing' },
    // Cat 8: Upstream Leased Assets - only for actual leased asset emissions (NOT purchased services)
    8: { value: 0, dataQuality: 'missing' },
    // Cat 9: Downstream Transportation (logistics spend + downstream transport)
    9: { value: (scope3Data.logistics || scope3Data.downstream_logistics || 0) + (scope3Data.downstream_transport || 0), dataQuality: (scope3Data.logistics || scope3Data.downstream_logistics || scope3Data.downstream_transport) > 0 ? 'secondary' : 'missing' },
    // Cat 10: Processing of Sold Products - typically not applicable for finished goods
    10: { value: 0, dataQuality: 'missing' },
    // Cat 11: Use of Sold Products (from product LCA use phase)
    11: { value: scope3Data.use_phase || 0, dataQuality: scope3Data.use_phase > 0 ? 'secondary' : 'missing' },
    // Cat 12: End-of-Life Treatment (would need separate calculation from product LCA)
    12: { value: 0, dataQuality: 'missing' },
    // Cat 13-15: Downstream Leased Assets, Franchises, Investments - typically not applicable
    13: { value: 0, dataQuality: 'missing' },
    14: { value: 0, dataQuality: 'missing' },
    15: { value: 0, dataQuality: 'missing' },
  };

  // Generate detailed entries for each category from the breakdown data
  const generateEntriesForCategory = (categoryNum: number): Array<{
    id: string;
    date: string;
    description: string;
    emissions: number;
    unit: string;
    source: string;
    dataQuality: 'primary' | 'secondary' | 'estimated';
    metadata?: Record<string, any>;
  }> => {
    const entries: Array<{
      id: string;
      date: string;
      description: string;
      emissions: number;
      unit: string;
      source: string;
      dataQuality: 'primary' | 'secondary' | 'estimated';
      metadata?: Record<string, any>;
    }> = [];
    const today = new Date().toISOString().split('T')[0];

    switch (categoryNum) {
      case 1: // Purchased Goods & Services
        if (scope3Data.products > 0) {
          entries.push({
            id: 'cat1-products',
            date: today,
            description: 'Product LCA Scope 3 Emissions',
            emissions: scope3Data.products,
            unit: 'kg CO₂e',
            source: 'Product Carbon Footprint Assessments',
            dataQuality: 'primary',
            metadata: { type: 'product_lca' },
          });
        }
        if (scope3Data.purchased_services > 0) {
          entries.push({
            id: 'cat1-services',
            date: today,
            description: 'Purchased Services',
            emissions: scope3Data.purchased_services,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
            metadata: { type: 'purchased_services' },
          });
        }
        if ((scope3Data.marketing_materials || scope3Data.marketing) > 0) {
          entries.push({
            id: 'cat1-marketing',
            date: today,
            description: 'Marketing Materials',
            emissions: scope3Data.marketing_materials || scope3Data.marketing,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
            metadata: { type: 'marketing_materials' },
          });
        }
        if (scope3Data.hospitality > 0) {
          entries.push({
            id: 'cat1-hospitality',
            date: today,
            description: 'Hospitality service (meals, drinks, rooms, waste)',
            emissions: scope3Data.hospitality,
            unit: 'kg CO₂e',
            source: 'Hospitality module',
            dataQuality: 'primary',
            metadata: { type: 'hospitality' },
          });
        }
        break;
      case 2: // Capital Goods
        if (scope3Data.capital_goods > 0) {
          entries.push({
            id: 'cat2-capital',
            date: today,
            description: 'Capital Goods Purchases',
            emissions: scope3Data.capital_goods,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 4: // Upstream Transportation
        if (scope3Data.upstream_transport > 0) {
          entries.push({
            id: 'cat4-upstream',
            date: today,
            description: 'Upstream Transportation',
            emissions: scope3Data.upstream_transport,
            unit: 'kg CO₂e',
            source: 'Product LCA Transport Impacts',
            dataQuality: 'secondary',
          });
        }
        break;
      case 5: // Waste
        if ((scope3Data.waste || scope3Data.operational_waste) > 0) {
          entries.push({
            id: 'cat5-waste',
            date: today,
            description: 'Operational Waste',
            emissions: scope3Data.waste || scope3Data.operational_waste,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 6: // Business Travel
        if (scope3Data.business_travel > 0) {
          entries.push({
            id: 'cat6-travel',
            date: today,
            description: 'Business Travel',
            emissions: scope3Data.business_travel,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads / Fleet Activities',
            dataQuality: 'primary',
          });
        }
        break;
      case 7: // Employee Commuting
        if (scope3Data.employee_commuting > 0) {
          entries.push({
            id: 'cat7-commuting',
            date: today,
            description: 'Employee Commuting',
            emissions: scope3Data.employee_commuting,
            unit: 'kg CO₂e',
            source: 'Corporate Overheads',
            dataQuality: 'secondary',
          });
        }
        break;
      case 9: // Downstream Transportation
        const cat9Total = (scope3Data.logistics || scope3Data.downstream_logistics || 0) + (scope3Data.downstream_transport || 0);
        if (cat9Total > 0) {
          if ((scope3Data.logistics || scope3Data.downstream_logistics) > 0) {
            entries.push({
              id: 'cat9-logistics',
              date: today,
              description: 'Downstream Logistics',
              emissions: scope3Data.logistics || scope3Data.downstream_logistics,
              unit: 'kg CO₂e',
              source: 'Corporate Overheads',
              dataQuality: 'secondary',
            });
          }
          if (scope3Data.downstream_transport > 0) {
            entries.push({
              id: 'cat9-transport',
              date: today,
              description: 'Downstream Transportation (Product LCA)',
              emissions: scope3Data.downstream_transport,
              unit: 'kg CO₂e',
              source: 'Product LCA Distribution Impacts',
              dataQuality: 'secondary',
            });
          }
        }
        break;
      case 11: // Use of Sold Products
        if (scope3Data.use_phase > 0) {
          entries.push({
            id: 'cat11-use',
            date: today,
            description: 'Use Phase Emissions',
            emissions: scope3Data.use_phase,
            unit: 'kg CO₂e',
            source: 'Product LCA Use Phase Impacts',
            dataQuality: 'secondary',
          });
        }
        break;
    }
    return entries;
  };

  const categories: Scope3CategoryData[] = SCOPE3_CATEGORY_DEFINITIONS.map(def => {
    const mapping = categoryMapping[def.category];
    const entries = generateEntriesForCategory(def.category);
    return {
      category: def.category,
      name: def.name,
      description: def.description,
      totalEmissions: mapping.value,
      entryCount: entries.length,
      dataQuality: mapping.dataQuality,
      entries,
    };
  });

  return {
    categories,
    productDetails: [],
    travelDetails: [],
    logisticsDetails: [],
    wasteDetails: [],
    totalScope3: scope3Data.total || 0,
  };
}

/**
 * Build the Strengths and Areas-for-Improvement lists shown on the
 * Performance page.
 *
 * The previous implementation only checked five narrow signals
 * (circularity, water risk, Scope 2 share, LCA count, CSRD readiness),
 * so most orgs landed on the same generic fallback message ("Continue
 * monitoring and improving data quality"). The new approach is to
 * lean on the Vitality composite, which already grades every sub-pillar
 * 0-100 with a clear what-to-do action attached:
 *
 *   - STRENGTHS:    sub-pillars scoring ≥65 (Healthy band or above)
 *   - IMPROVEMENTS: sub-pillars that are null (missing data) or ≤30
 *                   (Needs Attention band). Missing data is shown as
 *                   high priority because there's a fix the user can do
 *                   immediately; very-low scores show as high priority
 *                   too, low-medium scores fall to medium.
 *
 * The function falls back to the old metrics-only logic when the
 * composite isn't loaded yet, so the cards render something useful
 * during the brief loading window. Once composite arrives, the lists
 * stay consistent with what Rosa's read on the same page says.
 */
function generateStrengthsAndImprovements(
  composite: VitalityComposite | null,
  metrics: CompanyMetrics | null,
  scopeBreakdown: ScopeBreakdown | null,
  circularityRate: number,
  waterRiskLevel: string | undefined
) {
  const strengths: Array<{ text: string }> = [];
  const improvements: Array<{ text: string; priority?: 'high' | 'medium' }> = [];

  // Primary source: Vitality composite sub-scores. These are the same
  // numbers the user sees on the Pillar Breakdown cards above, so the
  // Strengths/Improvements never contradict the visual.
  if (composite) {
    const strong = listStrongSubScores(composite);
    for (const item of strong) {
      strengths.push({
        text: `${item.label} at ${Math.round(item.score!)} — healthy band`,
      });
    }

    const missing = listMissingSubScores(composite);
    for (const item of missing) {
      improvements.push({ text: `${item.label}: ${item.action}`, priority: 'high' });
    }

    const weak = listWeakSubScores(composite);
    for (const item of weak) {
      improvements.push({
        text: `${item.label} at ${Math.round(item.score!)} — ${item.action}`,
        priority: (item.score ?? 0) <= 15 ? 'high' : 'medium',
      });
    }
  }

  // Secondary signals from the existing metrics: only add these when
  // they're genuinely informative AND not already covered by a
  // Vitality sub-pillar above. They give the user concrete reporting
  // and assessment context that doesn't fit cleanly into the 0-100
  // sub-pillar model.
  if (metrics?.total_products_assessed && metrics.total_products_assessed >= 5) {
    strengths.push({
      text: `${metrics.total_products_assessed} products fully LCA-assessed`,
    });
  }

  if (metrics?.csrd_compliant_percentage && metrics.csrd_compliant_percentage >= 80) {
    strengths.push({
      text: `${metrics.csrd_compliant_percentage}% CSRD reporting readiness`,
    });
  }

  if (scopeBreakdown) {
    const total = scopeBreakdown.scope1 + scopeBreakdown.scope2 + scopeBreakdown.scope3;
    const scope2Pct = total > 0 ? (scopeBreakdown.scope2 / total) * 100 : 0;
    if (scope2Pct > 30) {
      improvements.push({
        text: 'Scope 2 is over 30% of your footprint — switch to a renewable electricity tariff to cut it fastest',
        priority: 'medium',
      });
    } else if (scope2Pct < 10 && total > 0) {
      strengths.push({ text: 'Low Scope 2 share — efficient grid sourcing' });
    }
  }

  // Cap each list so the cards stay readable. Prioritise high-priority
  // improvements first (missing data and lowest scores).
  improvements.sort((a, b) => {
    const ap = a.priority === 'high' ? 0 : a.priority === 'medium' ? 1 : 2;
    const bp = b.priority === 'high' ? 0 : b.priority === 'medium' ? 1 : 2;
    return ap - bp;
  });

  return {
    strengths: strengths.slice(0, 5),
    improvements: improvements.slice(0, 5),
  };
}

/**
 * Compact row used inside the Methodology & Reporting card. Frames the
 * standards/methods as informational (what the platform applies) rather
 * than as "Compliant" status badges, which used to mislead users into
 * believing they had achieved third-party certifications.
 */
function MethodologyRow({ name, summary }: { name: string; summary: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold text-foreground">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{summary}</div>
      </div>
      <StateChip tone="quiet" className="shrink-0 pt-0.5">
        Method
      </StateChip>
    </div>
  );
}

const AVAILABLE_YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

export default function PerformancePage() {
  const { currentOrganization } = useOrganization();
  const latestDataYear = useLatestDataYear(currentOrganization?.id);
  const { selectedYear, setSelectedYear } = usePersistedYear(AVAILABLE_YEARS, latestDataYear);
  // All hooks now consistently use selectedYear for reporting period
  const hookResult = useCompanyMetrics(selectedYear);
  const { footprint: footprintData, loading: footprintLoading, refetch: refetchFootprint } = useCompanyFootprint(selectedYear);
  const { metrics: wasteMetrics, loading: wasteLoading } = useWasteMetrics(selectedYear);
  const { getBenchmarkForPillar } = useVitalityBenchmarks();
  const {
    companyOverview: waterCompanyOverview,
    facilitySummaries: waterFacilitySummaries,
    waterTimeSeries,
    sourceBreakdown: waterSourceBreakdown,
    loading: waterLoading,
  } = useFacilityWaterData(selectedYear);

  const {
    categories: scope3Categories,
    productDetails: scope3ProductDetails,
    travelDetails: scope3TravelDetails,
    logisticsDetails: scope3LogisticsDetails,
    wasteDetails: scope3WasteDetails,
    totalScope3: scope3Total,
  } = transformFootprintToScope3Categories(footprintData);

  const {
    metrics,
    facilityWaterRisks,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    natureMetrics,
    loading,
    error,
    refetch,
  } = hookResult;

  const scopeBreakdown: ScopeBreakdown | null = footprintData?.breakdown ? {
    scope1: footprintData.breakdown.scope1,
    scope2: footprintData.breakdown.scope2,
    scope3: footprintData.breakdown.scope3.total,
  } : null;

  const [carbonSheetOpen, setCarbonSheetOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);

  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showCompliance, setShowCompliance] = useState(false);

  // The Vitality composite is fetched exactly once for this surface, by the
  // EsgVitalityScoreHero at the top of the page. It hands the loaded composite
  // back up via onComposite so the strengths/improvements panel and the four
  // pillar breakdowns all read from the same object the hero ring shows. No
  // second /api/vitality/composite hit from this page.
  const [vitalityComposite, setVitalityComposite] = useState<VitalityComposite | null>(null);

  // Actual certifications the org holds or is progressing — joined with
  // certification_frameworks so we can show the human-readable name and
  // category. Replaces the previous hardcoded "ISO 14044 / GHG Protocol"
  // chips, which were methodology labels masquerading as compliance.
  type OrgCertRow = {
    id: string;
    status: string | null;
    readiness_score: number | null;
    target_date: string | null;
    certified_date: string | null;
    certification_frameworks: {
      framework_name: string | null;
      framework_code: string | null;
      category: string | null;
    } | null;
  };
  const [orgCertifications, setOrgCertifications] = useState<OrgCertRow[]>([]);
  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('organization_certifications')
        .select(
          'id, status, readiness_score, target_date, certified_date, certification_frameworks(framework_name, framework_code, category)',
        )
        .eq('organization_id', currentOrganization.id);
      if (!cancelled && !error && data) setOrgCertifications(data as unknown as OrgCertRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  // Dedupe certifications by framework family so legacy and current
  // versions of the same certification (e.g. B Corp v2.1 vs the 2026
  // standard) don't both render. Prefer the current version: non-legacy
  // beats legacy, then lexicographically-higher framework_code as a
  // tie-breaker (so bcorp_2026 beats bcorp_21).
  const dedupedCertifications = useMemo(() => {
    const normalize = (name: string) =>
      name
        .replace(/\s*\(Legacy[^)]*\)/i, '')
        .replace(/\s*\(v?\d[^)]*\)/i, '')
        .trim()
        .toLowerCase();
    const byFamily = new Map<string, OrgCertRow>();
    for (const cert of orgCertifications) {
      const name = cert.certification_frameworks?.framework_name ?? cert.id;
      const family = normalize(name);
      const existing = byFamily.get(family);
      if (!existing) {
        byFamily.set(family, cert);
        continue;
      }
      const existingName = existing.certification_frameworks?.framework_name ?? '';
      const currentName = cert.certification_frameworks?.framework_name ?? '';
      const existingIsLegacy = /legacy/i.test(existingName);
      const currentIsLegacy = /legacy/i.test(currentName);
      if (existingIsLegacy && !currentIsLegacy) {
        byFamily.set(family, cert);
      } else if (!existingIsLegacy && currentIsLegacy) {
        // keep existing
      } else {
        const existingCode = existing.certification_frameworks?.framework_code ?? '';
        const currentCode = cert.certification_frameworks?.framework_code ?? '';
        if (currentCode > existingCode) byFamily.set(family, cert);
      }
    }
    return Array.from(byFamily.values());
  }, [orgCertifications]);

  const corporateTotalCO2 = footprintData?.total_emissions || 0;
  const productLcaTotalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;
  const totalCO2 = corporateTotalCO2 > 0 ? corporateTotalCO2 : productLcaTotalCO2;
  const waterConsumption = metrics?.total_impacts.water_consumption || 0;
  const productLcaWaterScarcity = metrics?.total_impacts.water_scarcity_aware || 0;
  const landUse = metrics?.total_impacts.land_use || 0;

  // Use facility water data as primary source for water card header,
  // falling back to product LCA water scarcity data
  const facilityScarcityWeighted = waterCompanyOverview?.total_scarcity_weighted_m3
    || waterCompanyOverview?.scarcity_weighted_consumption_m3
    || 0;
  const waterScarcityImpact = facilityScarcityWeighted > 0
    ? facilityScarcityWeighted
    : productLcaWaterScarcity;
  const circularityRate = wasteMetrics?.waste_diversion_rate || metrics?.circularity_percentage || 0;

  // Fetch product categories for industry benchmark lookup
  const [productCategories, setProductCategories] = useState<(string | null)[]>([]);
  useEffect(() => {
    if (!currentOrganization?.id) return;
    fetchProducts(currentOrganization.id).then(products => {
      setProductCategories(products.map(p => p.product_category ?? null));
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const { benchmark: industryBenchmarkData, dominantCategory } = useMemo(
    () => getBenchmarkForProductType(currentOrganization?.product_type, productCategories),
    [currentOrganization?.product_type, productCategories]
  );

  // Climate + water + circularity + nature scores all come from the single
  // composite the hero shared above (same endpoint /rosa/ uses, so the
  // surfaces always agree). Each breakdown carries intensity / YoY sub-scores
  // + blend weights and (for water) the AWARE scarcity context — fed into the
  // score explainer below for full transparency to the user.
  const climateBreakdown: ClimateScoreBreakdown | null = vitalityComposite?.e.climate_breakdown ?? null;
  const waterBreakdown: WaterScoreBreakdown | null = vitalityComposite?.e.water_breakdown ?? null;
  const circularityBreakdown: CircularityScoreBreakdown | null = vitalityComposite?.e.circularity_breakdown ?? null;
  const natureBreakdown: NatureScoreBreakdown | null = vitalityComposite?.e.nature_breakdown ?? null;

  const vitalityScores = useMemo(() => {
    // Check if we have actual product data (not just zeros)
    const hasProductData = metrics?.total_products_assessed !== undefined &&
                           metrics.total_products_assessed > 0;
    // Check if we have actual waste data
    const hasWasteData = wasteMetrics !== null && wasteMetrics !== undefined;

    // All four environmental sub-scores now come from /api/vitality/composite
    // so /rosa/ and /performance/ agree. We pass nothing to the local
    // calculator (it would otherwise re-derive nature client-side, which is
    // exactly the parity bug the redesign kills).
    const local = calculateVitalityScores({
      hasProductData,
      hasWasteData,
    });
    return {
      ...local,
      climate: climateBreakdown?.score ?? null,
      water: waterBreakdown?.score ?? null,
      circularity: circularityBreakdown?.score ?? null,
      nature: natureBreakdown?.score ?? null,
    };
  }, [metrics, wasteMetrics, climateBreakdown, waterBreakdown, circularityBreakdown, natureBreakdown]);

  const scoreCalculationInputs = useMemo(() => ({
    climate: {
      // Old per-LCA-count fields kept for the explainer's existing layout
      // until the climate explainer UI is refreshed for the breakdown.
      totalEmissions: totalCO2,
      // Blended-climate fields. The ScoreExplainer climate section renders
      // these when present (intensity sub, YoY sub, blend mode + weights).
      climateBreakdown,
      benchmarkSource: {
        name: industryBenchmarkData.sourceName,
        url: industryBenchmarkData.sourceUrl,
        year: industryBenchmarkData.sourceYear,
        category: dominantCategory ?? undefined,
      },
    },
    water: {
      // Legacy fields kept for any caller still on the old explainer path.
      waterRiskLevel: metrics?.water_risk_level as 'high' | 'medium' | 'low' | undefined,
      waterConsumption,
      // Blended-water breakdown. The ScoreExplainer water section renders
      // these when present (intensity sub, YoY sub, blend mode + weights,
      // scarcity context).
      waterBreakdown,
    },
    circularity: {
      // Legacy field kept for unmigrated callers.
      circularityRate,
      // Blended-circularity breakdown — drives the new explainer UI
      // (3 axes + waste-intensity YoY + treatment mix).
      circularityBreakdown,
    },
    nature: {
      // Legacy fields kept for unmigrated callers.
      biodiversityRisk: deriveBiodiversityRisk(natureMetrics),
      landUse,
      // Blended-nature breakdown (4 axes weighted by EU EF 3.1).
      natureBreakdown,
    },
  }), [totalCO2, climateBreakdown, waterBreakdown, circularityBreakdown, natureBreakdown, metrics, waterConsumption, circularityRate, natureMetrics, landUse, industryBenchmarkData, dominantCategory]);

  const { strengths, improvements } = useMemo(() => {
    return generateStrengthsAndImprovements(
      vitalityComposite,
      metrics,
      scopeBreakdown,
      circularityRate,
      metrics?.water_risk_level
    );
  }, [vitalityComposite, metrics, scopeBreakdown, circularityRate]);

  // Percentages here are share-within-materials, not share of the whole
  // corporate footprint. A single raw material against the full Scope 1+2+3
  // total would always be a sliver (~1%), making the card look broken. The
  // useful question is "which materials dominate my material emissions?",
  // so the denominator is the sum of materialBreakdown's climate values.
  const materialBreakdownTotal = (materialBreakdown || []).reduce(
    (sum, m) => sum + (Number.isFinite(m.climate) ? m.climate : 0),
    0,
  );
  const topMaterialHotspots = (materialBreakdown || [])
    .sort((a, b) => b.climate - a.climate)
    .slice(0, 5)
    .map(m => {
      const pct = materialBreakdownTotal > 0 ? (m.climate / materialBreakdownTotal) * 100 : 0;
      return {
        label: m.name,
        value: m.climate,
        percentage: pct,
        severity: pct > 20 ? 'high' : pct > 10 ? 'medium' : 'low' as any,
      };
    });

  const waterSourceItems = useMemo(() => {
    if (!facilityWaterRisks || facilityWaterRisks.length === 0) {
      return [];
    }
    return facilityWaterRisks.map((facility, idx) => ({
      id: facility.facility_id || String(idx),
      source: facility.facility_name || `Facility ${idx + 1}`,
      location: facility.location_country_code || 'Unknown',
      consumption: facility.operational_water_intake_m3 || 0,
      riskFactor: facility.water_scarcity_aware || 0,
      riskLevel: facility.risk_level as 'high' | 'medium' | 'low',
      netImpact: facility.scarcity_weighted_consumption_m3 || 0,
    }));
  }, [facilityWaterRisks]);

  const totalWaterConsumption = waterSourceItems.reduce((sum, item) => sum + item.consumption, 0) || waterConsumption;
  const totalWaterImpact = waterSourceItems.reduce((sum, item) => sum + item.netImpact, 0) || waterScarcityImpact;
  const totalWaste = wasteMetrics?.total_waste_kg || 0;

  const landUseItems = useMemo(() => {
    if (!materialBreakdown || materialBreakdown.length === 0) {
      return [];
    }
    const totalLandFromMaterials = landUse || 1;
    return materialBreakdown.slice(0, 5).map((material, idx) => {
      const proportion = material.climate / (materialBreakdown.reduce((sum, m) => sum + m.climate, 0) || 1);
      return {
        id: String(idx + 1),
        ingredient: material.name,
        origin: material.source || 'Unknown',
        mass: material.quantity,
        landIntensity: landUse > 0 ? (proportion * totalLandFromMaterials) / (material.quantity || 1) : 0,
        totalFootprint: Math.round(proportion * totalLandFromMaterials),
      };
    });
  }, [materialBreakdown, landUse]);

  const totalLandUse = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0) || landUse;

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value < 0.1 && value > 0) return value.toExponential(1);
    return value.toFixed(1);
  };

  const togglePillar = (pillar: string) => {
    setExpandedPillar(expandedPillar === pillar ? null : pillar);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <Skeleton className="h-64 rounded-[6px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-[6px]" />
          <Skeleton className="h-40 rounded-[6px]" />
          <Skeleton className="h-40 rounded-[6px]" />
          <Skeleton className="h-40 rounded-[6px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header>
        <Eyebrow className="mb-3">THE CELLAR · VITALITY</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          The vitality.
        </h1>
      </header>

      {/* ESG composite hero — composes E + S + G with configurable weights.
          Replaces the legacy environmental-only VitalityScoreHero. The
          deep environmental pillar deep-dives still live further down the
          page (Carbon / Water / Circularity / Nature DeepDive sections). */}
      <EsgVitalityScoreHero onComposite={setVitalityComposite} />

      {/* Action bar — a quiet year selector, no emerald border, no icon */}
      <div className="flex items-center gap-4">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="rounded-[6px] border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-room-accent"
        >
          {AVAILABLE_YEARS.map((year) => (
            <option key={year} value={year}>
              {year} Data
            </option>
          ))}
        </select>
        {metrics?.total_products_assessed && metrics.total_products_assessed > 0 ? (
          <span className="text-sm text-muted-foreground">
            Based on {metrics.total_products_assessed} assessed product{metrics.total_products_assessed !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {error && (
        <div className="rounded-[6px] border border-border bg-card p-5">
          <Eyebrow tone="inherit" className="mb-2 text-studio-stale">Could not load metrics</Eyebrow>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && metrics && metrics.total_products_assessed === 0 && (
        <div className="rounded-[6px] border border-border bg-card p-5">
          <Eyebrow className="mb-2">Get started</Eyebrow>
          <p className="text-sm text-muted-foreground">
            Complete product LCAs to see your Company Vitality metrics. The platform
            will automatically aggregate impacts across all products.
          </p>
        </div>
      )}

      <FlagThresholdBanner />

      {/* Four Pillars - Expandable Cards */}
      <PillarGrid>
        <PillarCard
          pillar="climate"
          score={vitalityScores.climate}
          value={totalCO2 > 0 ? formatValue(totalCO2 / 1000) : '--'}
          unit="tCO2eq"
          benchmark={getBenchmarkForPillar('climate')}
          expanded={expandedPillar === 'climate'}
          onToggle={() => togglePillar('climate')}
        >
          <CarbonDeepDive
            scopeBreakdown={scopeBreakdown}
            totalCO2={totalCO2}
            productLcaTotalCO2={productLcaTotalCO2}
            materialBreakdown={materialBreakdown}
            ghgBreakdown={ghgBreakdown}
            lifecycleStageBreakdown={lifecycleStageBreakdown}
            facilityEmissionsBreakdown={facilityEmissionsBreakdown}
            scope3Categories={scope3Categories}
            scope3ProductDetails={scope3ProductDetails}
            scope3TravelDetails={scope3TravelDetails}
            scope3LogisticsDetails={scope3LogisticsDetails}
            scope3WasteDetails={scope3WasteDetails}
            scope3Total={scope3Total}
            year={selectedYear}
            isLoadingScope3={footprintLoading}
          />
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setCarbonSheetOpen(true)}
            className="mt-4 w-full"
          >
            View full analysis
            <ArrowRight className="h-4 w-4" />
          </PillButton>
        </PillarCard>

        <PillarCard
          pillar="water"
          score={vitalityScores.water}
          value={waterScarcityImpact > 0 ? formatValue(waterScarcityImpact) : '--'}
          unit="m3 world eq"
          benchmark={getBenchmarkForPillar('water')}
          expanded={expandedPillar === 'water'}
          onToggle={() => togglePillar('water')}
        >
          <WaterDeepDive
            facilityWaterRisks={facilityWaterRisks}
            facilitySummaries={waterFacilitySummaries}
            companyOverview={waterCompanyOverview}
            sourceBreakdown={waterSourceBreakdown}
            waterTimeSeries={waterTimeSeries}
            loading={loading || waterLoading}
            productLcaWaterConsumption={waterConsumption}
            productLcaWaterScarcity={waterScarcityImpact}
          />
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setWaterSheetOpen(true)}
            className="mt-4 w-full"
          >
            View full analysis
            <ArrowRight className="h-4 w-4" />
          </PillButton>
        </PillarCard>

        <PillarCard
          pillar="circularity"
          score={vitalityScores.circularity}
          value={circularityRate > 0 ? circularityRate.toFixed(0) : '--'}
          unit="%"
          benchmark={getBenchmarkForPillar('circularity')}
          expanded={expandedPillar === 'circularity'}
          onToggle={() => togglePillar('circularity')}
        >
          <WasteDeepDive
            wasteMetrics={wasteMetrics}
            loading={wasteLoading}
          />
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setCircularitySheetOpen(true)}
            className="mt-4 w-full"
          >
            View full analysis
            <ArrowRight className="h-4 w-4" />
          </PillButton>
        </PillarCard>

        <PillarCard
          pillar="nature"
          score={vitalityScores.nature}
          value={landUse > 0 ? formatValue(landUse) : '--'}
          unit="m2a crop eq"
          benchmark={getBenchmarkForPillar('nature')}
          expanded={expandedPillar === 'nature'}
          onToggle={() => togglePillar('nature')}
        >
          <NatureDeepDive natureMetrics={natureMetrics} />
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setNatureSheetOpen(true)}
            className="mt-4 w-full"
          >
            View full analysis
            <ArrowRight className="h-4 w-4" />
          </PillButton>
        </PillarCard>
      </PillarGrid>

      {/* Performance Summary - Strengths & Improvements */}
      <PerformanceSummary
        strengths={strengths}
        improvements={improvements}
      />

      {/* Collapsible: Material Hotspots */}
      <Collapsible open={showHotspots} onOpenChange={setShowHotspots}>
        <div className="rounded-[6px] border border-border bg-card">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-secondary/40">
              <div className="min-w-0">
                <Eyebrow>Impact hotspots</Eyebrow>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Top {topMaterialHotspots.length} materials driving {
                    topMaterialHotspots.reduce((sum, m) => sum + m.percentage, 0).toFixed(0)
                  }% of your material emissions
                </p>
              </div>
              {showHotspots ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border p-5">
              {topMaterialHotspots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No material hotspots identified yet. Complete product LCAs to see your top
                  contributing materials.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {topMaterialHotspots.map((item, idx) => {
                    const tone: 'stale' | 'attention' | 'good' =
                      item.severity === 'high' ? 'stale' : item.severity === 'medium' ? 'attention' : 'good';
                    return (
                      <li key={idx} className="flex items-center gap-4 py-3">
                        <span className="w-6 shrink-0 font-mono text-xs font-bold tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(item.value / 1000).toFixed(2)} tCO2eq
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-lg font-bold tabular-nums text-foreground">
                          {item.percentage.toFixed(0)}
                          <span className="ml-0.5 font-mono text-[10px] font-bold text-muted-foreground">%</span>
                        </span>
                        <StateChip tone={tone} className="shrink-0">{item.severity}</StateChip>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Collapsible: Methodology & Reporting */}
      <Collapsible open={showCompliance} onOpenChange={setShowCompliance}>
        <div className="rounded-[6px] border border-border bg-card">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-secondary/40">
              <div className="min-w-0">
                <Eyebrow>Methodology &amp; reporting</Eyebrow>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {(() => {
                    const total = dedupedCertifications.length;
                    const achieved = dedupedCertifications.filter(c => c.status === 'achieved' || c.status === 'certified').length;
                    const inProgress = dedupedCertifications.filter(c => c.status === 'in_progress').length;
                    if (total === 0) {
                      return `${metrics?.csrd_compliant_percentage || 0}% CSRD-aligned LCAs · No certifications logged`;
                    }
                    return `${achieved} of ${total} certifications achieved · ${inProgress} in progress`;
                  })()}
                </p>
              </div>
              {showCompliance ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-6 border-t border-border p-5">
              {/* Headline figures */}
              <div className="flex flex-wrap gap-x-12 gap-y-4">
                <BigNumber
                  value={metrics?.total_products_assessed || 0}
                  label="Products assessed"
                />
                <span
                  className="cursor-help"
                  title="Reflects LCA-level CSRD alignment only. Full CSRD reporting also requires social disclosures (S1-S4), governance disclosures (G1), value-chain analysis, and a double-materiality assessment."
                >
                  <BigNumber
                    value={`${metrics?.csrd_compliant_percentage || 0}%`}
                    label="CSRD-aligned LCAs"
                  />
                </span>
              </div>

              {/* Methodology used by the platform */}
              <div>
                <Eyebrow tone="dim" className="mb-2">Methodology applied</Eyebrow>
                <p className="mb-1 text-xs text-muted-foreground">
                  Calculations follow these international standards and methods. These are the methodologies alka<strong>tera</strong> uses, not certifications your organisation has achieved.
                </p>
                <div className="divide-y divide-border">
                  <MethodologyRow
                    name="ISO 14044:2006"
                    summary="Life Cycle Assessment principles and requirements"
                  />
                  <MethodologyRow
                    name="GHG Protocol Corporate Standard"
                    summary="Scope 1, 2, and 3 emissions accounting"
                  />
                  <MethodologyRow
                    name="ReCiPe 2016 (H) / EU PEF v3"
                    summary="Impact assessment method (climate, water, land, biodiversity)"
                  />
                  <MethodologyRow
                    name="TNFD LEAP"
                    summary="Nature-related dependency and impact framework"
                  />
                </div>
              </div>

              {/* Org's actual certifications */}
              <div>
                <Eyebrow tone="dim" className="mb-2">Your certifications</Eyebrow>
                {dedupedCertifications.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    No certifications logged yet. Open Compliance, Certifications to add ones you hold or are progressing.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {dedupedCertifications
                      .slice()
                      .sort((a, b) => {
                        const rank = (s: string | null) =>
                          s === 'achieved' || s === 'certified'
                            ? 0
                            : s === 'in_progress'
                              ? 1
                              : 2;
                        return rank(a.status) - rank(b.status);
                      })
                      .map(cert => {
                        const name =
                          cert.certification_frameworks?.framework_name ?? 'Certification';
                        const status = cert.status;
                        const statusLabel =
                          status === 'achieved' || status === 'certified'
                            ? 'Achieved'
                            : status === 'in_progress'
                              ? 'In progress'
                              : status === 'not_started'
                                ? 'Not started'
                                : status === 'expired'
                                  ? 'Expired'
                                  : (status ?? 'Unknown');
                        const statusTone: 'good' | 'hold' | 'stale' | 'quiet' =
                          status === 'achieved' || status === 'certified'
                            ? 'good'
                            : status === 'in_progress'
                              ? 'hold'
                              : status === 'expired'
                                ? 'stale'
                                : 'quiet';
                        const targetSuffix = cert.target_date
                          ? `target ${new Date(cert.target_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                          : cert.certified_date
                            ? `since ${new Date(cert.certified_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                            : '';
                        return (
                          <li
                            key={cert.id}
                            className="flex items-center justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-display text-sm font-semibold text-foreground">{name}</div>
                              {cert.certification_frameworks?.category ? (
                                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {cert.certification_frameworks.category}
                                </div>
                              ) : null}
                            </div>
                            <div className="ml-3 shrink-0 text-right">
                              <StateChip tone={statusTone}>{statusLabel}</StateChip>
                              {targetSuffix ? (
                                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                  {targetSuffix}
                                </div>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>

              <PillButton href="/reports/sustainability" variant="ink" className="w-full">
                Generate sustainability report
                <ArrowRight className="h-4 w-4" />
              </PillButton>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Methodology Note */}
      {!loading && metrics && metrics.total_products_assessed > 0 && (
        <div className="rounded-[6px] border border-border bg-card p-5">
          <Eyebrow tone="dim" className="mb-2">Calculation methodology</Eyebrow>
          <p className="text-sm text-muted-foreground">
            Company Vitality aggregates impacts following GHG Protocol Corporate Standard and ISO 14064-1.
            Scope 1 &amp; 2 from facilities, Scope 3 from product LCAs and corporate emissions data.
            No double-counting between facility and product data.
          </p>
        </div>
      )}

      {/* Modals and Sheets */}
      <CarbonBreakdownSheet
        open={carbonSheetOpen}
        onOpenChange={setCarbonSheetOpen}
        scopeBreakdown={scopeBreakdown}
        totalCO2={totalCO2}
        productLcaTotalCO2={productLcaTotalCO2}
        materialBreakdown={materialBreakdown}
        ghgBreakdown={ghgBreakdown}
        lifecycleStageBreakdown={lifecycleStageBreakdown}
        facilityEmissionsBreakdown={facilityEmissionsBreakdown}
        scope3Categories={scope3Categories}
        scope3ProductDetails={scope3ProductDetails}
        scope3TravelDetails={scope3TravelDetails}
        scope3LogisticsDetails={scope3LogisticsDetails}
        scope3WasteDetails={scope3WasteDetails}
        scope3Total={scope3Total}
        year={selectedYear}
        isLoadingScope3={footprintLoading}
      />

      <WaterImpactSheet
        open={waterSheetOpen}
        onOpenChange={setWaterSheetOpen}
        totalConsumption={totalWaterConsumption}
        totalImpact={totalWaterImpact}
        sourceItems={waterSourceItems}
      />

      <CircularitySheet
        open={circularitySheetOpen}
        onOpenChange={setCircularitySheetOpen}
        metrics={wasteMetrics}
        loading={wasteLoading}
        year={selectedYear}
      />

      <NatureImpactSheet
        open={natureSheetOpen}
        onOpenChange={setNatureSheetOpen}
        totalLandUse={totalLandUse}
        ingredientCount={landUseItems.length}
        landUseItems={landUseItems}
      />
    </div>
  );
}
