'use client';

/**
 * Pulse -- quiet sections down one scrolling paper.
 *
 * Replaces the old internal tab bar. Performance, Operations and Plan each
 * open with a mono eyebrow and a hairline rule, then their widgets render
 * as the existing cream panels in the existing grid. The drill-in overlay
 * (mounted by PulseShell) stays the detail layer. Money has no section:
 * /pulse/financial/ is the one money surface.
 */

import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList } from '@/components/studio/fact-list';
import { PULSE_TABS } from '@/lib/pulse/tabs';
import { PulseWidgetGrid } from '@/components/pulse/PulseWidgetGrid';
import { MetricCard } from '@/components/pulse/widgets/MetricCard';

function Section({
  label,
  blurb,
  children,
}: {
  label: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

export function PulseSections() {
  return (
    <div className="space-y-10">
      <Section label={PULSE_TABS.performance.label} blurb={PULSE_TABS.performance.blurb}>
        <PulseWidgetGrid widgets={PULSE_TABS.performance.widgets} ariaLabel="Performance cards" />
        <FactList
          dense
          items={[
            {
              id: 'targets',
              title: 'Targets and actions',
              hint: 'Set targets, plan the work behind them, and track B Corp evidence.',
              href: '/pulse/targets',
            },
          ]}
        />
      </Section>

      <Section label={PULSE_TABS.operations.label} blurb={PULSE_TABS.operations.blurb}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard metricKey="water_consumption" />
          <MetricCard metricKey="products_assessed" />
          <MetricCard metricKey="lca_completeness_pct" />
        </div>
        <PulseWidgetGrid widgets={PULSE_TABS.operations.widgets} ariaLabel="Operations cards" />
      </Section>

      <Section label={PULSE_TABS.plan.label} blurb={PULSE_TABS.plan.blurb}>
        <PulseWidgetGrid widgets={PULSE_TABS.plan.widgets} ariaLabel="Plan cards" />
        <FactList
          dense
          items={[
            {
              id: 'lever',
              title: 'Turn a lever into a plan',
              hint: 'Pick a cheap carbon-cutting option and create the action behind it.',
              href: '/pulse/targets#actions',
            },
          ]}
        />
      </Section>
    </div>
  );
}
