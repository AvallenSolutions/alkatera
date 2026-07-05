'use client';

/**
 * Pulse -- the default tabbed experience.
 *
 * Progressive disclosure: Overview answers "are we on track?" in one
 * viewport; Performance, Money, Operations and Plan each hold a handful of
 * related cards, one click away. Inactive tabs are unmounted (Radix
 * default), and every card fetches its own data, so first paint only costs
 * the Overview's requests.
 */

import Link from 'next/link';
import { ArrowRight, PoundSterling } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PULSE_TABS, PULSE_TAB_ORDER } from '@/lib/pulse/tabs';
import { PulseWidgetGrid } from '@/components/pulse/PulseWidgetGrid';
import { OverviewStats } from '@/components/pulse/OverviewStats';
import { InsightLine } from '@/components/pulse/InsightLine';
import { PulseSetupChecklist } from '@/components/pulse/PulseSetupChecklist';
import { AskRosaWidget } from '@/components/pulse/widgets/AskRosaWidget';
import { MetricCard } from '@/components/pulse/widgets/MetricCard';
import { useState } from 'react';

function HubLinkCard({ title, sub, href }: { title: string; sub: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full rounded-[6px] border-border bg-card transition-colors hover:border-studio-forest/60">
        <CardContent className="flex h-full items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-studio-forest" />
        </CardContent>
      </Card>
    </Link>
  );
}

export function PulseTabbedView() {
  const [tab, setTab] = useState<string>('overview');

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        {PULSE_TAB_ORDER.map(id => (
          <TabsTrigger key={id} value={id}>
            {PULSE_TABS[id].label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <OverviewStats onOpenMoneyTab={() => setTab('money')} />
        <InsightLine />
        <PulseSetupChecklist />
        <AskRosaWidget collapsed />
      </TabsContent>

      <TabsContent value="performance" className="space-y-4">
        <p className="text-xs text-muted-foreground">{PULSE_TABS.performance.blurb}</p>
        <PulseWidgetGrid widgets={PULSE_TABS.performance.widgets} ariaLabel="Performance cards" />
        <HubLinkCard
          title="Targets and actions"
          sub="Set targets, plan the work behind them, and track B Corp evidence."
          href="/pulse/targets"
        />
      </TabsContent>

      <TabsContent value="money" className="space-y-4">
        <p className="text-xs text-muted-foreground">{PULSE_TABS.money.blurb}</p>
        <PulseWidgetGrid widgets={PULSE_TABS.money.widgets} ariaLabel="Money cards" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/pulse/financial/">
              <PoundSterling className="mr-2 h-4 w-4" />
              Full financial view
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/pulse/settings/shadow-prices/">Shadow prices</Link>
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="operations" className="space-y-4">
        <p className="text-xs text-muted-foreground">{PULSE_TABS.operations.blurb}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard metricKey="water_consumption" />
          <MetricCard metricKey="products_assessed" />
          <MetricCard metricKey="lca_completeness_pct" />
        </div>
        <PulseWidgetGrid widgets={PULSE_TABS.operations.widgets} ariaLabel="Operations cards" />
      </TabsContent>

      <TabsContent value="plan" className="space-y-4">
        <p className="text-xs text-muted-foreground">{PULSE_TABS.plan.blurb}</p>
        <PulseWidgetGrid widgets={PULSE_TABS.plan.widgets} ariaLabel="Plan cards" />
        <HubLinkCard
          title="Turn a lever into a plan"
          sub="Pick a cheap carbon-cutting option and create the action behind it."
          href="/pulse/targets#actions"
        />
      </TabsContent>
    </Tabs>
  );
}
