'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LayoutGrid, MessageSquare, RefreshCw, XCircle } from 'lucide-react';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
// Round 2 (auto-research): lazy-load the react-grid-layout-backed grid so its
// heavy drag/resize bundle leaves /pulse's First Load JS.
const PulseGrid = dynamic(
  () => import('@/components/pulse/PulseGrid').then((m) => m.PulseGrid),
  { ssr: false }
);
import { PulseTabbedView } from '@/components/pulse/PulseTabbedView';
import { PulseVerdictHero } from '@/components/pulse/PulseVerdictHero';
import { DEFAULT_VIEW, type PulseView } from '@/lib/pulse/layout';
import {
  PulseRealtimeProvider,
  usePulseRealtimeContext,
} from '@/lib/pulse/PulseRealtimeContext';
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
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  PULSE_REFRESH_JOBS,
  type PulseJobState,
  type PulseRefreshRun,
} from '@/lib/pulse/refresh-jobs';

/**
 * Pulse — top-level shell.
 *
 * Static at top: header (with live heartbeat) + intro hero.
 * Below the hero: PulseGrid renders a draggable, resizable, role-aware widget
 * layout backed by dashboard_layouts. Edit mode is toggled from PulseEditToolbar.
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
 * 'founder' or 'cfo' from the old persona toggle) maps to the tabbed view.
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
      <div className="space-y-6 pb-12">
        <PulseHeader view={view} onChangeView={setView} />
        <PulseVerdictHero />
        {view === 'advanced' ? (
          <>
            {/* Customise mode: the full draggable grid, as before. */}
            <LiveMetricsStrip />
            <PulseGrid />
            <AskRosaWidget />
          </>
        ) : (
          <PulseTabbedView />
        )}
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

function PulseHeader({
  view,
  onChangeView,
}: {
  view: PulseView;
  onChangeView: (next: PulseView) => void;
}) {
  const subtitle =
    view === 'advanced'
      ? 'Build your own view from every available metric. Drag, pin and customise.'
      : 'Are we on track, what is it costing, and what needs attention.';

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Eyebrow className="mb-3">TODAY · PULSE</Eyebrow>
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          The pulse.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionHeartbeat />
        <RefreshPulseButton />
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => onChangeView(view === 'advanced' ? 'tabs' : 'advanced')}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          {view === 'advanced' ? 'Back to simple view' : 'Customise'}
        </Button>
        <Button asChild variant="ghost" size="icon" title="Send feedback">
          <Link href="/settings/feedback/">
            <MessageSquare className="h-4 w-4" />
            <span className="sr-only">Send feedback</span>
          </Link>
        </Button>
      </div>
    </header>
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

/** Per-job status row inside the progress panel. */
function JobRow({ label, state }: { label: string; state?: PulseJobState }) {
  const status = state?.status ?? 'pending';
  const icon =
    status === 'completed' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-studio-good" />
    ) : status === 'failed' ? (
      <XCircle className="h-3.5 w-3.5 text-studio-stale" />
    ) : status === 'running' ? (
      <div className="flex h-3.5 w-3.5 items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-studio-dim" />
      </div>
    ) : (
      <div className="h-3.5 w-3.5 rounded-full border border-border" />
    );
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {icon}
      <span className={cn(status === 'failed' && 'text-studio-stale')}>{label}</span>
    </div>
  );
}

/**
 * Admin-only "Refresh data" button. Kicks off all five Pulse data jobs in the
 * background (via /api/pulse/admin/refresh → Inngest) and polls for live
 * per-job progress. Running them synchronously here used to time out the
 * platform gateway and crash with a JSON-parse error.
 *
 * Visible only to role 'owner' or 'admin' — the endpoint enforces the same
 * check, this is just UX hiding.
 */
function RefreshPulseButton() {
  const { userRole } = useOrganization();
  const { toast } = useToast();
  const [runId, setRunId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, PulseJobState>>({});
  const [starting, setStarting] = useState(false);

  const busy = starting || runId !== null;

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
        // Transient network blip — keep polling.
      }
    }

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [runId, toast]);

  if (userRole !== 'owner' && userRole !== 'admin') return null;

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
          description: 'Running the data jobs now — this takes a couple of minutes.',
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
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={handleClick}
        disabled={busy}
        title="Run all Pulse data jobs now"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        {busy ? 'Refreshing…' : 'Refresh data'}
      </Button>

      {runId && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-[6px] border border-border bg-card p-3 shadow-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Refreshing Pulse data…</p>
          {PULSE_REFRESH_JOBS.map((job) => (
            <JobRow key={job.key} label={job.label} state={jobs[job.key]} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Quiet dot driven by the real Supabase Realtime connection state.
 *
 * - "live"         → good tone, "Live" label
 * - "reconnecting" → attention tone, "Reconnecting…" label
 * - "connecting"   → dim, "Connecting…" label
 */
function ConnectionHeartbeat() {
  const { status, lastEventAt, events } = usePulseRealtimeContext();

  const dotColour =
    status === 'live'
      ? 'bg-studio-good'
      : status === 'reconnecting'
        ? 'bg-studio-attention'
        : 'bg-studio-dim';
  const tone = status === 'live' ? 'good' : status === 'reconnecting' ? 'attention' : 'quiet';
  const label =
    status === 'live'
      ? 'Live'
      : status === 'reconnecting'
        ? 'Reconnecting…'
        : 'Connecting…';

  const tooltip = lastEventAt
    ? `${events.length} event${events.length === 1 ? '' : 's'} this session · last ${lastEventAt.toLocaleTimeString('en-GB')}`
    : 'Waiting for first event';

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
      title={tooltip}
    >
      <span className={cn('inline-flex h-2 w-2 rounded-full', dotColour)} />
      <StateChip tone={tone}>{label}</StateChip>
    </div>
  );
}
