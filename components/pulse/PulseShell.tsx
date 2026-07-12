'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
// Round 2 (auto-research): lazy-load the react-grid-layout-backed grid so its
// heavy drag/resize bundle leaves /pulse's First Load JS.
const PulseGrid = dynamic(
  () => import('@/components/pulse/PulseGrid').then((m) => m.PulseGrid),
  { ssr: false }
);
import { PulseSections } from '@/components/pulse/PulseSections';
import { PulseStatement } from '@/components/pulse/PulseStatement';
import { InsightLine } from '@/components/pulse/InsightLine';
import { PulseSetupChecklist } from '@/components/pulse/PulseSetupChecklist';
import { DEFAULT_VIEW, type PulseView } from '@/lib/pulse/layout';
import { PulseRealtimeProvider } from '@/lib/pulse/PulseRealtimeContext';
import { MetricDrillProvider, useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
// Round 6 (auto-research): the drill overlay and every widget's ExpandedSlot only
// render content when a widget is drilled into. Statically importing all ~24
// recharts-heavy slots put them in /pulse's First Load JS; lazy-load them so they
// move to post-hydration chunks instead.
const WidgetDrillOverlay = dynamic(() => import('@/components/pulse/WidgetDrillOverlay').then((m) => m.WidgetDrillOverlay), { ssr: false });
const WaterfallSlotMount = dynamic(() => import('@/components/pulse/drill-slots/WaterfallSlot').then((m) => m.WaterfallSlotMount), { ssr: false });
const FinancialFootprintExpandedSlot = dynamic(() => import('@/components/pulse/widgets/financial-footprint/expanded').then((m) => m.FinancialFootprintExpandedSlot), { ssr: false });
const ScenarioSensitivityExpandedSlot = dynamic(() => import('@/components/pulse/widgets/scenario-sensitivity/expanded').then((m) => m.ScenarioSensitivityExpandedSlot), { ssr: false });
const MaccExpandedSlot = dynamic(() => import('@/components/pulse/widgets/macc/expanded').then((m) => m.MaccExpandedSlot), { ssr: false });
const CarbonBudgetsExpandedSlot = dynamic(() => import('@/components/pulse/widgets/carbon-budgets/expanded').then((m) => m.CarbonBudgetsExpandedSlot), { ssr: false });
const RegulatoryExposureExpandedSlot = dynamic(() => import('@/components/pulse/widgets/regulatory-exposure/expanded').then((m) => m.RegulatoryExposureExpandedSlot), { ssr: false });
const TargetTrajectoryExpandedSlot = dynamic(() => import('@/components/pulse/widgets/target-trajectory/expanded').then((m) => m.TargetTrajectoryExpandedSlot), { ssr: false });
const TopCostDriversExpandedSlot = dynamic(() => import('@/components/pulse/widgets/top-cost-drivers/expanded').then((m) => m.TopCostDriversExpandedSlot), { ssr: false });
const FacilityImpactExpandedSlot = dynamic(() => import('@/components/pulse/widgets/facility-impact/expanded').then((m) => m.FacilityImpactExpandedSlot), { ssr: false });
const AlertsInboxExpandedSlot = dynamic(() => import('@/components/pulse/widgets/alerts-inbox/expanded').then((m) => m.AlertsInboxExpandedSlot), { ssr: false });
const GridCarbonExpandedSlot = dynamic(() => import('@/components/pulse/widgets/grid-carbon/expanded').then((m) => m.GridCarbonExpandedSlot), { ssr: false });
const EnergyTimingExpandedSlot = dynamic(() => import('@/components/pulse/widgets/energy-timing/expanded').then((m) => m.EnergyTimingExpandedSlot), { ssr: false });
const PeerBenchmarkExpandedSlot = dynamic(() => import('@/components/pulse/widgets/peer-benchmark/expanded').then((m) => m.PeerBenchmarkExpandedSlot), { ssr: false });
const CsrdGapsExpandedSlot = dynamic(() => import('@/components/pulse/widgets/csrd-gaps/expanded').then((m) => m.CsrdGapsExpandedSlot), { ssr: false });
const InsightCardExpandedSlot = dynamic(() => import('@/components/pulse/widgets/insight-card/expanded').then((m) => m.InsightCardExpandedSlot), { ssr: false });
const WhatIfExpandedSlot = dynamic(() => import('@/components/pulse/widgets/what-if/expanded').then((m) => m.WhatIfExpandedSlot), { ssr: false });
const HarvestSeasonsExpandedSlot = dynamic(() => import('@/components/pulse/widgets/harvest-seasons/expanded').then((m) => m.HarvestSeasonsExpandedSlot), { ssr: false });
const ProductEnvCostExpandedSlot = dynamic(() => import('@/components/pulse/widgets/product-env-cost/expanded').then((m) => m.ProductEnvCostExpandedSlot), { ssr: false });
const SupplierHotspotsExpandedSlot = dynamic(() => import('@/components/pulse/widgets/supplier-hotspots/expanded').then((m) => m.SupplierHotspotsExpandedSlot), { ssr: false });
const LiveActivityExpandedSlot = dynamic(() => import('@/components/pulse/widgets/live-activity/expanded').then((m) => m.LiveActivityExpandedSlot), { ssr: false });
const CostIntensityExpandedSlot = dynamic(() => import('@/components/pulse/widgets/cost-intensity/expanded').then((m) => m.CostIntensityExpandedSlot), { ssr: false });
const IssbDisclosureExpandedSlot = dynamic(() => import('@/components/pulse/widgets/issb-disclosure/expanded').then((m) => m.IssbDisclosureExpandedSlot), { ssr: false });
import { usePulseDrillUrl } from '@/hooks/usePulseDrillUrl';
import { LiveMetricsStrip } from '@/components/pulse/widgets/LiveMetricsStrip';
import { AskRosaWidget } from '@/components/pulse/widgets/AskRosaWidget';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import type { WorkingTone } from '@/components/studio/theme';
import {
  PULSE_REFRESH_JOBS,
  type PulseJobState,
  type PulseRefreshRun,
} from '@/lib/pulse/refresh-jobs';

/**
 * Pulse -- top-level shell.
 *
 * One scrolling paper: a quiet mono margin note (refresh, feedback), the
 * verdict statement with its headline figures, then Performance, Operations
 * and Plan as sections. The Customise grid stays behind one ghost pill at
 * the foot of the paper. Drill slots and the overlay mount once here.
 */
export function PulseShell() {
  return (
    <PulseRealtimeProvider>
      <MetricDrillProvider>
        <PulseShellBody />
      </MetricDrillProvider>
    </PulseRealtimeProvider>
  );
}

const VIEW_STORAGE_KEY = 'pulse:view';

/**
 * View preference, persisted per-browser in localStorage. 'advanced' opens
 * the customisable grid; anything else (including legacy persona values like
 * 'founder' or 'cfo' from the old persona toggle) maps to the sections view.
 */
function usePulseView(): [PulseView, (next: PulseView) => void] {
  const [view, setView] = useState<PulseView>(DEFAULT_VIEW);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      setView(saved === 'advanced' ? 'advanced' : 'tabs');
    } catch {
      // localStorage unavailable -- fall back to the default view.
    }
  }, []);

  const update = useCallback((next: PulseView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures -- the in-memory choice still applies.
    }
  }, []);

  return [view, update];
}

/**
 * Inner shell body. Separated so we can call hooks that need the drill context
 * (URL sync) without moving the provider up a layer.
 */
function PulseShellBody() {
  // Two-way sync between ?drill= query param and drill context.
  usePulseDrillUrl();

  const [view, setView] = usePulseView();

  const { activeTarget, open: drillOpen } = useWidgetDrill();
  const rosaSlice = useMemo(
    () => ({
      id: 'pulse-insights',
      label: 'Pulse main dashboard',
      priority: 6,
      data: {
        activeDrill: drillOpen && activeTarget ? activeTarget : null,
        view,
      },
    }),
    [activeTarget, drillOpen, view],
  );
  useRosaPageContext(rosaSlice);

  return (
    <>
      <div className="space-y-8 pb-12">
        {/* The margins: refresh (admin-only) and feedback as quiet mono notes. */}
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-5">
            <RefreshNote />
            <Link
              href="/settings/feedback/"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
            >
              Feedback
            </Link>
          </div>
          <PulseStatement />
        </div>

        {view === 'advanced' ? (
          <>
            {/* Customise mode: the full draggable grid, as before. */}
            <LiveMetricsStrip />
            <PulseGrid />
            <AskRosaWidget />
          </>
        ) : (
          <>
            <InsightLine />
            <PulseSetupChecklist />
            <PulseSections />
          </>
        )}

        {/* The foot of the paper: the advanced grid behind one ghost pill. */}
        <div className="flex justify-center border-t border-studio-hairline pt-5">
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setView(view === 'advanced' ? 'tabs' : 'advanced')}
          >
            {view === 'advanced' ? 'Back to simple view' : 'Customise'}
          </PillButton>
        </div>
      </div>
      {/* Drill slot mounts -- register their renderers for matching targets. */}
      <WaterfallSlotMount />
      <FinancialFootprintExpandedSlot />
      <ScenarioSensitivityExpandedSlot />
      <MaccExpandedSlot />
      <CarbonBudgetsExpandedSlot />
      <RegulatoryExposureExpandedSlot />
      <TargetTrajectoryExpandedSlot />
      <TopCostDriversExpandedSlot />
      <FacilityImpactExpandedSlot />
      <AlertsInboxExpandedSlot />
      <GridCarbonExpandedSlot />
      <EnergyTimingExpandedSlot />
      <PeerBenchmarkExpandedSlot />
      <CsrdGapsExpandedSlot />
      <InsightCardExpandedSlot />
      <WhatIfExpandedSlot />
      <HarvestSeasonsExpandedSlot />
      <ProductEnvCostExpandedSlot />
      <SupplierHotspotsExpandedSlot />
      <LiveActivityExpandedSlot />
      <CostIntensityExpandedSlot />
      <IssbDisclosureExpandedSlot />
      {/* Full-page overlay. Mounted once at shell level. */}
      <WidgetDrillOverlay />
    </>
  );
}

/**
 * Read a fetch Response as JSON without throwing on HTML error pages. A gateway
 * timeout / proxy error returns `<HTML>…`, which `res.json()` would choke on
 * with "Unexpected token '<'"; this surfaces the real status instead.
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Server returned ${res.status} (${res.statusText || 'non-JSON response'})` };
  }
}

/** "3h ago", "2d ago": the margins speak in relative mono time. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const JOB_STATE: Record<string, { tone: WorkingTone; word: string }> = {
  pending: { tone: 'quiet', word: 'Waiting' },
  running: { tone: 'quiet', word: 'Running' },
  completed: { tone: 'good', word: 'Done' },
  failed: { tone: 'stale', word: 'Failed' },
};

/** Per-job status row inside the progress panel: typographic, no icons. */
function JobRow({ label, state }: { label: string; state?: PulseJobState }) {
  const { tone, word } = JOB_STATE[state?.status ?? 'pending'] ?? JOB_STATE.pending;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-foreground">{label}</span>
      <StateChip tone={tone}>{word}</StateChip>
    </div>
  );
}

/**
 * Admin-only refresh, as a quiet mono note in the margins:
 * "REFRESHED 3H AGO · REFRESH". Kicks off all five Pulse data jobs in the
 * background (via /api/pulse/admin/refresh → Inngest) and polls for live
 * per-job progress. Running them synchronously here used to time out the
 * platform gateway and crash with a JSON-parse error.
 *
 * The "refreshed" time is the latest insight's generated_at: the insights
 * job runs in every refresh (on demand and nightly), so it is an honest
 * proxy for when the data jobs last completed.
 *
 * Visible only to role 'owner' or 'admin': the endpoint enforces the same
 * check, this is just UX hiding.
 */
function RefreshNote() {
  const { userRole, currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { toast } = useToast();
  const [runId, setRunId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, PulseJobState>>({});
  const [starting, setStarting] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const busy = starting || runId !== null;
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // When the data was last refreshed, from the newest generated insight.
  useEffect(() => {
    if (!orgId || !isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dashboard_insights')
        .select('generated_at')
        .eq('organization_id', orgId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setRefreshedAt((data?.generated_at as string) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, isAdmin]);

  // Poll the run's status while one is active; reload when it finishes.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/pulse/admin/refresh/status?runId=${runId}`);
        const data: PulseRefreshRun = await safeJson(res);
        if (cancelled) return;
        if (data?.jobs) setJobs(data.jobs);

        if (data?.status === 'completed' || data?.status === 'failed') {
          setRunId(null);
          if (data.status === 'completed') {
            toast({
              title: 'Pulse refreshed',
              description: 'Snapshots, anomalies, grid carbon and insights all updated.',
            });
            setTimeout(() => window.location.reload(), 800);
          } else {
            const failed = Object.entries(data.jobs ?? {})
              .filter(([, j]) => j.status === 'failed')
              .map(([k]) => k)
              .join(', ');
            toast({
              title: 'Refresh failed',
              description: failed
                ? `Failed: ${failed}`
                : data.error ?? 'One or more jobs failed.',
              variant: 'destructive',
            });
          }
        }
      } catch {
        // Transient network blip: keep polling.
      }
    }

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runId, toast]);

  if (!isAdmin) return null;

  async function handleClick() {
    setStarting(true);
    setJobs({});
    try {
      const res = await fetch('/api/pulse/admin/refresh', { method: 'POST' });
      const data = await safeJson(res);
      if (res.ok && data.runId) {
        setRunId(data.runId);
        toast({
          title: 'Refresh started',
          description: 'Running the data jobs now. This takes a couple of minutes.',
        });
      } else {
        toast({
          title: 'Refresh failed',
          description: data.error ?? 'Could not start the refresh.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Refresh failed',
        description: err?.message ?? 'Network error',
        variant: 'destructive',
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-baseline gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
        {refreshedAt && <span>Refreshed {timeAgo(refreshedAt)} ·</span>}
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          title="Run all Pulse data jobs now"
          className="uppercase transition-colors duration-150 ease-studio hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {runId && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-[6px] border border-studio-hairline bg-studio-cream p-3">
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            Refreshing Pulse data
          </p>
          {PULSE_REFRESH_JOBS.map((job) => (
            <JobRow key={job.key} label={job.label} state={jobs[job.key]} />
          ))}
        </div>
      )}
    </div>
  );
}
