'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Package,
  Activity,
  ShieldCheck,
  Database,
  Mail,
  Search,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface OverviewResponse {
  kpis: {
    brands_total: number;
    brands_on_alkatera: number;
    brands_added_30d: number;
    products_total: number;
    products_with_lca: number;
    active_distributors: number;
    contacts_last_7d: number;
    searches_last_7d: number;
    sync_queue_pending: number;
    sync_queue_failed: number;
  };
  growth: Array<Record<string, string | number>>;
  sources: Array<{ source: string; count: number }>;
  completeness: Array<{ bucket: string; count: number }>;
  sync_health: Array<{
    day: string;
    done: number;
    failed: number;
    pending: number;
    running: number;
  }>;
  top_contributors: Array<{
    distributor_org_id: string;
    name: string;
    brands_added: number;
  }>;
  top_viewed: Array<{
    brand_directory_id: string;
    name: string;
    on_alkatera: boolean;
    views: number;
  }>;
  failed_scraping: Array<{
    id: string;
    brand_profile_id: string | null;
    error_message: string | null;
    created_at: string;
  }>;
  stuck_sync_queue: Array<{
    id: string;
    trigger_source: string;
    attempts: number;
    last_error: string | null;
    created_at?: string;
    started_at?: string;
  }>;
}

const SOURCE_COLOURS: Record<string, string> = {
  sku_upload: '#38bdf8',
  alkatera_signup: '#34d399',
  manual: '#ccff00',
  phase1_backfill: '#a78bfa',
};

const COMPLETENESS_COLOURS = ['#f87171', '#fbbf24', '#38bdf8', '#34d399'];

export function AnalyticsDashboard() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics/overview');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as OverviewResponse;
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        Could not load analytics: {error ?? 'unknown error'}
      </div>
    );
  }

  const { kpis } = data;
  const linkedPct =
    kpis.brands_total > 0
      ? Math.round((kpis.brands_on_alkatera / kpis.brands_total) * 100)
      : 0;
  const lcaPct =
    kpis.products_total > 0
      ? Math.round((kpis.products_with_lca / kpis.products_total) * 100)
      : 0;

  const sourceKeys = Array.from(
    new Set(
      data.growth.flatMap((row) => Object.keys(row).filter((k) => k !== 'week_start')),
    ),
  );

  return (
    <div className="space-y-6">
      <section>
        <SectionEyebrow icon={<TrendingUp className="h-3 w-3" />}>
          Directory snapshot
        </SectionEyebrow>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard
            label="Brands in directory"
            value={kpis.brands_total.toLocaleString()}
            hint={`+${kpis.brands_added_30d} last 30d`}
            icon={<Building2 className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="On alkatera"
            value={kpis.brands_on_alkatera.toLocaleString()}
            hint={`${linkedPct}% of directory`}
            icon={<ShieldCheck className="h-4 w-4" />}
            tone="positive"
          />
          <StatCard
            label="Total products"
            value={kpis.products_total.toLocaleString()}
            icon={<Package className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Products with LCA"
            value={kpis.products_with_lca.toLocaleString()}
            hint={`${lcaPct}% have data`}
            icon={<Sparkles className="h-4 w-4" />}
            tone="positive"
          />
          <StatCard
            label="Active distributors (30d)"
            value={kpis.active_distributors.toLocaleString()}
            icon={<Activity className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Contacts (7d)"
            value={kpis.contacts_last_7d.toLocaleString()}
            icon={<Mail className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Searches (7d)"
            value={kpis.searches_last_7d.toLocaleString()}
            icon={<Search className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="Sync queue"
            value={kpis.sync_queue_pending.toLocaleString()}
            hint={
              kpis.sync_queue_failed > 0
                ? `${kpis.sync_queue_failed} failed`
                : 'all healthy'
            }
            icon={<Database className="h-4 w-4" />}
            tone={kpis.sync_queue_failed > 0 ? 'warn' : 'neutral'}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard title="Directory growth (12 weeks)" icon={<TrendingUp className="h-4 w-4 text-neon-lime" />}>
          {data.growth.length === 0 ? (
            <EmptyState text="No directory growth in the last 12 weeks." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  dataKey="week_start"
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis stroke="#666" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0a', border: '1px solid #1f1f1f', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {sourceKeys.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={SOURCE_COLOURS[key] ?? '#888'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Discovery sources" icon={<Sparkles className="h-4 w-4 text-neon-lime" />}>
          {data.sources.length === 0 ? (
            <EmptyState text="No brands in the directory yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Tooltip
                  contentStyle={{ background: '#0a0a0a', border: '1px solid #1f1f1f', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Pie
                  data={data.sources}
                  dataKey="count"
                  nameKey="source"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.sources.map((s) => (
                    <Cell key={s.source} fill={SOURCE_COLOURS[s.source] ?? '#888'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard
          title="Completeness distribution"
          icon={<TrendingUp className="h-4 w-4 text-neon-lime" />}
        >
          {data.completeness.every((b) => b.count === 0) ? (
            <EmptyState text="No completeness scores computed yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.completeness}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="bucket" stroke="#666" fontSize={10} />
                <YAxis stroke="#666" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0a', border: '1px solid #1f1f1f', fontSize: 12 }}
                />
                <Bar dataKey="count">
                  {data.completeness.map((b, i) => (
                    <Cell key={b.bucket} fill={COMPLETENESS_COLOURS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>

        <PanelCard title="Sync queue (last 7 days)" icon={<Database className="h-4 w-4 text-neon-lime" />}>
          {data.sync_health.every((d) => d.done + d.failed + d.pending + d.running === 0) ? (
            <EmptyState text="Sync queue idle." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.sync_health}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis
                  dataKey="day"
                  stroke="#666"
                  fontSize={10}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis stroke="#666" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0a', border: '1px solid #1f1f1f', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="done" stackId="a" fill="#34d399" />
                <Bar dataKey="failed" stackId="a" fill="#f87171" />
                <Bar dataKey="pending" stackId="a" fill="#fbbf24" />
                <Bar dataKey="running" stackId="a" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard title="Top contributing distributors" icon={<Building2 className="h-4 w-4 text-neon-lime" />}>
          {data.top_contributors.length === 0 ? (
            <EmptyState text="No distributors have surfaced brands yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                <tr>
                  <th className="text-left py-1">Distributor</th>
                  <th className="text-right py-1">Brands added</th>
                </tr>
              </thead>
              <tbody>
                {data.top_contributors.map((c) => (
                  <tr key={c.distributor_org_id} className="border-t border-border/40">
                    <td className="py-1.5">{c.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.brands_added}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelCard>

        <PanelCard title="Most-viewed brands (30d)" icon={<Activity className="h-4 w-4 text-neon-lime" />}>
          {data.top_viewed.length === 0 ? (
            <EmptyState text="No brand views logged yet — telemetry starts on the next refresh." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                <tr>
                  <th className="text-left py-1">Brand</th>
                  <th className="text-right py-1">Views</th>
                </tr>
              </thead>
              <tbody>
                {data.top_viewed.map((b) => (
                  <tr key={b.brand_directory_id} className="border-t border-border/40">
                    <td className="py-1.5">
                      <Link
                        href={`/admin/directory/brands/${b.brand_directory_id}`}
                        className="hover:text-neon-lime"
                      >
                        {b.name}
                        {b.on_alkatera && (
                          <span className="ml-2 text-[9px] uppercase tracking-wider text-emerald-300">
                            on alkatera
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{b.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard
          title="Failed scraping jobs"
          icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
        >
          {data.failed_scraping.length === 0 ? (
            <EmptyState text="No failed scraping jobs." />
          ) : (
            <ul className="space-y-2 text-xs">
              {data.failed_scraping.map((job) => (
                <li
                  key={job.id}
                  className="border-b border-border/40 last:border-b-0 pb-1.5 last:pb-0"
                >
                  <div className="text-muted-foreground/80">{job.created_at.slice(0, 19)}</div>
                  <div className="truncate">{job.error_message ?? 'no error message'}</div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="Stuck sync-queue rows"
          icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
        >
          {data.stuck_sync_queue.length === 0 ? (
            <EmptyState text="No stuck sync queue rows." />
          ) : (
            <ul className="space-y-2 text-xs">
              {data.stuck_sync_queue.map((row) => (
                <li
                  key={row.id}
                  className="border-b border-border/40 last:border-b-0 pb-1.5 last:pb-0"
                >
                  <div className="flex items-center justify-between text-muted-foreground/80">
                    <span>{row.trigger_source}</span>
                    <span>{row.attempts} attempts</span>
                  </div>
                  <div className="truncate">{row.last_error ?? 'still running'}</div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone: 'brand' | 'positive' | 'warn' | 'neutral';
}) {
  const toneStyle =
    tone === 'positive'
      ? 'border-emerald-400/30 bg-emerald-500/5 text-emerald-300'
      : tone === 'warn'
        ? 'border-amber-400/30 bg-amber-500/5 text-amber-300'
        : tone === 'brand'
          ? 'border-neon-lime/30 bg-neon-lime/5 text-neon-lime'
          : 'border-border/60 bg-card/40 text-muted-foreground';
  return (
    <div className={`rounded-xl border bg-card/40 px-4 py-3 ${toneStyle.split(' ').slice(0, 2).join(' ')}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-[10px] uppercase tracking-wider font-semibold ${toneStyle.split(' ')[2] ?? ''}`}>
          {label}
        </div>
        <div className={toneStyle.split(' ')[2] ?? ''}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function PanelCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function SectionEyebrow({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-2 py-0.5">
      {icon}
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-44 text-xs text-muted-foreground">
      {text}
    </div>
  );
}
