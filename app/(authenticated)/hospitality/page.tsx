'use client';

/**
 * The hospitality landing (/hospitality/): studio grammar.
 *
 * One statement, the vitality hero as a quiet panel beneath it, the
 * footprint-inclusion setting as a hairline row, and every sub-surface
 * (venues, meals, drinks, menus, rooms, sales, waste) as a quiet fact
 * row with a live count where the dashboard already knows one.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';
import { HospitalitySetup } from '@/components/hospitality/HospitalitySetup';
import {
  HospitalityOverview,
  type HospitalityCounts,
} from '@/components/hospitality/dashboard/HospitalityOverview';
import { HospitalityFootprintToggle } from '@/components/hospitality/HospitalityFootprintToggle';
import { HospitalityBandThresholds } from '@/components/hospitality/HospitalityBandThresholds';
import { ComplianceExports } from '@/components/hospitality/ComplianceExports';
import { useHospitalitySettings } from '@/hooks/data/useHospitalitySettings';
import { hospitalitySectionFromHref, isHospitalitySectionEnabled } from '@/lib/hospitality/settings';

const SECTIONS = [
  { href: '/hospitality/venues/', title: 'The venues', hint: 'Restaurants, bars and accommodation; each venue anchors its own impact reporting', countKey: 'venues', unit: ['VENUE', 'VENUES'] },
  { href: '/hospitality/meals/', title: 'The meals', hint: 'Recipes built from ingredients, with carbon, water and land impact per cover', countKey: 'meals', unit: ['RECIPE', 'RECIPES'] },
  { href: '/hospitality/drinks/', title: 'The drinks', hint: 'Cocktails and coffees as recipes; impact per serve from the same engine', countKey: 'drinks', unit: ['RECIPE', 'RECIPES'] },
  { href: '/hospitality/menus/', title: 'The menus', hint: 'Meals and drinks together, your own wines pulled live from their LCA, averaged per cover', countKey: 'menus', unit: ['MENU', 'MENUS'] },
  { href: '/hospitality/rooms/', title: 'The rooms', hint: 'Per-room-night impact: purchased consumables plus allocated energy and water', countKey: 'rooms', unit: ['ROOM', 'ROOMS'] },
  { href: '/hospitality/sales/', title: 'The sales', hint: 'Covers, drinks and room nights served; this drives your company total', countKey: null, unit: null },
  { href: '/hospitality/waste/', title: 'The waste', hint: 'Food and dry waste with how it is treated; tracked separately and added to your footprint', countKey: null, unit: null },
  { href: '/hospitality/events/', title: 'The events', hint: 'Weddings, festivals and functions: attendee travel, temporary power and catering in one per-event footprint', countKey: null, unit: null },
  { href: '/hospitality/marketplace/', title: 'The marketplace', hint: 'Find producers whose verified drinks LCAs you can pull into your menus, and list your own org for venues to find', countKey: null, unit: null },
  { href: '/hospitality/integrations/', title: 'The integrations', hint: 'Connect your POS, property, procurement and waste systems to pull data automatically', countKey: null, unit: null },
] as const;

export default function HospitalityDashboard() {
  const router = useRouter();
  const { settings, isLoading, refresh } = useHospitalitySettings();
  const [editing, setEditing] = useState(false);
  const [counts, setCounts] = useState<HospitalityCounts | null>(null);

  const header = (
    <Statement eyebrow="THE WORKBENCH · HOSPITALITY · BETA" headline="The hospitality.">
      {settings?.configured && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Customise
        </button>
      )}
    </Statement>
  );

  if (isLoading || !settings) {
    return (
      <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-6">
        {header}
        <Skeleton className="h-40 w-full rounded-[6px]" />
      </div>
    );
  }

  // First open (or "Customise") → show the function chooser.
  if (!settings.configured || editing) {
    return (
      <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-6">
        {header}
        <div className="max-w-2xl">
          <HospitalitySetup
            initial={settings}
            onSaved={() => {
              setEditing(false);
              refresh();
              router.refresh();
            }}
            onCancel={settings.configured ? () => setEditing(false) : undefined}
          />
        </div>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter((s) => {
    const section = hospitalitySectionFromHref(s.href);
    return section ? isHospitalitySectionEnabled(section, settings) : true;
  });

  const rows: FactRowItem[] = visibleSections.map((s) => {
    const n = s.countKey && counts ? counts[s.countKey] : undefined;
    return {
      id: s.href,
      title: s.title,
      hint: s.hint,
      value: n === undefined ? undefined : String(n),
      unit: n === undefined || !s.unit ? undefined : n === 1 ? s.unit[0] : s.unit[1],
      href: s.href,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-6">
      {header}

      <HospitalityOverview onCounts={setCounts} />

      <div className="grid gap-3 lg:grid-cols-2">
        <HospitalityFootprintToggle />
        <HospitalityBandThresholds />
      </div>

      <ComplianceExports />

      <section>
        <Eyebrow className="mb-3">Manage</Eyebrow>
        <FactList items={rows} />
      </section>
    </div>
  );
}
