'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BrandActions } from '@/components/distributor/brand-detail/brand-actions';
import type { BrandProfile } from '@/types/distributor';

export interface BrandTableRow extends BrandProfile {
  sku_count: number;
  last_activity: string | null;
  /** Distinct source_name values appearing in this brand's active scraped_brand_data. */
  data_sources: string[];
  /** Status of the most recent data-finding job for this brand. */
  latest_finding_status: string | null;
  /** completed_at or created_at of the most recent data-finding job. */
  latest_finding_at: string | null;
  /**
   * Canonical scores hydrated from `brand_directory`. After Phase 4 the
   * mirror columns on `brand_profiles` were dropped; the brand list
   * page joins on the directory and overlays these fields per row.
   */
  sustainability_score: number | null;
  score_tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
  completeness_score: number | null;
}

interface Props {
  brands: BrandTableRow[];
  /** Owner/data_manager get an inline edit/delete menu per row. */
  canEdit?: boolean;
}

const TIER_COLOURS: Record<number, string> = {
  1: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  2: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  3: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  4: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

type SortKey = 'name' | 'completeness' | 'vitality' | 'sku_count' | 'last_activity';
type SortDir = 'asc' | 'desc';

export function BrandTable({ brands, canEdit }: Props) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [outreach, setOutreach] = useState<string>('all');
  const [minCompleteness, setMinCompleteness] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });

  const categories = useMemo(() => {
    const set = new Set<string>();
    brands.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [brands]);

  const filtered = useMemo(() => {
    const rows = brands.filter((b) => {
      if (tier !== 'all' && String(b.alkatera_tier) !== tier) return false;
      if (category !== 'all' && b.category !== category) return false;
      if (query && !b.name.toLowerCase().includes(query.toLowerCase())) return false;
      const score = b.completeness_score ?? 0;
      if (score < minCompleteness) return false;
      if (outreach !== 'all') {
        if (outreach === 'not_sent' && b.outreach_sent_at) return false;
        if (outreach === 'sent' && (!b.outreach_sent_at || b.last_submission_at)) return false;
        if (outreach === 'responded' && !b.last_submission_at) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'completeness':
          return ((a.completeness_score ?? 0) - (b.completeness_score ?? 0)) * dir;
        case 'vitality':
          return ((a.sustainability_score ?? 0) - (b.sustainability_score ?? 0)) * dir;
        case 'sku_count':
          return (a.sku_count - b.sku_count) * dir;
        case 'last_activity': {
          const av = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const bv = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          return (av - bv) * dir;
        }
      }
    });
    return rows;
  }, [brands, query, tier, category, outreach, minCompleteness, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-sky-300" />
          </div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Filter brands
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {filtered.length} of {brands.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search brand name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs pl-8"
            />
          </div>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
              <SelectItem value="4">Tier 4</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={outreach} onValueChange={setOutreach}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Outreach" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outreach</SelectItem>
              <SelectItem value="not_sent">Not sent</SelectItem>
              <SelectItem value="sent">Sent · awaiting</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              Min completeness{' '}
              <span className="text-sky-300 font-semibold tabular-nums">{minCompleteness}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minCompleteness}
              onChange={(e) => setMinCompleteness(parseInt(e.target.value, 10))}
              className="accent-sky-400 w-32"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <tr className="border-b border-border/60 bg-background/30">
              <SortableTh label="Brand" sortKey="name" current={sort} onSort={toggleSort} />
              <th className="text-left px-4 py-3.5">Category</th>
              <SortableTh label="SKUs" sortKey="sku_count" current={sort} onSort={toggleSort} />
              <SortableTh label="Vitality" sortKey="vitality" current={sort} onSort={toggleSort} />
              <SortableTh label="Data" sortKey="completeness" current={sort} onSort={toggleSort} />
              <th className="text-left px-4 py-3.5">Sources</th>
              <th className="text-left px-4 py-3.5">Finding</th>
              <th className="text-left px-4 py-3.5">Outreach</th>
              <th className="text-left px-4 py-3.5">Tier</th>
              <SortableTh
                label="Last activity"
                sortKey="last_activity"
                current={sort}
                onSort={toggleSort}
              />
              {canEdit && <th className="px-4 py-3.5 w-10" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((brand) => (
              <tr
                key={brand.id}
                className="border-b border-border/40 last:border-b-0 hover:bg-sky-500/5 transition-colors group"
              >
                <td className="px-4 py-3.5">
                  <Link
                    href={`/distributor/brands/${brand.id}`}
                    className="font-medium text-foreground group-hover:text-sky-200 transition-colors"
                  >
                    {brand.name}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{brand.category ?? '—'}</td>
                <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
                  {brand.sku_count}
                </td>
                <td className="px-4 py-3.5 min-w-[160px]">
                  <VitalityCell score={brand.sustainability_score} tier={brand.score_tier} />
                </td>
                <td className="px-4 py-3.5 min-w-[160px]">
                  <CompletenessBar score={brand.completeness_score} />
                </td>
                <td className="px-4 py-3.5">
                  <SourceBadges sources={brand.data_sources} />
                </td>
                <td className="px-4 py-3.5">
                  <FindingBadge
                    status={brand.latest_finding_status}
                    when={brand.latest_finding_at}
                  />
                </td>
                <td className="px-4 py-3.5">{renderOutreach(brand)}</td>
                <td className="px-4 py-3.5">
                  <Badge variant="outline" className={TIER_COLOURS[brand.alkatera_tier]}>
                    Tier {brand.alkatera_tier}
                  </Badge>
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {brand.last_activity ? new Date(brand.last_activity).toLocaleDateString() : '—'}
                </td>
                {canEdit && (
                  <td className="px-4 py-3.5 text-right">
                    <BrandActions
                      compact
                      canEdit
                      brand={{
                        id: brand.id,
                        name: brand.name,
                        website: brand.website ?? null,
                        category: brand.category ?? null,
                        country_of_origin: brand.country_of_origin ?? null,
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 11 : 10} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Inbox className="h-5 w-5" />
                    No brands match the current filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
}) {
  const active = current.key === sortKey;
  return (
    <th className="text-left px-4 py-3.5">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 hover:text-foreground transition-colors ${
          active ? 'text-sky-300' : ''
        }`}
      >
        {label}
        {active && (
          <span className="text-[10px] -translate-y-px">
            {current.dir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </button>
    </th>
  );
}

function CompletenessBar({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground italic">Awaiting data</span>;
  }
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const colour =
    pct >= 75
      ? 'bg-emerald-400'
      : pct >= 50
      ? 'bg-sky-400'
      : pct >= 25
      ? 'bg-amber-400'
      : 'bg-zinc-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-muted/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-foreground font-medium">{pct}%</span>
    </div>
  );
}

function SourceBadges({ sources }: { sources: string[] }) {
  if (sources.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  // Collapse named sources into three buckets so the column stays tidy.
  const hasBrandUpload = sources.includes('brand_upload');
  const hasOfficial = sources.some((s) =>
    ['B Corp Directory', 'Carbon Trust Certification', 'Companies House UK'].includes(s),
  );
  const hasWeb = sources.some((s) => !['brand_upload'].includes(s) && !['B Corp Directory', 'Carbon Trust Certification', 'Companies House UK'].includes(s));

  return (
    <div className="flex flex-wrap gap-1">
      {hasOfficial && (
        <Badge variant="outline" className="text-[10px] border-sky-400/40 text-sky-300">
          Verified
        </Badge>
      )}
      {hasBrandUpload && (
        <Badge variant="outline" className="text-[10px] border-sky-400/30 text-sky-300">
          Uploaded
        </Badge>
      )}
      {hasWeb && (
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
          Found
        </Badge>
      )}
    </div>
  );
}

function VitalityCell({
  score,
  tier,
}: {
  score: number | null;
  tier: 'leader' | 'progressing' | 'developing' | 'insufficient' | null;
}) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground italic">—</span>;
  }
  const cfg: Record<
    NonNullable<typeof tier>,
    { dot: string; label: string; text: string; glow: string }
  > = {
    leader: {
      dot: 'bg-emerald-400',
      label: 'Leader',
      text: 'text-emerald-300',
      glow: 'shadow-[0_0_6px_rgba(52,211,153,0.7)]',
    },
    progressing: {
      dot: 'bg-sky-400',
      label: 'Progressing',
      text: 'text-sky-300',
      glow: 'shadow-[0_0_6px_rgba(56,189,248,0.7)]',
    },
    developing: {
      dot: 'bg-amber-400',
      label: 'Developing',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_6px_rgba(251,191,36,0.7)]',
    },
    insufficient: {
      dot: 'bg-zinc-500',
      label: 'Insufficient',
      text: 'text-muted-foreground',
      glow: '',
    },
  };
  const c = tier ? cfg[tier] : cfg.insufficient;
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${c.dot} ${c.glow}`} />
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {Math.round(score)}
      </span>
      <span className={`text-[10px] uppercase tracking-wider font-semibold ${c.text}`}>
        {c.label}
      </span>
    </div>
  );
}

function FindingBadge({ status, when }: { status: string | null; when: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
        Not run
      </Badge>
    );
  }
  if (status === 'queued') {
    return (
      <Badge variant="outline" className="text-xs text-amber-300 border-amber-500/30">
        Queued
      </Badge>
    );
  }
  if (status === 'running') {
    return (
      <Badge variant="outline" className="text-xs text-sky-300 border-sky-400/30 animate-pulse">
        Finding…
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
        Error
      </Badge>
    );
  }
  // complete / skipped — show last-run time
  const label = when ? humanRelative(when) : 'done';
  return (
    <Badge variant="outline" className="text-xs text-emerald-300 border-emerald-500/30">
      {label}
    </Badge>
  );
}

function humanRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function renderOutreach(brand: BrandTableRow) {
  if (brand.last_submission_at) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      >
        Responded
      </Badge>
    );
  }
  if (brand.outreach_sent_at) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] uppercase tracking-wider font-semibold text-amber-300 border-amber-500/30 bg-amber-500/10"
      >
        Awaiting
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-muted"
    >
      Not sent
    </Badge>
  );
}
