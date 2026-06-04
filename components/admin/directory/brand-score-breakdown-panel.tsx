import { Info, CheckCircle2, ExternalLink } from 'lucide-react';

export type ScoreSource = 'scraped' | 'alkatera';
export type ScoreConfidence = 'high' | 'medium' | 'low';

export interface PillarSignalEvidence {
  id: string;
  label: string;
  source_url: string | null;
}

export interface PillarSignalsSummary {
  count: number;
  /** Either the new SignalEvidence-shaped records (preferred) or
   *  legacy string labels (older callers that haven't been updated).
   *  The renderer normalises both shapes. */
  signals: PillarSignalEvidence[] | string[];
}

interface Props {
  overall: number | null;
  tier: string | null;
  /** Unified 6-pillar map: climate / nature / water / circularity /
   *  social / governance. Null means "no data for this pillar". */
  byPillar: Record<string, number | null> | null;
  /** Per-pillar lists of which positive signals fired (scraped path). */
  signalsByPillar?: Record<string, PillarSignalsSummary>;
  missingRequired: string[];
  /** Where the score came from. */
  source: ScoreSource;
  /** How much real data backs the score. */
  confidence: ScoreConfidence;
}

const PILLAR_ORDER = [
  'climate',
  'water',
  'circularity',
  'nature',
  'social',
  'governance',
] as const;

const PILLAR_LABEL: Record<string, string> = {
  climate: 'Climate',
  water: 'Water',
  circularity: 'Circularity',
  nature: 'Nature',
  social: 'Social',
  governance: 'Governance',
};

const REQUIRED_LABEL: Record<string, string> = {
  carbon_intensity_kgco2e_per_litre: 'Carbon intensity (kgCO₂e/L)',
  water_usage_litres_per_litre: 'Water usage (L/L)',
  packaging_primary_material: 'Primary packaging material',
  sustainability_report_url: 'Sustainability report URL',
};

const CONFIDENCE_LABEL: Record<ScoreConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

/**
 * Brand-detail panel that explains the unified sustainability score.
 *
 * Six pillars on one 0–100 scale: the four environmental pillars
 * (Climate, Water, Circularity, Nature) plus Social and Governance.
 * alka**tera**-linked brands show their real on-platform pillar scores;
 * scraped brands show an estimate from available evidence, with the
 * contributing signals listed so the score is auditable.
 */
export function BrandScoreBreakdownPanel({
  overall,
  tier,
  byPillar,
  signalsByPillar,
  missingRequired,
  source,
  confidence,
}: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Score breakdown
          <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
            {source === 'alkatera' ? 'alkatera composite' : 'estimated'} · {CONFIDENCE_LABEL[confidence]}
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
        <ul className="space-y-3">
          {PILLAR_ORDER.map((p) => {
            const raw = byPillar[p];
            const hasData = raw != null;
            const score = Math.max(0, Math.min(100, Math.round(raw ?? 0)));
            const pillarSignals = signalsByPillar?.[p];
            return (
              <li key={p} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {PILLAR_LABEL[p]}
                    {pillarSignals && pillarSignals.count > 0 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider">
                        {pillarSignals.count} signal{pillarSignals.count === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-medium">{hasData ? score : '—'}</span>
                </div>
                <div className="h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-500 ${
                      !hasData
                        ? 'bg-muted'
                        : score >= 70
                          ? 'bg-emerald-400'
                          : score >= 50
                            ? 'bg-sky-400'
                            : score >= 30
                              ? 'bg-amber-300'
                              : 'bg-destructive/70'
                    }`}
                    style={{ width: `${hasData ? score : 0}%` }}
                  />
                </div>
                {pillarSignals && pillarSignals.signals.length > 0 && (
                  <ul className="pt-1 space-y-0.5">
                    {pillarSignals.signals.map((s, idx) => {
                      // Normalise legacy string shape to evidence shape
                      // so older callers keep rendering.
                      const evidence: PillarSignalEvidence =
                        typeof s === 'string'
                          ? { id: `${idx}`, label: s, source_url: null }
                          : s;
                      return (
                        <li
                          key={evidence.id ?? idx}
                          className="flex items-center gap-1.5 text-[11px] text-emerald-200"
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>{evidence.label}</span>
                          {evidence.source_url && (
                            <a
                              href={evidence.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-emerald-200 transition-colors"
                              title="Open source evidence in a new tab"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-[11px]">
          <div className="font-semibold text-amber-200 mb-1">
            Missing required fields — these limit the score:
          </div>
          <ul className="space-y-0.5 text-foreground/80">
            {missingRequired.map((key) => (
              <li key={key}>· {REQUIRED_LABEL[key] ?? key}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {source === 'alkatera' ? (
          <>
            <strong>alka<strong>tera</strong> composite.</strong> This brand's real on-platform
            pillar scores (Climate, Water, Circularity, Nature, Social, Governance) mapped onto the
            distributor scale. The environment pillars carry the headline (≈70%), with Social and
            Governance as supporting context.
          </>
        ) : (
          <>
            <strong>Estimated from evidence.</strong> Each pillar is graded from the
            sustainability data we hold — carbon and water are benchmarked against the brand's
            product category, certifications are credibility-weighted, and reduction targets are
            scored on ambition and credibility. Pillars with no data are dropped from the mean
            rather than scored zero. The headline is environment-weighted (≈70%) because carbon and
            water are the most material signals for drinks brands.
          </>
        )}
      </p>
    </div>
  );
}
