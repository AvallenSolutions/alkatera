'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  Package,
  PoundSterling,
  BarChart3,
  AlertTriangle,
  Clock,
  ArrowRight,
  Settings,
  FileSpreadsheet,
  Calculator,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Dog,
  Sparkles,
} from 'lucide-react';
import {
  REPORTING_DEADLINES,
  type ReportingDeadline,
} from '@/lib/epr/constants';
import type {
  ObligationResult,
  EPRFeeCalculationResult,
  EPRMaterialFeeBreakdown,
  EPRDataGap,
} from '@/lib/epr/types';

// =============================================================================
// Types
// =============================================================================

interface ObligationAPIResponse {
  obligation: ObligationResult;
  packaging_summary: {
    total_weight_kg: number;
    total_tonnes: number;
    total_packaging_items: number;
    stored_tonnage_estimate: number | null;
    turnover_gbp: number;
  };
}

interface FeeAPIResponse {
  calculation: EPRFeeCalculationResult;
  fee_year: string;
}

interface CompletenessData {
  total_packaging_items: number;
  complete_items: number;
  incomplete_items: number;
  completeness_pct: number;
  gaps: EPRDataGap[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getCompletenessColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getCompletenessBgColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getObligationBadge(size: ObligationResult['size'] | 'pending') {
  switch (size) {
    case 'large':
      return { label: 'Large Producer', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    case 'small':
      return { label: 'Small Producer', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    case 'below_threshold':
      return { label: 'Below Threshold', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    case 'pending':
    default:
      return { label: 'Pending Setup', color: 'bg-white/10 text-white/50 border-white/20' };
  }
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function EPRDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function EPRDashboardPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [loading, setLoading] = useState(true);
  const [obligationData, setObligationData] = useState<ObligationAPIResponse | null>(null);
  const [feeData, setFeeData] = useState<FeeAPIResponse | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessData | null>(null);
  const [settingsExist, setSettingsExist] = useState<boolean>(false);
  const [wizardCompleted, setWizardCompleted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch obligation status, fee estimate, completeness, and settings in parallel
      const [obligationRes, feeRes, completenessResult, settingsRes] = await Promise.allSettled([
        // Obligation status
        fetch(`/api/epr/obligation?organizationId=${orgId}`).then(async (r) => {
          if (!r.ok) throw new Error('Failed to fetch obligation status');
          return r.json() as Promise<ObligationAPIResponse>;
        }),
        // Fee estimate
        fetch('/api/epr/calculate-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, fee_year: '2025-26' }),
        }).then(async (r) => {
          if (!r.ok) throw new Error('Failed to calculate fees');
          return r.json() as Promise<FeeAPIResponse>;
        }),
        // Data completeness — query product_materials directly
        supabase
          .from('product_materials')
          .select(`
            id,
            material_name,
            net_weight_g,
            packaging_category,
            epr_packaging_activity,
            epr_packaging_level,
            epr_uk_nation,
            epr_ram_rating,
            epr_is_household,
            epr_is_drinks_container,
            epr_material_type,
            products!inner (
              id,
              name,
              organization_id
            )
          `)
          .eq('products.organization_id', orgId)
          .not('packaging_category', 'is', null),
        // EPR settings (for wizard state)
        fetch(`/api/epr/settings?organizationId=${orgId}`).then(async (r) => {
          if (!r.ok) throw new Error('Failed to fetch settings');
          return r.json() as Promise<{ settings: { wizard_state?: { completed?: boolean } | null } }>;
        }),
      ]);

      // Process wizard state
      if (settingsRes.status === 'fulfilled') {
        setWizardCompleted(settingsRes.value.settings?.wizard_state?.completed === true);
      }

      // Process obligation
      if (obligationRes.status === 'fulfilled') {
        setObligationData(obligationRes.value);
        setSettingsExist(
          obligationRes.value.packaging_summary.turnover_gbp > 0 ||
          obligationRes.value.packaging_summary.stored_tonnage_estimate !== null
        );
      }

      // Process fee data
      if (feeRes.status === 'fulfilled') {
        setFeeData(feeRes.value);
      }

      // Process completeness
      if (completenessResult.status === 'fulfilled') {
        const { data: items } = completenessResult.value;
        if (items && items.length > 0) {
          const gaps: EPRDataGap[] = [];
          let completeCount = 0;

          for (const item of items) {
            const product = item.products as any;
            const missing: string[] = [];

            if (!item.net_weight_g || item.net_weight_g <= 0) missing.push('Net Weight');
            if (!item.epr_packaging_activity) missing.push('Packaging Activity');
            if (!item.epr_uk_nation) missing.push('UK Nation');

            const isPrimary = ['container', 'label', 'closure'].includes(item.packaging_category || '');
            if (isPrimary && item.epr_is_household == null) missing.push('Household/Non-household');
            if (item.packaging_category === 'container' && item.epr_is_drinks_container == null)
              missing.push('Drinks Container flag');

            if (missing.length === 0) {
              completeCount++;
            } else {
              gaps.push({
                product_id: product?.id ?? 0,
                product_name: product?.name || 'Unknown Product',
                product_material_id: item.id,
                material_name: item.material_name || 'Unknown Material',
                packaging_category: item.packaging_category || 'unknown',
                missing_fields: missing,
              });
            }
          }

          setCompleteness({
            total_packaging_items: items.length,
            complete_items: completeCount,
            incomplete_items: items.length - completeCount,
            completeness_pct: items.length > 0 ? Math.round((completeCount / items.length) * 100) : 100,
            gaps,
          });
        } else {
          setCompleteness({
            total_packaging_items: 0,
            complete_items: 0,
            incomplete_items: 0,
            completeness_pct: 100,
            gaps: [],
          });
        }
      }
    } catch (err) {
      console.error('EPR dashboard fetch error:', err);
      setError('Failed to load EPR data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!orgId || loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <EPRDashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader />
        <Card className="bg-red-950/20 border-red-800">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const obligation = obligationData?.obligation;
  const packagingSummary = obligationData?.packaging_summary;
  const feeCalc = feeData?.calculation;
  const isPending = !settingsExist && (!obligation || obligation.size === 'below_threshold');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader onRefresh={fetchData} />

      {/* EPR Setup Wizard CTA */}
      {!wizardCompleted && (
        <Link href="/epr/wizard">
          <Card className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 border border-emerald-400/20 hover:border-emerald-400/40 transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 backdrop-blur-md flex items-center justify-center border border-emerald-400/30 flex-shrink-0">
                  <Dog className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white">EPR Setup Wizard</h3>
                    <Badge className="bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/30 text-xs border">
                      <Sparkles className="w-3 h-3 mr-1" />
                      NEW
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50">
                    Let Rosa guide you through setting up your EPR data, from organisation details to generating your RPD submission. Takes about 13 minutes.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Obligation Status Card */}
      <ObligationStatusCard
        obligation={obligation ?? null}
        isPending={isPending}
        packagingSummary={packagingSummary ?? null}
      />

      {/* 4-Metric Strip */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Packaging"
          value={
            packagingSummary
              ? `${packagingSummary.total_tonnes.toFixed(1)}t`
              : '--'
          }
          sublabel="Total tonnage placed on market"
          icon={<Package className="h-5 w-5" />}
        />
        <MetricCard
          label="Estimated Annual Fee"
          value={feeCalc ? formatGBP(feeCalc.total_fee_gbp) : '--'}
          sublabel="2025/26 waste management fees"
          icon={<PoundSterling className="h-5 w-5" />}
          accent
        />
        <MetricCard
          label="Data Completeness"
          value={completeness ? `${completeness.completeness_pct}%` : '--'}
          sublabel={
            completeness
              ? `${completeness.complete_items}/${completeness.total_packaging_items} items complete`
              : 'Checking packaging data...'
          }
          icon={<BarChart3 className="h-5 w-5" />}
          valueColor={completeness ? getCompletenessColor(completeness.completeness_pct) : undefined}
        />
        <Link href="/products" className="block">
          <MetricCard
            label="Products Needing EPR Data"
            value={completeness ? `${completeness.incomplete_items}` : '--'}
            sublabel="Click to view products"
            icon={<AlertTriangle className="h-5 w-5" />}
            clickable
          />
        </Link>
      </div>

      {/* Two-column layout: Deadlines + Material Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DeadlineTimeline
          obligation={obligation ?? null}
        />
        <MaterialBreakdown
          materials={feeCalc?.by_material ?? []}
          totalWeight={feeCalc?.total_weight_kg ?? 0}
          totalFee={feeCalc?.total_fee_gbp ?? 0}
        />
      </div>

      {/* Data Gap Alerts */}
      {completeness && completeness.gaps.length > 0 && (
        <DataGapAlerts gaps={completeness.gaps} />
      )}

      {/* Quick Actions */}
      <QuickActions wizardCompleted={wizardCompleted} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function PageHeader({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-7 w-7 text-[#ccff00]" />
          EPR Compliance
        </h1>
        <p className="text-sm text-white/50">
          Manage your UK Extended Producer Responsibility obligations, packaging data submissions, and fee estimates.
        </p>
      </div>
      {onRefresh && (
        <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh EPR data">
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ObligationStatusCard({
  obligation,
  isPending,
  packagingSummary,
}: {
  obligation: ObligationResult | null;
  isPending: boolean;
  packagingSummary: ObligationAPIResponse['packaging_summary'] | null;
}) {
  const effectiveStatus = isPending ? 'pending' : (obligation?.size ?? 'pending');
  const badge = getObligationBadge(effectiveStatus);

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Status indicator */}
          <div className="flex items-center gap-4">
            <div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
                effectiveStatus === 'large'
                  ? 'bg-red-500/20'
                  : effectiveStatus === 'small'
                  ? 'bg-amber-500/20'
                  : effectiveStatus === 'below_threshold'
                  ? 'bg-emerald-500/20'
                  : 'bg-white/10'
              }`}
            >
              {effectiveStatus === 'pending' ? (
                <Settings className="h-8 w-8 text-white/40" />
              ) : effectiveStatus === 'below_threshold' ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              ) : (
                <Shield className="h-8 w-8 text-[#ccff00]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-white">Obligation Status</h2>
                <Badge className={`text-xs border ${badge.color}`}>
                  {badge.label}
                </Badge>
              </div>
              {isPending ? (
                <p className="text-sm text-white/50 max-w-lg">
                  Set up your EPR settings to determine your obligation status. We need your annual
                  turnover and packaging tonnage to classify your producer size.
                </p>
              ) : (
                <p className="text-sm text-white/50 max-w-lg">
                  {obligation?.explanation}
                </p>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="md:ml-auto flex-shrink-0">
            {isPending ? (
              <Link href="/epr/settings">
                <Button className="bg-[#ccff00] text-black hover:bg-[#b8e600] font-medium">
                  <Settings className="h-4 w-4 mr-2" />
                  Set Up EPR
                </Button>
              </Link>
            ) : (
              <div className="text-right space-y-1">
                {packagingSummary && (
                  <>
                    <p className="text-xs text-white/40">
                      Turnover: {formatGBP(packagingSummary.turnover_gbp)}
                    </p>
                    <p className="text-xs text-white/40">
                      Packaging: {packagingSummary.total_tonnes.toFixed(1)} tonnes
                    </p>
                    <p className="text-xs text-white/40">
                      {packagingSummary.total_packaging_items} packaging items tracked
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  accent,
  valueColor,
  clickable,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: boolean;
  valueColor?: string;
  clickable?: boolean;
}) {
  return (
    <Card
      className={`bg-white/5 backdrop-blur-md border border-white/10 ${
        clickable ? 'hover:border-[#ccff00]/30 transition-colors cursor-pointer' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {label}
          </span>
          <span className={accent ? 'text-[#ccff00]' : 'text-white/30'}>{icon}</span>
        </div>
        <p
          className={`text-2xl font-bold ${
            valueColor ?? (accent ? 'text-[#ccff00]' : 'text-white')
          }`}
        >
          {value}
        </p>
        <p className="text-xs text-white/40 mt-1">{sublabel}</p>
        {clickable && (
          <div className="flex items-center gap-1 mt-2 text-xs text-[#ccff00]/70">
            <span>View details</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeadlineTimeline({ obligation }: { obligation: ObligationResult | null }) {
  const now = new Date();

  // Filter deadlines relevant to the organisation's obligation size
  const relevantDeadlines = REPORTING_DEADLINES.filter((d) => {
    if (!obligation) return true; // Show all if unknown
    if (obligation.size === 'below_threshold') return false;
    return d.who === 'both' || d.who === obligation.size;
  })
    .filter((d) => {
      // Only show future deadlines or deadlines within the last 30 days
      const days = daysUntil(d.due_date);
      return days >= -30;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#ccff00]" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {obligation?.size === 'below_threshold' ? (
          <p className="text-sm text-white/50 py-4 text-center">
            No reporting deadlines — your organisation is below EPR thresholds.
          </p>
        ) : relevantDeadlines.length === 0 ? (
          <p className="text-sm text-white/50 py-4 text-center">
            No upcoming deadlines found.
          </p>
        ) : (
          relevantDeadlines.map((deadline) => (
            <DeadlineRow key={deadline.period} deadline={deadline} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DeadlineRow({ deadline }: { deadline: ReportingDeadline }) {
  const days = daysUntil(deadline.due_date);
  const isPast = days < 0;
  const isUrgent = days >= 0 && days <= 30;
  const isSoon = days > 30 && days <= 90;

  const dueDate = new Date(deadline.due_date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        isPast
          ? 'bg-red-500/10 border border-red-500/20'
          : isUrgent
          ? 'bg-amber-500/10 border border-amber-500/20'
          : 'bg-white/5 border border-white/5'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {deadline.description}
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          Due: {dueDate}
          {deadline.who !== 'both' && (
            <span className="ml-2">
              ({deadline.who === 'large' ? 'Large producers' : 'Small producers'})
            </span>
          )}
        </p>
      </div>
      <div className="flex-shrink-0 ml-3">
        {isPast ? (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs border">
            {Math.abs(days)}d overdue
          </Badge>
        ) : isUrgent ? (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs border">
            {days}d left
          </Badge>
        ) : isSoon ? (
          <Badge className="bg-white/10 text-white/70 border-white/20 text-xs border">
            {days}d left
          </Badge>
        ) : (
          <Badge className="bg-white/5 text-white/40 border-white/10 text-xs border">
            {days}d
          </Badge>
        )}
      </div>
    </div>
  );
}

function MaterialBreakdown({
  materials,
  totalWeight,
  totalFee,
}: {
  materials: EPRMaterialFeeBreakdown[];
  totalWeight: number;
  totalFee: number;
}) {
  const sortedMaterials = [...materials].sort((a, b) => b.weight_kg - a.weight_kg);

  // Assign colors to materials
  const materialColors: Record<string, string> = {
    GL: 'bg-emerald-500',
    AL: 'bg-sky-500',
    PL: 'bg-violet-500',
    PC: 'bg-amber-500',
    ST: 'bg-slate-400',
    FC: 'bg-orange-500',
    WD: 'bg-lime-600',
    OT: 'bg-white/20',
  };

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#ccff00]" />
          Material Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedMaterials.length === 0 ? (
          <p className="text-sm text-white/50 py-4 text-center">
            No packaging materials with production data yet. Add products and production logs to see
            your material breakdown.
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-white/5">
              {sortedMaterials.map((m) => {
                const pct = totalWeight > 0 ? (m.weight_kg / totalWeight) * 100 : 0;
                if (pct < 1) return null;
                return (
                  <div
                    key={m.material_code}
                    className={`${materialColors[m.material_code] || 'bg-white/20'} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${m.material_name}: ${(m.weight_kg / 1000).toFixed(1)}t (${pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>

            {/* Material list */}
            <div className="space-y-2">
              {sortedMaterials.map((m) => {
                const weightPct = totalWeight > 0 ? (m.weight_kg / totalWeight) * 100 : 0;
                return (
                  <div
                    key={m.material_code}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          materialColors[m.material_code] || 'bg-white/20'
                        }`}
                      />
                      <span className="text-sm text-white/80">
                        {m.material_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-white/50 tabular-nums">
                        {(m.weight_kg / 1000).toFixed(1)}t
                      </span>
                      <span className="text-white/30 tabular-nums w-10 text-right">
                        {weightPct.toFixed(0)}%
                      </span>
                      <span className="text-[#ccff00]/80 tabular-nums w-16 text-right">
                        {formatGBP(m.fee_gbp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Total</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-white tabular-nums font-medium">
                  {(totalWeight / 1000).toFixed(1)}t
                </span>
                <span className="text-white/30 tabular-nums w-10 text-right">100%</span>
                <span className="text-[#ccff00] tabular-nums w-16 text-right font-medium">
                  {formatGBP(totalFee)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DataGapAlerts({ gaps }: { gaps: EPRDataGap[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGaps = expanded ? gaps : gaps.slice(0, 5);

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Data Gap Alerts
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs border ml-1">
            {gaps.length} item{gaps.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleGaps.map((gap) => (
          <Link
            key={gap.product_material_id}
            href={`/products?highlight=${gap.product_id}`}
            className="block"
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {gap.product_name}
                  <span className="text-white/40 font-normal ml-2">
                    / {gap.material_name}
                  </span>
                </p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  Missing: {gap.missing_fields.join(', ')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-[#ccff00] transition-colors flex-shrink-0 ml-2" />
            </div>
          </Link>
        ))}
        {gaps.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center py-2 text-sm text-[#ccff00]/70 hover:text-[#ccff00] transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${gaps.length} items`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions({ wizardCompleted }: { wizardCompleted: boolean }) {
  const actions = [
    {
      label: 'Generate Submission',
      description: 'Create an RPD-format CSV file for the Defra portal',
      href: '/epr/submissions',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      primary: true,
    },
    {
      label: 'Estimate Costs',
      description: 'View detailed fee breakdown by product and material',
      href: '/epr/costs',
      icon: <Calculator className="h-5 w-5" />,
      primary: false,
    },
    {
      label: 'EPR Settings',
      description: 'Configure turnover, nation splits, and organisation details',
      href: '/epr/settings',
      icon: <Settings className="h-5 w-5" />,
      primary: false,
    },
  ];

  if (wizardCompleted) {
    actions.push({
      label: 'Re-run Setup Wizard',
      description: 'Walk through EPR data setup again with Rosa as your guide',
      href: '/epr/wizard',
      icon: <Sparkles className="h-5 w-5" />,
      primary: false,
    });
  }

  return (
    <Card className="bg-white/5 backdrop-blur-md border border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-white">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div
                className={`p-4 rounded-xl border transition-all group cursor-pointer ${
                  action.primary
                    ? 'bg-[#ccff00]/10 border-[#ccff00]/20 hover:bg-[#ccff00]/15 hover:border-[#ccff00]/40'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className={action.primary ? 'text-[#ccff00]' : 'text-white/50'}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium text-white">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-white/20 ml-auto group-hover:text-[#ccff00] transition-colors" />
                </div>
                <p className="text-xs text-white/40">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
