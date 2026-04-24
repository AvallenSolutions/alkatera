'use client';

/**
 * Pulse U5 -- What-if playground, expanded view.
 *
 * Two sections:
 *   1. Existing interactive WhatIfWidget (sliders + blended headline)
 *   2. Tornado sensitivity chart: each lever's individual contribution to
 *      total tCO₂e saved, with the £ saving and capex on the same row.
 *
 * The tornado is computed client-side from the same baseline endpoint the
 * slider widget uses -- no extra round trip.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Waves } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { ABATEMENT_LEVERS } from '@/lib/pulse/abatement-costs';
import { WhatIfWidget } from '@/components/pulse/widgets/WhatIfWidget';
import { cn } from '@/lib/utils';

export function WhatIfExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <WhatIfExpanded />, []);
  useRegisterDrillSlot({
    id: 'what-if-expanded',
    title: 'Lever sliders + sensitivity',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'what-if',
    render: renderer,
  });
  return null;
}

function WhatIfExpanded() {
  return (
    <div className="space-y-8">
      <WhatIfWidget />
      <TornadoChart />
    </div>
  );
}

interface Baseline {
  total_t_co2e: number;
  by_category_t_co2e: Record<string, number>;
}

function TornadoChart() {
  const { currentOrganization } = useOrganization();
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [shadowPrice, setShadowPrice] = useState(85);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [bRes, spRes] = await Promise.all([
          fetch(`/api/pulse/whatif-baseline?organization_id=${currentOrganization.id}`),
          fetch(`/api/pulse/shadow-prices?organization_id=${currentOrganization.id}`),
        ]);
        const bJson = await bRes.json();
        if (!cancelled && bRes.ok) setBaseline(bJson as Baseline);
        if (spRes.ok) {
          const spJson = await spRes.json();
          const carbon = spJson?.resolved?.total_co2e;
          if (carbon?.price_per_unit && !cancelled) setShadowPrice(Number(carbon.price_per_unit));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  /**
   * For each lever, compute the tCO2e it would abate IF IT WERE THE ONLY
   * LEVER IN USE at 100% adoption. Ignoring cross-lever interactions lets
   * the user see the pure individual potential of each intervention.
   */
  const rows = useMemo(() => {
    if (!baseline) return [];
    return ABATEMENT_LEVERS.map(lever => {
      const affected = lever.categories.reduce(
        (s, c) => s + (baseline.by_category_t_co2e[c] ?? 0),
        0,
      );
      const savingT = affected * lever.maxReductionFactor;
      const annualUtilityGbp =
        savingT * lever.avgUtilityCostGbpPerTonne * lever.utilityBillSavingFactor;
      const savingGbp = savingT * shadowPrice + annualUtilityGbp;
      const capex =
        lever.capexBasis === 'per_facility'
          ? lever.capexGbp // conservative: single facility
          : lever.capexBasis === 'per_tonne_abated_per_year'
            ? lever.capexGbp * savingT
            : 0;
      return {
        id: lever.id,
        label: lever.label,
        savingT,
        savingGbp,
        capex,
      };
    }).sort((a, b) => b.savingT - a.savingT);
  }, [baseline, shadowPrice]);

  const max = rows.length ? Math.max(...rows.map(r => r.savingT), 1) : 1;

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!baseline || rows.every(r => r.savingT === 0)) {
    return (
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Waves className="h-4 w-4 text-[#ccff00]" />
          Individual lever sensitivity
        </h3>
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          Populates once your facility-activity data captures the relevant
          categories (electricity, gas, fuel, waste).
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Waves className="h-4 w-4 text-[#ccff00]" />
        Individual lever sensitivity
      </h3>
      <p className="text-xs text-muted-foreground">
        How much each lever could deliver on its own at 100% adoption.
        Ignores cross-lever interactions so you can spot the biggest
        absolute opportunities.
      </p>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Lever</th>
              <th className="px-3 py-2 text-right">tCO₂e/yr</th>
              <th className="w-[45%] px-3 py-2">Relative impact</th>
              <th className="px-3 py-2 text-right">£/yr saving</th>
              <th className="px-3 py-2 text-right">Capex</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pct = (r.savingT / max) * 100;
              return (
                <tr
                  key={r.id}
                  className={cn(
                    'border-t border-border/40 tabular-nums',
                    r.savingT === 0 && 'opacity-50',
                  )}
                >
                  <td className="px-3 py-2 text-foreground">{r.label}</td>
                  <td className="px-3 py-2 text-right">
                    {r.savingT.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-[#ccff00]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.savingGbp > 0
                      ? `£${r.savingGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {r.capex > 0
                      ? `£${r.capex.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground/70">
        Carbon saving monetised at £{shadowPrice}/tCO₂e (your shadow price) plus
        the lever&apos;s utility-bill impact. Capex scales per-facility where
        relevant. Use the sliders above for blended scenarios with cross-lever
        interactions.
      </p>
    </section>
  );
}
