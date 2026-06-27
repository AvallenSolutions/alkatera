'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Loader2,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';
import { Button } from '@/components/ui/button';
import { PulseGrid } from '@/components/pulse/PulseGrid';
import { PulseTabbedView } from '@/components/pulse/PulseTabbedView';
import { PulseVerdictHero } from '@/components/pulse/PulseVerdictHero';
import { DEFAULT_VIEW, type PulseView } from '@/lib/pulse/layout';
import {
  PulseRealtimeProvider,
  usePulseRealtimeContext,
} from '@/lib/pulse/PulseRealtimeContext';
import { MetricDrillProvider, useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { WidgetDrillOverlay } from '@/components/pulse/WidgetDrillOverlay';
import { WaterfallSlotMount } from '@/components/pulse/drill-slots/WaterfallSlot';
import { FinancialFootprintExpandedSlot } from '@/components/pulse/widgets/financial-footprint/expanded';
import { ScenarioSensitivityExpandedSlot } from '@/components/pulse/widgets/scenario-sensitivity/expanded';
import { MaccExpandedSlot } from '@/components/pulse/widgets/macc/expanded';
import { CarbonBudgetsExpandedSlot } from '@/components/pulse/widgets/carbon-budgets/expanded';
import { RegulatoryExposureExpandedSlot } from '@/components/pulse/widgets/regulatory-exposure/expanded';
import { TargetTrajectoryExpandedSlot } from '@/components/pulse/widgets/target-trajectory/expanded';
import { TopCostDriversExpandedSlot } from '@/components/pulse/widgets/top-cost-drivers/expanded';
import { FacilityImpactExpandedSlot } from '@/components/pulse/widgets/facility-impact/expanded';
import { AlertsInboxExpandedSlot } from '@/components/pulse/widgets/alerts-inbox/expanded';
import { GridCarbonExpandedSlot } from '@/components/pulse/widgets/grid-carbon/expanded';
import { EnergyTimingExpandedSlot } from '@/components/pulse/widgets/energy-timing/expanded';
import { PeerBenchmarkExpandedSlot } from '@/components/pulse/widgets/peer-benchmark/expanded';
import { CsrdGapsExpandedSlot } from '@/components/pulse/widgets/csrd-gaps/expanded';
import { InsightCardExpandedSlot } from '@/components/pulse/widgets/insight-card/expanded';
import { WhatIfExpandedSlot } from '@/components/pulse/widgets/what-if/expanded';
import { HarvestSeasonsExpandedSlot } from '@/components/pulse/widgets/harvest-seasons/expanded';
import { ProductEnvCostExpandedSlot } from '@/components/pulse/widgets/product-env-cost/expanded';
import { SupplierHotspotsExpandedSlot } from '@/components/pulse/widgets/supplier-hotspots/expanded';
import { LiveActivityExpandedSlot } from '@/components/pulse/widgets/live-activity/expanded';
// Financial-only drill slots -- surfaced by the CFO persona view.
import { CostIntensityExpandedSlot } from '@/components/pulse/widgets/cost-intensity/expanded';
import { IssbDisclosureExpandedSlot } from '@/components/pulse/widgets/issb-disclosure/expanded';
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
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#ccff00]" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Pulse
          </h1>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionHeartbeat />
        <RefreshPulseButton />
        <Button
          variant="ghost"
          size="sm"
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
      <CheckCircle2 className="h-3.5 w-3.5 text-[#ccff00]" />
    ) : status === 'failed' ? (
      <XCircle className="h-3.5 w-3.5 text-red-500" />
    ) : status === 'running' ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    ) : (
      <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
    );
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {icon}
      <span className={cn(status === 'failed' && 'text-red-500')}>{label}</span>
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
        onClick={handleClick}
        disabled={busy}
        title="Run all Pulse data jobs now"
      >
        <RefreshCw className={cn('mr-2 h-4 w-4', busy && 'animate-spin')} />
        {busy ? 'Refreshing…' : 'Refresh data'}
      </Button>

      {runId && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-popover p-3 shadow-md">
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
 * Animated dot driven by the real Supabase Realtime connection state.
 *
 * - "live"        → green pulsing dot, "Live" label
 * - "reconnecting" → amber dot, "Reconnecting…" label
 * - "connecting"  → muted dot, "Connecting…" label
 */
function ConnectionHeartbeat() {
  const { status, lastEventAt, events } = usePulseRealtimeContext();

  const dotColour =
    status === 'live'
      ? 'bg-[#ccff00]'
      : status === 'reconnecting'
        ? 'bg-amber-500'
        : 'bg-slate-500';
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
      className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground"
      title={tooltip}
    >
      <span className="relative flex h-2 w-2">
        {status === 'live' && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              dotColour,
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotColour)} />
      </span>
      <span className="font-data uppercase tracking-wider">{label}</span>
    </div>
  );
}
