import { Info } from 'lucide-react';
import type { Pillar } from '@/lib/distributor/scraping/field-definitions';

interface Props {
  overall: number | null;
  tier: string | null;
  byPillar: Record<Pillar, number> | null;
  missingRequired: string[];
}

const PILLAR_ORDER: Pillar[] = [
  'carbon',
  'water',
  'packaging',
  'agriculture',
  'governance',
  'corporate',
];

const PILLAR_LABEL: Record<Pillar, string> = {
  carbon: 'Carbon',
  water: 'Water',
  packaging: 'Packaging',
  agriculture: 'Agriculture',
  governance: 'Governance',
  corporate: 'Corporate',
};

const REQUIRED_LABEL: Record<string, string> = {
  carbon_intensity_kgco2e_per_litre: 'Carbon intensity (kgCO₂e/L)',
  water_usage_litres_per_litre: 'Water usage (L/L)',
  packaging_primary_material: 'Primary packaging material',
  sustainability_report_url: 'Sustainability report URL',
};

/**
 * Brand-detail panel that explains the headline sustainability score.
 * Shows per-pillar bars + a "missing required" callout so the admin
 * can immediately see which fields are dragging the score down.
 * Avoids hand-coding the explanation in copy: the panel surfaces the
 * inputs to the calculator so it's self-documenting.
 */
export function BrandScoreBreakdownPanel({ overall, tier, byPillar, missingRequired }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Score breakdown
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {overall != null ? Math.round(overall) : '—'}
          </div>
          {tier && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {tier}
            </div>
          )}
        </div>
      </div>

      {byPillar && (
        <ul className="space-y-1.5">
          {PILLAR_ORDER.map((p) => {
            const score = Math.max(0, Math.min(100, Math.round(byPillar[p] ?? 0)));
            return (
              <li key={p} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{PILLAR_LABEL[p]}</span>
                  <span className="tabular-nums font-medium">{score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-500 ${
                      score >= 75
                        ? 'bg-emerald-400'
                        : score >= 50
                          ? 'bg-sky-400'
                          : score >= 25
                            ? 'bg-amber-300'
                            : 'bg-destructive/70'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-[11px]">
          <div className="font-semibold text-amber-200 mb-1">
            Missing required — these drag the score the most:
          </div>
          <ul className="space-y-0.5 text-foreground/80">
            {missingRequired.map((key) => (
              <li key={key}>· {REQUIRED_LABEL[key] ?? key}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        The score is a weighted average across every sustainability field. Each field is graded
        0–100 (boolean certs are 100 or 0; carbon intensity, water usage etc. grade against
        industry bands). Missing required fields score 0; missing optional fields score 10. A
        B Corp badge alone can't lift the score when the carbon, water and packaging numbers
        are empty — those are the heaviest weights.
      </p>
    </div>
  );
}
