'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
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
  Recycle,
  History,
} from 'lucide-react';
import { Statement } from '@/components/studio/statement';
import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { obligationStatusTone } from '@/lib/epr/status-tones';
import { assessDataCompleteness } from '@/lib/epr/validation';
import type { EPROrgDefaults } from '@/lib/epr/inheritance';
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
  if (pct >= 80) return 'text-studio-good';
  if (pct >= 50) return 'text-studio-attention';
  return 'text-studio-stale';
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
      <Skeleton className="h-40 w-full rounded-[6px]" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-[6px]" />
        <Skeleton className="h-32 rounded-[6px]" />
        <Skeleton className="h-32 rounded-[6px]" />
        <Skeleton className="h-32 rounded-[6px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[6px]" />
        <Skeleton className="h-64 rounded-[6px]" />
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

  // Tell Rosa about EPR readiness so questions like "what's missing for
  // my submission?" or "how big is the fee?" can be answered with the
  // user's actual numbers in context.
  const rosaSlice = useMemo(() => ({
    id: 'epr-dashboard',
    label: 'EPR dashboard',
    priority: 8,
    data: {
      page: 'epr',
      settings_configured: settingsExist,
      wizard_completed: wizardCompleted,
      obligation_status: (obligationData as any)?.status ?? null,
      completeness_pct: (completeness as any)?.percentage ?? null,
      fee_estimate: (feeData as any)?.total_fee ?? null,
    },
  }), [settingsExist, wizardCompleted, obligationData, completeness, feeData]);
  useRosaPageContext(rosaSlice);

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
        // Data completeness: query product_materials directly
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
        // EPR settings (wizard state, plus the defaults packaging rows inherit)
        fetch(`/api/epr/settings?organizationId=${orgId}`).then(async (r) => {
          if (!r.ok) throw new Error('Failed to fetch settings');
          return r.json() as Promise<{
            settings: ({ wizard_state?: { completed?: boolean } | null } & Partial<EPROrgDefaults>) | null;
          }>;
        }),
      ]);

      // Process wizard state
      let eprDefaults: EPROrgDefaults | null = null;
      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value.settings;
        setWizardCompleted(s?.wizard_state?.completed === true);
        eprDefaults = s
          ? {
              default_packaging_activity: s.default_packaging_activity ?? null,
              default_uk_nation: s.default_uk_nation ?? null,
              default_is_household: s.default_is_household ?? null,
            }
          : null;
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

      // Process completeness. The gap rule lives in lib/epr/validation, which
      // knows that activity, nation and household status inherit from the
      // organisation's EPR settings: an unset row is inheriting, not
      // incomplete. This page used to carry its own copy of the rule, and the
      // two drifted.
      if (completenessResult.status === 'fulfilled') {
        const { data: items } = completenessResult.value;
        if (items && items.length > 0) {
          setCompleteness(
            assessDataCompleteness(
              items.map((item: any) => ({
                id: item.id,
                product_id: (item.products as any)?.id ?? 0,
                product_name: (item.products as any)?.name || 'Unknown Product',
                material_name: item.material_name || 'Unknown Material',
                packaging_category: item.packaging_category || 'unknown',
                net_weight_g: item.net_weight_g,
                epr_packaging_activity: item.epr_packaging_activity,
                epr_packaging_level: item.epr_packaging_level,
                epr_uk_nation: item.epr_uk_nation,
                epr_ram_rating: item.epr_ram_rating,
                epr_is_household: item.epr_is_household,
                epr_is_drinks_container: item.epr_is_drinks_container,
                epr_material_type: item.epr_material_type,
              })),
              eprDefaults
            )
          );
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
        <Panel className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-studio-stale mx-auto mb-3" />
          <p className="text-studio-stale mb-4">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Panel>
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
          <Panel className="p-6 hover:border-room-accent/40 transition-colors cursor-pointer group">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-[6px] border border-studio-hairline bg-secondary flex items-center justify-center flex-shrink-0">
                <Dog className="w-7 h-7 text-room-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-foreground">EPR Setup Wizard</h3>
                  <StateChip className="text-room-accent">New</StateChip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Let Rosa guide you through setting up your EPR data, from organisation details to generating your RPD submission. Takes about 13 minutes.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-studio-dim group-hover:text-room-accent transition-colors flex-shrink-0" />
            </div>
          </Panel>
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
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        <Statement eyebrow="THE WIRING · EPR" headline="EPR compliance." />
        <p className="mt-3 text-sm text-muted-foreground">
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
  const badge = obligationStatusTone(effectiveStatus);

  return (
    <Panel className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Status indicator */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-[6px] border border-studio-hairline bg-secondary flex items-center justify-center">
              {effectiveStatus === 'pending' ? (
                <Settings className="h-8 w-8 text-studio-dim" />
              ) : effectiveStatus === 'below_threshold' ? (
                <CheckCircle2 className="h-8 w-8 text-studio-good" />
              ) : (
                <Shield className="h-8 w-8 text-room-accent" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-foreground">Obligation Status</h2>
                <StateChip tone={badge.tone}>{badge.label}</StateChip>
              </div>
              {isPending ? (
                <p className="text-sm text-muted-foreground max-w-lg">
                  Set up your EPR settings to determine your obligation status. We need your annual
                  turnover and packaging tonnage to classify your producer size.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground max-w-lg">
                  {obligation?.explanation}
                </p>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="md:ml-auto flex-shrink-0">
            {isPending ? (
              <Link href="/epr/settings">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
                  <Settings className="h-4 w-4 mr-2" />
                  Set Up EPR
                </Button>
              </Link>
            ) : (
              <div className="text-right space-y-1">
                {packagingSummary && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Turnover: {formatGBP(packagingSummary.turnover_gbp)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Packaging: {packagingSummary.total_tonnes.toFixed(1)} tonnes
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {packagingSummary.total_packaging_items} packaging items tracked
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </Panel>
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
    <Panel
      className={`p-4 ${
        clickable ? 'hover:border-room-accent/40 transition-colors cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          {label}
        </span>
        <span className={accent ? 'text-room-accent' : 'text-studio-dim'}>{icon}</span>
      </div>
      <p
        className={`text-2xl font-display font-bold tabular-nums ${
          valueColor ?? (accent ? 'text-room-accent' : 'text-foreground')
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      {clickable && (
        <div className="flex items-center gap-1 mt-2 text-xs text-room-accent">
          <span>View details</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </Panel>
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
    <Panel>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-room-accent" />
        Upcoming Deadlines
      </h2>
      <div className="space-y-3">
        {obligation?.size === 'below_threshold' ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No reporting deadlines: your organisation is below EPR thresholds.
          </p>
        ) : relevantDeadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No upcoming deadlines found.
          </p>
        ) : (
          relevantDeadlines.map((deadline) => (
            <DeadlineRow key={deadline.period} deadline={deadline} />
          ))
        )}
      </div>
    </Panel>
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
    <div className="flex items-center justify-between p-3 rounded-[6px] border border-studio-hairline bg-secondary">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {deadline.description}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
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
          <StateChip tone="stale">{Math.abs(days)}d overdue</StateChip>
        ) : isUrgent ? (
          <StateChip tone="attention">{days}d left</StateChip>
        ) : isSoon ? (
          <StateChip tone="quiet">{days}d left</StateChip>
        ) : (
          <StateChip tone="quiet">{days}d</StateChip>
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

  // Assign colours to materials: brick primary, dim secondary
  const materialColors: Record<string, string> = {
    GL: 'bg-room',
    AL: 'bg-room/75',
    PL: 'bg-room/55',
    PC: 'bg-room/35',
    ST: 'bg-studio-dim',
    FC: 'bg-studio-dim/70',
    WD: 'bg-studio-dim/50',
    OT: 'bg-studio-dim/30',
  };

  return (
    <Panel>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-room-accent" />
        Material Breakdown
      </h2>
      <div className="space-y-4">
        {sortedMaterials.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No packaging materials with production data yet. Add products and production logs to see
            your material breakdown.
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-secondary">
              {sortedMaterials.map((m) => {
                const pct = totalWeight > 0 ? (m.weight_kg / totalWeight) * 100 : 0;
                if (pct < 1) return null;
                return (
                  <div
                    key={m.material_code}
                    className={`${materialColors[m.material_code] || 'bg-studio-dim/30'} transition-all`}
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
                          materialColors[m.material_code] || 'bg-studio-dim/30'
                        }`}
                      />
                      <span className="text-sm text-foreground">
                        {m.material_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {(m.weight_kg / 1000).toFixed(1)}t
                      </span>
                      <span className="text-studio-dim tabular-nums w-10 text-right">
                        {weightPct.toFixed(0)}%
                      </span>
                      <span className="text-foreground tabular-nums w-16 text-right">
                        {formatGBP(m.fee_gbp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            <div className="border-t border-studio-hairline pt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground tabular-nums font-medium">
                  {(totalWeight / 1000).toFixed(1)}t
                </span>
                <span className="text-studio-dim tabular-nums w-10 text-right">100%</span>
                <span className="text-room-accent tabular-nums w-16 text-right font-medium">
                  {formatGBP(totalFee)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function DataGapAlerts({ gaps }: { gaps: EPRDataGap[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGaps = expanded ? gaps : gaps.slice(0, 5);

  return (
    <Panel>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-studio-attention" />
        Data Gap Alerts
        <StateChip tone="attention" className="ml-1">
          {gaps.length} item{gaps.length !== 1 ? 's' : ''}
        </StateChip>
      </h2>
      <div className="space-y-2">
        {visibleGaps.map((gap) => (
          <Link
            key={gap.product_material_id}
            href={`/products?highlight=${gap.product_id}`}
            className="block"
          >
            <div className="flex items-center justify-between p-3 rounded-[6px] bg-secondary hover:bg-secondary/70 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {gap.product_name}
                  <span className="text-muted-foreground font-normal ml-2">
                    / {gap.material_name}
                  </span>
                </p>
                <p className="text-xs text-studio-attention mt-0.5">
                  Missing: {gap.missing_fields.join(', ')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-studio-dim group-hover:text-room-accent transition-colors flex-shrink-0 ml-2" />
            </div>
          </Link>
        ))}
        {gaps.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center py-2 text-sm text-room-accent hover:text-room-accent/80 transition-colors"
          >
            {expanded ? 'Show less' : `Show all ${gaps.length} items`}
          </button>
        )}
      </div>
    </Panel>
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
    {
      label: 'PRN Obligations',
      description: 'Track Packaging Recovery Note purchases and fulfilment',
      href: '/epr/prn',
      icon: <Recycle className="h-5 w-5" />,
      primary: false,
    },
    {
      label: 'Audit Trail',
      description: 'Review the immutable log of all EPR compliance activity',
      href: '/epr/audit',
      icon: <History className="h-5 w-5" />,
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
    <Panel>
      <h2 className="text-base font-semibold text-foreground mb-4">
        Quick Actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <div
              className={`p-4 rounded-[6px] border transition-colors group cursor-pointer ${
                action.primary
                  ? 'bg-secondary border-studio-hairline hover:border-room-accent/40'
                  : 'border-studio-hairline hover:bg-secondary'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className={action.primary ? 'text-room-accent' : 'text-studio-dim'}>
                  {action.icon}
                </span>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-studio-dim ml-auto group-hover:text-room-accent transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}
