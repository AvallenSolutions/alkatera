import { Sparkles } from 'lucide-react';

export interface EsgSnapshot {
  composite: number | null;
  environmental: number | null;
  social: number | null;
  governance: number | null;
  breakdown: {
    e?: Record<string, number | null>;
    s?: Record<string, number | null>;
    g?: Record<string, number | null>;
  } | null;
}

/**
 * Friendly labels for the ESG sub-pillars the alka**tera** Rosa hub
 * computes (see /api/vitality/composite). Falls back to a
 * snake-case → Title Case transform for any key we haven't named.
 */
const SUB_PILLAR_LABELS: Record<string, string> = {
  climate: 'Climate',
  water: 'Water',
  nature: 'Nature',
  circularity: 'Circularity',
  community: 'Community',
  supplier_esg: 'Supplier ESG',
  people_culture: 'People & culture',
  governance: 'Governance practices',
  certifications: 'Certifications',
};

function subPillarLabel(key: string): string {
  return (
    SUB_PILLAR_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

type Accent = 'sky' | 'lime';

const ACCENT: Record<Accent, { panel: string; iconWrap: string; icon: string; bar: string }> = {
  sky: {
    panel: 'from-sky-500/5',
    iconWrap: 'bg-sky-500/10 border-sky-400/30',
    icon: 'text-sky-300',
    bar: 'bg-sky-400',
  },
  lime: {
    panel: 'from-neon-lime/5',
    iconWrap: 'bg-neon-lime/10 border-neon-lime/30',
    icon: 'text-neon-lime',
    bar: 'bg-neon-lime',
  },
};

function scoreColour(v: number | null): string {
  if (v == null) return 'text-muted-foreground';
  if (v >= 70) return 'text-emerald-300';
  if (v >= 40) return 'text-sky-300';
  if (v >= 20) return 'text-amber-300';
  return 'text-red-400';
}

/**
 * Renders the E/S/G vitality breakdown from an esg_score_snapshots row
 * — the same numbers the brand sees in their alka**tera** vitality
 * card. Each pillar shows its headline score, a mini bar, and the
 * per-sub-pillar values. Used on the distributor Discover detail page
 * and the admin brand detail page.
 */
export function EsgBreakdownPanel({
  snapshot,
  accent = 'sky',
}: {
  snapshot: EsgSnapshot;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  const sections: Array<{
    key: 'e' | 's' | 'g';
    label: string;
    overall: number | null;
    breakdown: Record<string, number | null> | null;
  }> = [
    { key: 'e', label: 'Environmental', overall: snapshot.environmental, breakdown: snapshot.breakdown?.e ?? null },
    { key: 's', label: 'Social', overall: snapshot.social, breakdown: snapshot.breakdown?.s ?? null },
    { key: 'g', label: 'Governance', overall: snapshot.governance, breakdown: snapshot.breakdown?.g ?? null },
  ];

  return (
    <div className={`rounded-xl border border-border/60 bg-gradient-to-br ${a.panel} via-card/40 to-card/40 overflow-hidden`}>
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className={`rounded-md border p-1.5 ${a.iconWrap}`}>
          <Sparkles className={`h-4 w-4 ${a.icon}`} />
        </div>
        <div className="text-sm font-semibold">ESG breakdown</div>
        {snapshot.composite != null && (
          <span className="ml-1 text-[11px] text-muted-foreground">
            composite <strong className="text-foreground tabular-nums">{Math.round(snapshot.composite)}</strong>
          </span>
        )}
        <div className="text-[11px] text-muted-foreground ml-auto">
          from the brand's alka<strong>tera</strong> vitality card
        </div>
      </div>
      <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {sections.map((section) => (
          <div
            key={section.key}
            className="rounded-lg border border-border/40 bg-background/40 px-4 py-3 space-y-2"
          >
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {section.label}
              </div>
              <div className={`text-xl font-semibold tabular-nums ${scoreColour(section.overall)}`}>
                {section.overall != null ? Math.round(section.overall) : '—'}
              </div>
            </div>
            {/* Mini bar for the pillar headline */}
            <div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
              <div
                className={`h-full ${a.bar}`}
                style={{ width: `${Math.max(0, Math.min(100, section.overall ?? 0))}%` }}
              />
            </div>
            {section.breakdown && Object.keys(section.breakdown).length > 0 ? (
              <ul className="space-y-1 pt-1">
                {Object.entries(section.breakdown).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{subPillarLabel(k)}</span>
                    <span className={`tabular-nums ${scoreColour(typeof v === 'number' ? v : null)}`}>
                      {typeof v === 'number' ? Math.round(v) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] text-muted-foreground pt-1">No sub-pillar data.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
