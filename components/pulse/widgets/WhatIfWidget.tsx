'use client';

/**
 * Pulse -- What-if scenario playground.
 *
 * Five canonical decarbonisation levers with sliders. Each lever multiplies
 * a category-level baseline by a saving factor scaled by the slider position
 * (0-100%). Totals update instantly and we monetise the saving via the org's
 * shadow carbon price (defaulting to UK ETS £85/tCO2e if not configured).
 *
 * Pure client-side maths once /api/pulse/whatif-baseline returns the per-
 * category baseline -- sliders feel snappy because there's no round-trip.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ABATEMENT_LEVERS,
  netPresentValue,
  simplePayback,
  type AbatementLever,
} from '@/lib/pulse/abatement-costs';

interface Baseline {
  ok: boolean;
  total_t_co2e: number;
  by_category_t_co2e: Record<string, number>;
  window: { start: string; end: string; label: string };
}

// Reuse the canonical lever library from lib/pulse/abatement-costs.ts so that
// the MACC chart, What-if playground and payback calculator stay in sync.
type Lever = AbatementLever;
const LEVERS: Lever[] = ABATEMENT_LEVERS;

// Match shadow-prices default (UK ETS, Apr 2026 reference).
const DEFAULT_SHADOW_PRICE_GBP_PER_T = 85;
// Private-sector discount rate per UK Green Book supplementary guidance.
const DISCOUNT_RATE = 0.08;

export function WhatIfWidget() {
  const { currentOrganization } = useOrganization();
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [shadowPrice, setShadowPrice] = useState<number>(DEFAULT_SHADOW_PRICE_GBP_PER_T);
  const [loading, setLoading] = useState(true);
  const [pcts, setPcts] = useState<Record<string, number>>(
    Object.fromEntries(LEVERS.map(l => [l.id, l.defaultPct])),
  );

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
          // Resolved price is per native unit (tCO2e); native_unit_multiplier
          // is 1 for total_co2e so price_per_unit IS £/t. Currency assumed GBP.
          if (carbon?.price_per_unit && !cancelled) {
            setShadowPrice(Number(carbon.price_per_unit));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const computed = useMemo(() => {
    if (!baseline) return null;
    const baselineByCat = baseline.by_category_t_co2e;
    const baselineTotal = baseline.total_t_co2e;

    // Each category's reduction is cumulative across levers, but capped at
    // the category baseline so two levers can't double-count the same emissions.
    const reductionByCat: Record<string, number> = {};
    const perLever: Record<string, {
      savingT: number;
      capexGbp: number;
      annualUtilitySavingGbp: number;
      paybackYears: number | null;
      npvGbp: number;
    }> = {};

    for (const lever of LEVERS) {
      const pct = (pcts[lever.id] ?? 0) / 100;
      let leverSaving = 0;
      for (const cat of lever.categories) {
        const catBase = baselineByCat[cat] ?? 0;
        const remaining = catBase - (reductionByCat[cat] ?? 0);
        const saving = Math.max(0, Math.min(remaining, catBase * lever.maxReductionFactor * pct));
        reductionByCat[cat] = (reductionByCat[cat] ?? 0) + saving;
        leverSaving += saving;
      }

      // Scale capex by adoption % since partial adoption means partial capex.
      const capex =
        lever.capexBasis === 'per_facility'
          ? lever.capexGbp * pct
          : lever.capexBasis === 'per_tonne_abated_per_year'
            ? lever.capexGbp * leverSaving
            : 0;

      // Annual utility saving (or premium): bill-impact per tCO2e × tonnes.
      const annualUtilitySaving =
        leverSaving * lever.avgUtilityCostGbpPerTonne * lever.utilityBillSavingFactor;

      // Total annual £ saving combines avoided carbon (shadow) + real bill impact.
      const totalAnnualSaving = leverSaving * shadowPrice + annualUtilitySaving;
      const payback = simplePayback(capex, totalAnnualSaving);
      const npv = netPresentValue(capex, totalAnnualSaving, lever.lifetimeYears, DISCOUNT_RATE);

      perLever[lever.id] = {
        savingT: leverSaving,
        capexGbp: capex,
        annualUtilitySavingGbp: annualUtilitySaving,
        paybackYears: payback,
        npvGbp: npv,
      };
    }

    const totalSaving = Object.values(perLever).reduce((s, v) => s + v.savingT, 0);
    const projected = Math.max(0, baselineTotal - totalSaving);
    const reductionPct = baselineTotal > 0 ? (totalSaving / baselineTotal) * 100 : 0;
    const moneySavedGbp = totalSaving * shadowPrice;
    const totalCapex = Object.values(perLever).reduce((s, v) => s + v.capexGbp, 0);
    const totalUtilitySaving = Object.values(perLever).reduce(
      (s, v) => s + v.annualUtilitySavingGbp,
      0,
    );
    const totalNpv = Object.values(perLever).reduce((s, v) => s + v.npvGbp, 0);

    return {
      baselineTotal,
      projected,
      totalSaving,
      reductionPct,
      moneySavedGbp,
      totalCapex,
      totalUtilitySaving,
      totalNpv,
      perLever,
    };
  }, [baseline, pcts, shadowPrice]);

  const reset = () => setPcts(Object.fromEntries(LEVERS.map(l => [l.id, l.defaultPct])));

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-5">
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What if?
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#ccff00]" />
              Decarbonisation playground
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Reset
          </Button>
        </header>

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && baseline && computed && (
          <>
            <Headline computed={computed} shadowPrice={shadowPrice} />

            <div className="space-y-3">
              {LEVERS.map(lever => (
                <LeverRow
                  key={lever.id}
                  lever={lever}
                  pct={pcts[lever.id] ?? 0}
                  leverResult={computed.perLever[lever.id]}
                  onChange={v => setPcts(prev => ({ ...prev, [lever.id]: v }))}
                />
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground/70">
              Baseline: {baseline.total_t_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t CO₂e from {baseline.window.label}.
              Savings monetised at £{shadowPrice}/t (your shadow price). Projections are illustrative -- model intervention costs separately before committing capex.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Headline({
  computed,
  shadowPrice,
}: {
  computed: {
    baselineTotal: number;
    projected: number;
    totalSaving: number;
    reductionPct: number;
    moneySavedGbp: number;
    totalCapex: number;
    totalUtilitySaving: number;
    totalNpv: number;
  };
  shadowPrice: number;
}) {
  const {
    baselineTotal,
    projected,
    totalSaving,
    reductionPct,
    moneySavedGbp,
    totalCapex,
    totalUtilitySaving,
    totalNpv,
  } = computed;
  const tone =
    reductionPct >= 50
      ? 'text-emerald-500'
      : reductionPct >= 25
        ? 'text-[#ccff00]'
        : 'text-amber-500';
  void shadowPrice;
  // Blended annual saving includes the shadow £/tCO2e AND the utility bill impact.
  const blendedAnnualSaving = moneySavedGbp + totalUtilitySaving;
  const blendedPayback =
    totalCapex > 0 && blendedAnnualSaving > 0 ? totalCapex / blendedAnnualSaving : null;
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Baseline"
          value={`${baselineTotal.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`}
          sub="last 12 months"
        />
        <Stat
          label="Projected"
          value={`${projected.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t`}
          sub={
            <span className={cn('flex items-center gap-1', tone)}>
              <ArrowDown className="h-3 w-3" />
              {reductionPct.toFixed(0)}% lower
            </span>
          }
        />
        <Stat
          label="Annual saving"
          value={`£${blendedAnnualSaving.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
          sub={`${totalSaving.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t avoided`}
        />
      </div>
      <div className="grid gap-3 border-t border-border/40 pt-3 sm:grid-cols-3">
        <Stat
          label="Capex"
          value={totalCapex > 0 ? `£${totalCapex.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '—'}
          sub={totalCapex > 0 ? 'one-off' : 'no capital lever active'}
        />
        <Stat
          label="Simple payback"
          value={
            blendedPayback === null
              ? 'N/A'
              : blendedPayback < 0.1
                ? 'Instant'
                : `${blendedPayback.toFixed(1)} yrs`
          }
          sub="capex ÷ annual saving"
        />
        <Stat
          label="10yr NPV"
          value={`£${totalNpv.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
          sub={totalNpv >= 0 ? 'value created' : 'value destroyed'}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function LeverRow({
  lever,
  pct,
  leverResult,
  onChange,
}: {
  lever: Lever;
  pct: number;
  leverResult: {
    savingT: number;
    capexGbp: number;
    annualUtilitySavingGbp: number;
    paybackYears: number | null;
    npvGbp: number;
  } | undefined;
  onChange: (v: number) => void;
}) {
  const saving_t = leverResult?.savingT ?? 0;
  const capex = leverResult?.capexGbp ?? 0;
  const payback = leverResult?.paybackYears ?? null;
  const npv = leverResult?.npvGbp ?? 0;
  return (
    <div className="rounded-md border border-border/40 bg-card/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{lever.label}</p>
          <p className="text-[11px] text-muted-foreground">{lever.description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums text-foreground">{pct}%</p>
          <p className="text-[10px] tabular-nums text-emerald-500">
            -{saving_t.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t
          </p>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#ccff00]"
        aria-label={`${lever.label} adoption percentage`}
      />
      {pct > 0 && (capex > 0 || npv !== 0) && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
          {capex > 0 && (
            <span>
              Capex <span className="font-medium tabular-nums text-foreground">£{capex.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
            </span>
          )}
          <span>
            Payback{' '}
            <span className="font-medium tabular-nums text-foreground">
              {payback === null ? 'N/A' : payback < 0.1 ? 'Instant' : `${payback.toFixed(1)} yrs`}
            </span>
          </span>
          <span>
            {lever.lifetimeYears}yr NPV{' '}
            <span className={cn('font-medium tabular-nums', npv >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              £{npv.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
