'use client';

/**
 * Pulse -- Carbon price scenario sensitivity.
 *
 * Four canonical scenarios (Low / Current / Mid / Stress) plus a custom
 * slider where the user can pick any £/t price and see the resulting annual
 * bill instantly.
 *
 * Headline: "For every £10 change in carbon price, your bill changes by £X".
 * This is the single most useful line a CFO or treasurer can have.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gauge, Loader2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  label: string;
  blurb: string;
  price_per_tonne_gbp: number;
  annual_cost_gbp: number;
  is_current: boolean;
}

interface ApiPayload {
  ok: boolean;
  annual_tonnes_co2e: number;
  current_price_gbp_per_tonne: number;
  current_price_source: string;
  sensitivity_gbp_per_10_per_tonne: number;
  scenarios: Scenario[];
}

export function ScenarioSensitivityWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Custom scenario slider. Starts at the current price once data arrives.
  const [customPrice, setCustomPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pulse/scenario-sensitivity?organization_id=${currentOrganization.id}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? 'Failed to load scenario sensitivity');
        } else {
          setData(json as ApiPayload);
          setCustomPrice(Math.round(json.current_price_gbp_per_tonne));
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const customCost = useMemo(() => {
    if (!data || customPrice === null) return 0;
    return data.annual_tonnes_co2e * customPrice;
  }, [data, customPrice]);

  const maxScenarioPrice = useMemo(
    () => Math.max(...(data?.scenarios.map(s => s.price_per_tonne_gbp) ?? [100]), 250),
    [data],
  );

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-3 w-3 text-[#ccff00]" />
              Carbon price sensitivity
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">
              What happens if the UK ETS moves?
            </h3>
          </div>
        </header>

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && data && data.annual_tonnes_co2e === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            No trailing-12-month carbon data yet -- the scenario analysis appears
            once emissions snapshots start landing.
          </p>
        )}

        {!loading && !error && data && data.annual_tonnes_co2e > 0 && (
          <>
            <SensitivityHeadline data={data} />

            <ScenarioBars
              scenarios={data.scenarios}
              maxPrice={maxScenarioPrice}
            />

            {customPrice !== null && (
              <CustomScenarioSlider
                annualTonnes={data.annual_tonnes_co2e}
                currentPrice={data.current_price_gbp_per_tonne}
                customPrice={customPrice}
                customCost={customCost}
                onChange={setCustomPrice}
              />
            )}

            <p className="text-[10px] text-muted-foreground/70">
              Based on {data.annual_tonnes_co2e.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e
              of trailing-12-month Scope 1+2 emissions. Scenario prices are
              reference points, not market forecasts.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SensitivityHeadline({ data }: { data: ApiPayload }) {
  return (
    <div className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/5 p-4">
      <p className="text-xs text-muted-foreground">
        For every <span className="font-semibold text-foreground">£10 change</span> in
        carbon price per tonne
      </p>
      <p className="mt-0.5 text-3xl font-semibold tabular-nums text-foreground">
        ±{formatGbp(data.sensitivity_gbp_per_10_per_tonne)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        change in your annual carbon bill
      </p>
    </div>
  );
}

function ScenarioBars({
  scenarios,
  maxPrice,
}: {
  scenarios: Scenario[];
  maxPrice: number;
}) {
  const maxCost = Math.max(...scenarios.map(s => s.annual_cost_gbp), 1);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Reference scenarios
      </p>
      <ul className="space-y-2">
        {scenarios.map(s => {
          const widthPct = (s.annual_cost_gbp / maxCost) * 100;
          const isStress = s.id === 'stress';
          return (
            <li
              key={s.id}
              className={cn(
                'rounded-md border p-2.5',
                s.is_current
                  ? 'border-[#ccff00]/50 bg-[#ccff00]/5'
                  : isStress
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-border/40 bg-card/30',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    £{s.price_per_tonne_gbp}/t
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                  {s.is_current && (
                    <span className="rounded-full bg-[#ccff00] px-1.5 py-0.5 text-[9px] font-bold text-black">
                      YOU
                    </span>
                  )}
                  {isStress && (
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                  )}
                </div>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatGbp(s.annual_cost_gbp)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full transition-all',
                    s.is_current ? 'bg-[#ccff00]' : isStress ? 'bg-red-500' : 'bg-slate-400',
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/80">{s.blurb}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CustomScenarioSlider({
  annualTonnes,
  currentPrice,
  customPrice,
  customCost,
  onChange,
}: {
  annualTonnes: number;
  currentPrice: number;
  customPrice: number;
  customCost: number;
  onChange: (v: number) => void;
}) {
  const deltaPrice = customPrice - currentPrice;
  const deltaCost = customCost - annualTonnes * currentPrice;
  const tone =
    deltaCost > 0 ? 'text-red-500' : deltaCost < 0 ? 'text-emerald-500' : 'text-muted-foreground';
  return (
    <div className="rounded-md border border-border/40 bg-card/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Custom price
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            £{customPrice}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/t</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Annual bill</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatGbp(customCost)}
          </p>
          {deltaPrice !== 0 && (
            <p className={cn('text-[11px] font-medium tabular-nums', tone)}>
              {deltaCost > 0 ? '+' : ''}
              {formatGbp(deltaCost)} vs today
            </p>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={400}
        step={5}
        value={customPrice}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#ccff00]"
        aria-label="Custom carbon price per tonne"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
        <span>£0</span>
        <span>£100</span>
        <span>£200</span>
        <span>£300</span>
        <span>£400</span>
      </div>
    </div>
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
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  });
}
