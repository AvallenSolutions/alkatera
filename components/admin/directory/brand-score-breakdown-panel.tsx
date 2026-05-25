import { Info } from 'lucide-react';

export type ScoringMode = 'scraped' | 'alkatera';

interface Props {
  overall: number | null;
  tier: string | null;
  /** Mode-shaped pillar map. Scraped → 3 keys (environment / social /
   *  governance); alkatera → 6 keys (carbon / water / packaging /
   *  agriculture / governance / corporate). */
  byPillar: Record<string, number> | null;
  missingRequired: string[];
  scoringMode: ScoringMode;
}

const SCRAPED_PILLAR_ORDER = ['environment', 'social', 'governance'] as const;
const ALKATERA_PILLAR_ORDER = [
  'carbon',
  'water',
  'packaging',
  'agriculture',
  'governance',
  'corporate',
] as const;

const PILLAR_LABEL: Record<string, string> = {
  environment: 'Environment',
  social: 'Social',
  governance: 'Governance',
  carbon: 'Carbon',
  water: 'Water',
  packaging: 'Packaging',
  agriculture: 'Agriculture',
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
export function BrandScoreBreakdownPanel({
  overall,
  tier,
  byPillar,
  missingRequired,
  scoringMode,
}: Props) {
  const pillarOrder = scoringMode === 'alkatera' ? ALKATERA_PILLAR_ORDER : SCRAPED_PILLAR_ORDER;
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Score breakdown
          <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
            {scoringMode === 'alkatera' ? 'alkatera mode · 6 pillars' : 'scraped mode · 3 pillars'}
          </span>
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
          {pillarOrder.map((p) => {
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

      {scoringMode === 'alkatera' && missingRequired.length > 0 && (
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
        {scoringMode === 'alkatera' ? (
          <>
            <strong>alka<strong>tera</strong> mode.</strong> Credit-based weighted mean across
            six pillars, same fairness as scraped mode. Two structural advantages: every field
            whose source is platform-verified (<code className="text-[10px] bg-muted/50 px-1 py-0.5 rounded">alkatera_live</code>{' '}
            or{' '}
            <code className="text-[10px] bg-muted/50 px-1 py-0.5 rounded">brand_verified</code>)
            earns a 1.25× weight bonus, recognising that platform-verified data is materially
            stronger evidence than open-web scrapes; and the granular ESG composite the brand
            calculates on alka<strong>tera</strong> folds into Governance as a heavy signal the
            field model can't replicate on its own.
          </>
        ) : (
          <>
            <strong>Scraped mode.</strong> Credit-based weighted mean across three pillars. Each
            field that has data contributes its weighted grade; missing fields contribute zero
            (no penalty either way). Fairer for brands that haven't published full disclosure
            but carry real certification evidence. Every contributing field cites a source URL
            so the score is fully auditable.
          </>
        )}
      </p>
    </div>
  );
}
