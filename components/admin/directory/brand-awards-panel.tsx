import Link from 'next/link';
import { Award, ExternalLink } from 'lucide-react';

export interface AwardRow {
  id: string;
  awarding_body: string;
  award_name: string;
  medal_tier:
    | 'gold'
    | 'silver'
    | 'bronze'
    | 'platinum'
    | 'best_in_class'
    | 'master'
    | 'double_gold'
    | 'finalist'
    | 'winner'
    | 'other'
    | null;
  year: number | null;
  source_url: string | null;
  product_directory_id: string | null;
  product_name: string | null;
  notes: string | null;
}

interface Props {
  awards: AwardRow[];
}

/**
 * Renders all awards on a brand — product-level awards include the
 * product name + a deep link to the product page; brand-level awards
 * show the BRAND chip instead. Sorted by year desc so the most recent
 * surface first.
 */
export function BrandAwardsPanel({ awards }: Props) {
  if (awards.length === 0) return null;
  const sorted = [...awards].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-5 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2">
        <Award className="h-4 w-4 text-amber-300" />
        Awards
        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
          {sorted.length}
        </span>
      </div>
      <ul className="space-y-2">
        {sorted.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
          >
            <MedalPill medal={a.medal_tier} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                <span>{a.award_name}</span>
                {a.year && (
                  <span className="text-[11px] text-muted-foreground">· {a.year}</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{a.awarding_body}</span>
                {a.product_directory_id && a.product_name ? (
                  <Link
                    href={`/admin/directory/products/${a.product_directory_id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-sky-300 text-[10px] uppercase tracking-wider"
                  >
                    {a.product_name}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-neon-lime/40 bg-neon-lime/10 px-2 py-0.5 text-neon-lime text-[10px] uppercase tracking-wider">
                    brand
                  </span>
                )}
                {a.notes && <span className="italic text-muted-foreground/80">{a.notes}</span>}
              </div>
            </div>
            {a.source_url && (
              <a
                href={a.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-neon-lime shrink-0"
                title="Open source"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MedalPill({ medal }: { medal: AwardRow['medal_tier'] }) {
  const cfg: Record<NonNullable<AwardRow['medal_tier']>, { label: string; style: string }> = {
    gold: { label: 'gold', style: 'bg-yellow-400/15 border-yellow-400/40 text-yellow-200' },
    double_gold: { label: 'dbl gold', style: 'bg-yellow-400/25 border-yellow-400/50 text-yellow-100' },
    silver: { label: 'silver', style: 'bg-zinc-300/15 border-zinc-300/40 text-zinc-200' },
    bronze: { label: 'bronze', style: 'bg-orange-400/15 border-orange-400/40 text-orange-200' },
    platinum: { label: 'platinum', style: 'bg-sky-200/15 border-sky-200/40 text-sky-100' },
    best_in_class: { label: 'best in class', style: 'bg-violet-400/15 border-violet-400/40 text-violet-200' },
    master: { label: 'master', style: 'bg-fuchsia-400/15 border-fuchsia-400/40 text-fuchsia-200' },
    finalist: { label: 'finalist', style: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-200' },
    winner: { label: 'winner', style: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-200' },
    other: { label: 'awarded', style: 'bg-border/60 border-border/60 text-muted-foreground' },
  };
  const c = medal ? cfg[medal] : cfg.other;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 shrink-0 ${c.style}`}
    >
      {c.label}
    </span>
  );
}
