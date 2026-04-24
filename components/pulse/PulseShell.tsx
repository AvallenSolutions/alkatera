'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Activity, MessageSquare, PoundSterling, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PulseGrid } from '@/components/pulse/PulseGrid';
import {
  PulseRealtimeProvider,
  usePulseRealtimeContext,
} from '@/lib/pulse/PulseRealtimeContext';
import { MetricDrillProvider } from '@/lib/pulse/MetricDrillContext';
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
import { PeerBenchmarkExpandedSlot } from '@/components/pulse/widgets/peer-benchmark/expanded';
import { CsrdGapsExpandedSlot } from '@/components/pulse/widgets/csrd-gaps/expanded';
import { InsightCardExpandedSlot } from '@/components/pulse/widgets/insight-card/expanded';
import { WhatIfExpandedSlot } from '@/components/pulse/widgets/what-if/expanded';
import { HarvestSeasonsExpandedSlot } from '@/components/pulse/widgets/harvest-seasons/expanded';
import { ProductEnvCostExpandedSlot } from '@/components/pulse/widgets/product-env-cost/expanded';
import { SupplierHotspotsExpandedSlot } from '@/components/pulse/widgets/supplier-hotspots/expanded';
import { LiveActivityExpandedSlot } from '@/components/pulse/widgets/live-activity/expanded';
import { usePulseDrillUrl } from '@/hooks/usePulseDrillUrl';
import { LiveMetricsStrip } from '@/components/pulse/widgets/LiveMetricsStrip';
import { AskRosaWidget } from '@/components/pulse/widgets/AskRosaWidget';
import { useOrganization } from '@/lib/organizationContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

/**
 * Inner shell body. Separated so we can call hooks that need the drill context
 * (URL sync) without moving the provider up a layer.
 */
function PulseShellBody() {
  // Two-way sync between ?drill= query param and drill context.
  usePulseDrillUrl();
  return (
    <>
      <div className="space-y-6 pb-12">
        <PulseHeader />
        <PulseHero />
        {/* Full-width KPI strip sits above the grid -- doesn't fit the card metaphor. */}
        <LiveMetricsStrip />
        <PulseGrid />
        {/* Rosa chat sits below, full width -- also exempt from the grid. */}
        <AskRosaWidget />
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
      <PeerBenchmarkExpandedSlot />
      <CsrdGapsExpandedSlot />
      <InsightCardExpandedSlot />
      <WhatIfExpandedSlot />
      <HarvestSeasonsExpandedSlot />
      <ProductEnvCostExpandedSlot />
      <SupplierHotspotsExpandedSlot />
      <LiveActivityExpandedSlot />
      {/* Full-page overlay. Mounted once at shell level. */}
      <WidgetDrillOverlay />
    </>
  );
}

function PulseHeader() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#ccff00]" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Pulse
          </h1>
          <Badge
            variant="outline"
            className="border-[#ccff00]/40 bg-[#ccff00]/10 text-[10px] font-semibold uppercase tracking-wider text-[#ccff00]"
          >
            Beta
          </Badge>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Your sustainability, live. Drag, resize and customise the widgets to match how
          you work.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionHeartbeat />
        <RefreshPulseButton />
        <Button asChild variant="default" size="sm" className="bg-[#ccff00] text-black hover:bg-[#b8e600]">
          <Link href="/pulse/financial/">
            <PoundSterling className="mr-2 h-4 w-4" />
            Financial view
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/pulse/settings/shadow-prices/">
            <PoundSterling className="mr-2 h-4 w-4" />
            Prices
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/feedback/">
            <MessageSquare className="mr-2 h-4 w-4" />
            Beta feedback
          </Link>
        </Button>
      </div>
    </header>
  );
}

/**
 * Admin-only "Refresh data" button. Fires all four Pulse cron jobs on demand
 * via /api/pulse/admin/refresh. Useful during development (scheduled functions
 * need a deploy) and for impatient owners who want numbers to move right now.
 *
 * Visible only to role 'owner' or 'admin' — the endpoint enforces the same
 * check, this is just UX hiding.
 */
function RefreshPulseButton() {
  const { userRole } = useOrganization();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (userRole !== 'owner' && userRole !== 'admin') return null;

  async function handleClick() {
    setBusy(true);
    try {
      const res = await fetch('/api/pulse/admin/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: 'Pulse refreshed',
          description: 'Snapshots, anomalies, grid carbon and insights all updated.',
        });
        // Nudge the page so widgets re-fetch cleanly.
        setTimeout(() => window.location.reload(), 600);
      } else {
        const failed = Object.entries(data.results ?? {})
          .filter(([, r]: [string, any]) => !r.ok)
          .map(([k]) => k)
          .join(', ');
        toast({
          title: res.ok ? 'Partial refresh' : 'Refresh failed',
          description: failed ? `Failed: ${failed}` : data.error ?? 'Unknown error',
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
      setBusy(false);
    }
  }

  return (
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

function PulseHero() {
  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80">
      <CardContent className="relative p-6 sm:p-8">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-end"
        >
          <div className="h-56 w-56 -translate-y-12 translate-x-24 rounded-full bg-[#ccff00]/10 blur-3xl dark:bg-[#ccff00]/5" />
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/5 px-3 py-1 text-xs uppercase tracking-wider text-[#ccff00]">
              <Sparkles className="h-3 w-3" />
              Living dashboard
            </div>
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              Sustainability isn&apos;t an annual ritual anymore.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pulse streams every emissions entry, supplier update, product change and target
              shift into one living view. Spot anomalies before they become incidents. See
              whether you&apos;re on track for 2030 at today&apos;s pace. Get a Claude-written
              brief every morning explaining what changed and why.
            </p>
          </div>

          {/* Concentric animated rings */}
          <div className="relative mx-auto h-32 w-32 lg:h-40 lg:w-40">
            <div className="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border-2 border-dashed border-[#ccff00]/30" />
            <div className="absolute inset-3 animate-[spin_8s_linear_infinite_reverse] rounded-full border-2 border-[#ccff00]/20" />
            <div className="absolute inset-6 animate-[spin_2.5s_ease-in-out_infinite] rounded-full border-2 border-transparent border-t-[#ccff00] border-r-[#ccff00]/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-[#ccff00] shadow-[0_0_18px_rgba(204,255,0,0.55)]" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
