'use client';

/**
 * Pulse U5 -- MACC expanded view.
 *
 * Wraps the existing MACC widget with an interactive discount-rate slider.
 * The MACC endpoint already accepts `?discount_rate=` so we just pass it
 * through and refetch when the user drags. Private-sector default 8%,
 * social-discount reference 3.5% (UK Green Book), upper bound 20% for
 * risk-heavy scenarios.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import {
  useRegisterDrillSlot,
  type DrillSlotRenderer,
} from '@/lib/pulse/MetricDrillContext';
import { cn } from '@/lib/utils';

interface Lever {
  id: string;
  label: string;
  annual_tonnes_abated: number;
  capex_gbp: number;
  levelised_cost_gbp_per_tonne: number;
  npv_gbp: number;
  simple_payback_years: number | null;
  lifetime_years: number;
  annual_utility_saving_gbp: number;
  description?: string;
}

interface ApiPayload {
  ok: boolean;
  discount_rate: number;
  total_tonnes_abatable: number;
  levers: Lever[];
}

export function MaccExpandedSlot() {
  const renderer: DrillSlotRenderer = useCallback(() => <MaccExpanded />, []);
  useRegisterDrillSlot({
    id: 'macc-expanded',
    title: 'Marginal abatement curve',
    order: 10,
    match: t => t.kind === 'widget' && t.id === 'macc',
    render: renderer,
  });
  return null;
}

function MaccExpanded() {
  const { currentOrganization } = useOrganization();
  const [discountRate, setDiscountRate] = useState(0.08);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pulse/macc?organization_id=${currentOrganization.id}&discount_rate=${discountRate}`,
        );
        const json = await res.json();
        if (!cancelled && res.ok) setData(json as ApiPayload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, discountRate]);

  const freePayingBack = useMemo(
    () =>
      data?.levers.filter(l => l.levelised_cost_gbp_per_tonne <= 0) ?? [],
    [data],
  );
  const tonnesPayingBack = freePayingBack.reduce(
    (s, l) => s + l.annual_tonnes_abated,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Discount rate slider */}
      <section className="space-y-3 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Discount rate
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {(discountRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Paying back at ≤£0/t
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-500">
              {Math.round(tonnesPayingBack).toLocaleString('en-GB')} tCO₂e
            </p>
          </div>
        </div>
        <input
          type="range"
          min={0.03}
          max={0.2}
          step={0.005}
          value={discountRate}
          onChange={e => setDiscountRate(Number(e.target.value))}
          className="w-full accent-[#ccff00]"
          aria-label="Discount rate"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>3%</span>
          <span>3.5% UK Green Book (social)</span>
          <span>8% private-sector default</span>
          <span>20%</span>
        </div>
      </section>

      {/* MACC bars */}
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && data && data.levers.length === 0 && (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          MACC populates with activity data in electricity, gas, fuel or waste.
        </p>
      )}
      {!loading && data && data.levers.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-[#ccff00]" />
            Levers ranked by £/tCO₂e
          </h3>
          <LeverTable levers={data.levers} />
        </section>
      )}
    </div>
  );
}

function LeverTable({ levers }: { levers: Lever[] }) {
  const maxAbs = Math.max(
    ...levers.map(l => Math.abs(l.levelised_cost_gbp_per_tonne)),
    50,
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 text-left">Lever</th>
            <th className="px-3 py-2 text-right">tCO₂e / yr</th>
            <th className="px-3 py-2 text-right">Capex</th>
            <th className="px-3 py-2">£/t levelised</th>
            <th className="px-3 py-2 text-right">Payback</th>
            <th className="px-3 py-2 text-right">NPV</th>
          </tr>
        </thead>
        <tbody>
          {levers.map(l => {
            const neg = l.levelised_cost_gbp_per_tonne < 0;
            const pct =
              (Math.abs(l.levelised_cost_gbp_per_tonne) / maxAbs) * 100;
            return (
              <tr key={l.id} className="border-t border-border/40 tabular-nums">
                <td className="px-3 py-2 text-foreground">{l.label}</td>
                <td className="px-3 py-2 text-right">
                  {l.annual_tonnes_abated.toLocaleString('en-GB', {
                    maximumFractionDigits: 0,
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.capex_gbp > 0
                    ? `£${l.capex_gbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                      <div
                        className={cn(
                          'absolute h-full rounded-sm',
                          neg ? 'bg-emerald-500' : 'bg-red-500',
                        )}
                        style={{
                          left: neg ? `${50 - pct / 2}%` : '50%',
                          width: `${pct / 2}%`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        'w-16 text-right tabular-nums',
                        neg ? 'text-emerald-500' : 'text-foreground',
                      )}
                    >
                      {neg ? '-' : ''}£
                      {Math.round(Math.abs(l.levelised_cost_gbp_per_tonne))}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  {l.simple_payback_years === null
                    ? 'N/A'
                    : l.simple_payback_years === 0
                      ? 'Instant'
                      : `${l.simple_payback_years.toFixed(1)} yrs`}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right',
                    l.npv_gbp >= 0 ? 'text-emerald-500' : 'text-red-500',
                  )}
                >
                  £{l.npv_gbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
