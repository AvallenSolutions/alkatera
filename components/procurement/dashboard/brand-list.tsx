import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { BrandSummary } from '@/lib/procurement/dashboard';

const TIER_PILL: Record<NonNullable<BrandSummary['score_tier']> | 'unknown', string> = {
  leader: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  progressing: 'bg-teal-50 text-teal-700 border-teal-200',
  developing: 'bg-amber-50 text-amber-700 border-amber-200',
  insufficient: 'bg-rose-50 text-rose-700 border-rose-200',
  unknown: 'bg-stone-50 text-stone-600 border-stone-200',
};

const TIER_LABEL: Record<NonNullable<BrandSummary['score_tier']> | 'unknown', string> = {
  leader: 'Leader',
  progressing: 'Progressing',
  developing: 'Developing',
  insufficient: 'Insufficient',
  unknown: 'No data',
};

interface Props {
  brands: BrandSummary[];
  slug: string;
  emptyText: string;
  showGap?: boolean;
}

/**
 * Read-only brand list used by the dashboard's top wins / top gaps
 * widgets and the brand list page. Each row links through to the
 * procurement brand drilldown.
 */
export function BrandList({ brands, slug, emptyText, showGap }: Props) {
  if (brands.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70 rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {brands.map((b) => {
        const tier = b.score_tier ?? 'unknown';
        return (
          <li key={b.brand_directory_id}>
            <Link
              href={`/procurement/${slug}/brands/${b.brand_directory_id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-[14px] text-foreground truncate">
                    {b.name}
                  </div>
                  {b.alkatera_org_id ? (
                    <span className="text-[9px] uppercase tracking-[0.18em] rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-1.5 py-0.5 font-semibold">
                      alkatera
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {[b.category, b.country_of_origin].filter(Boolean).join(' · ')}
                  {b.channels.length > 0 ? (
                    <>
                      {b.category || b.country_of_origin ? ' · ' : ''}
                      <span className="text-foreground/70">{b.channels.join(' / ')}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-5">
                {showGap ? (
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                      Volume
                    </div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">
                      {Math.round(b.volume_liters).toLocaleString('en-GB')} L
                    </div>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                      Score
                    </div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">
                      {b.sustainability_score != null ? Math.round(b.sustainability_score) : '—'}
                    </div>
                  </div>
                )}
                <span
                  className={`text-[9px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-full border ${TIER_PILL[tier]}`}
                >
                  {TIER_LABEL[tier]}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
