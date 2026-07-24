"use client";

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FlagThresholdBanner } from '@/components/flag/FlagThresholdBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';

import { type CompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useAxisData } from '@/hooks/data/useAxisData';
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
import { PerformanceSummary } from '@/components/vitality/PillarCard';
import { VitalityAxisSections, type AxisFacts } from '@/components/vitality/VitalityAxisSections';
import { VitalityAxisProfile } from '@/components/vitality/VitalityAxisProfile';
// Round 3 (auto-research): these deep-dive / sheet panels render only inside an
// expanded pillar or an opened sheet, so their recharts-heavy bundles shouldn't
// sit in /performance's First Load JS. Lazy-load them.
const CarbonDeepDive = dynamic(() => import('@/components/vitality/CarbonDeepDive').then((m) => m.CarbonDeepDive), { ssr: false });
const WaterDeepDive = dynamic(() => import('@/components/vitality/WaterDeepDive').then((m) => m.WaterDeepDive), { ssr: false });
const WasteDeepDive = dynamic(() => import('@/components/vitality/WasteDeepDive').then((m) => m.WasteDeepDive), { ssr: false });
const NatureDeepDive = dynamic(() => import('@/components/vitality/NatureDeepDive').then((m) => m.NatureDeepDive), { ssr: false });
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import type { ScopeBreakdown } from '@/lib/vitality/scope3-transform';

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

// Scope 3 shaping now lives in lib/vitality/scope3-transform.ts so the axis
// routes share it. See that file's header for why.

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
  // Every figure on this page and on /performance/[axis]/ comes from one
  // assembly, so a row and the axis page behind it cannot disagree.
  const {
    metrics, footprintData, wasteMetrics, natureMetrics,
    scopeBreakdown, materialBreakdown, ghgBreakdown, lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    scope3Categories, scope3ProductDetails, scope3TravelDetails,
    scope3LogisticsDetails, scope3WasteDetails, scope3Total,
    productLcaTotalCO2, totalCO2,
    facilityWaterRisks, waterCompanyOverview, waterFacilitySummaries,
    waterSourceBreakdown, waterTimeSeries, waterConsumption,
    productLcaWaterScarcity, waterScarcityImpact,
    circularityRate, landUse,
    loading, footprintLoading, wasteLoading, waterLoading, error, refetch, refetchFootprint,
  } = useAxisData(selectedYear);


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


  /**
   * Plain-language figures for the axis rows. "673 t CO2e", not "673 TCO2EQ";
   * "18,700 m² a year", not "m2a crop eq". The precise unit belongs on the
   * axis page beside its methodology note, where someone has asked for it.
   *
   * An axis with no honest figure is left out rather than given a dash: the
   * row falls back to "Nothing yet" only when there is genuinely no score.
   */
  const axisFacts: AxisFacts = useMemo(() => {
    const facts: AxisFacts = {};
    const round = (n: number) => Math.round(n).toLocaleString('en-GB');

    if (totalCO2 > 0) facts.climate = `${round(totalCO2 / 1000)} t CO2e`;
    if (waterScarcityImpact > 0) facts.water = `${round(waterScarcityImpact)} m³`;
    if (circularityRate > 0) facts.circularity = `${circularityRate.toFixed(0)}% recycled`;
    // landUse, NOT totalLandUse: the latter is the top-5 materials apportioned
    // (landUseItems slices materialBreakdown to 5), so using it here showed a
    // subtotal as if it were the whole. It read 13,668 against the axis page's
    // 18,683 for the same organisation on the same day.
    if (landUse > 0) facts.nature = `${round(landUse)} m² a year`;

    const achieved = dedupedCertifications.filter(
      (c) => (c.status ?? '').toLowerCase() === 'certified',
    ).length;
    if (dedupedCertifications.length > 0) {
      facts.certifications = `${achieved} of ${dedupedCertifications.length} achieved`;
    }

    return facts;
  }, [totalCO2, waterScarcityImpact, circularityRate, landUse, dedupedCertifications]);

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
        <Eyebrow className="mb-3">THE EVIDENCE · VITALITY</Eyebrow>
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

      {/* The shape of the org in one glance, before the nine readings. */}
      <VitalityAxisProfile composite={vitalityComposite} />

      {/* The nine axes. One list, three sections, every axis at the same
          standing — replaces the hero's boxed pillar breakdown AND the four
          expandable pillar cards that repeated it. Each environmental axis
          links to its own page; the sheets and the in-card expansion are
          gone. */}
      <VitalityAxisSections
        composite={vitalityComposite}
        facts={axisFacts}
        linkedAxes={['climate', 'water', 'circularity', 'nature']}
      />

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

    </div>
  );
}
