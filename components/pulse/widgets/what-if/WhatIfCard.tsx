'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';
import { ABATEMENT_LEVERS } from '@/lib/pulse/abatement-costs';

/**
 * Pulse -- What-if playground, compact card.
 * Headline: estimated £ saving at default lever adoption (fixed preview).
 * Supporting: single green bar representing the default-setting saving.
 */

interface Baseline {
  total_t_co2e: number;
  by_category_t_co2e: Record<string, number>;
}

export function WhatIfCard() {
  const { currentOrganization } = useOrganization();
  const { openDrill } = useWidgetDrill();
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

  // Apply defaults across all levers and sum avoided tCO2e.
  const savingT = (() => {
    if (!baseline) return 0;
    const byCat = baseline.by_category_t_co2e;
    const reducedByCat: Record<string, number> = {};
    let total = 0;
    for (const lever of ABATEMENT_LEVERS) {
      const pct = lever.defaultPct / 100;
      for (const cat of lever.categories) {
        const catBase = byCat[cat] ?? 0;
        const remaining = catBase - (reducedByCat[cat] ?? 0);
        const saving = Math.max(0, Math.min(remaining, catBase * lever.maxReductionFactor * pct));
        reducedByCat[cat] = (reducedByCat[cat] ?? 0) + saving;
        total += saving;
      }
    }
    return total;
  })();
  const savingGbp = savingT * shadowPrice;
  const pct = baseline && baseline.total_t_co2e > 0 ? (savingT / baseline.total_t_co2e) * 100 : 0;

  return (
    <PulseCard
      icon={Sparkles}
      label="What-if playground"
      headline={savingGbp > 0 ? formatGbp(savingGbp) : '—'}
      sub={savingT > 0 ? `potential savings at default levers` : 'Default scenario'}
      footprint="2x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'what-if' })}
      footer={
        savingT > 0
          ? `${savingT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO₂e avoided (${pct.toFixed(0)}% of baseline)`
          : 'Click to model interventions'
      }
    >
      {savingT > 0 ? (
        <div className="flex h-full flex-col justify-center gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Renewables · Heat pumps · HVO · Packaging · Waste diversion · Solar
          </p>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground/50">
          Need baseline data
        </div>
      )}
    </PulseCard>
  );
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}
