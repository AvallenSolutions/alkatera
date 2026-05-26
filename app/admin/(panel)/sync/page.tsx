import type { SupabaseClient } from '@supabase/supabase-js';
import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

export const dynamic = 'force-dynamic';

export default async function AdminSyncPage() {
  const supabase = getSupabaseAdminClient() as unknown as SupabaseClient;

  const [
    { data: queueByStatus },
    { data: failedQueue },
    { data: failedScraping },
  ] = await Promise.all([
    supabase.from('alkatera_sync_queue').select('status'),
    supabase
      .from('alkatera_sync_queue')
      .select('id, trigger_source, attempts, last_error, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('scraping_jobs')
      .select('id, brand_profile_id, error_message, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const statusCounts = new Map<string, number>();
  for (const r of (queueByStatus ?? []) as Array<{ status: string }>) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  const queue = (failedQueue ?? []) as Array<{
    id: string;
    trigger_source: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
  }>;
  const scraping = (failedScraping ?? []) as Array<{
    id: string;
    brand_profile_id: string | null;
    error_message: string | null;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sync health</h1>
        <p className="text-sm text-muted-foreground mt-1">
          alka<strong>tera</strong> sync queue + open-web scraping job health.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusTile label="Pending" value={statusCounts.get('pending') ?? 0} tone="warn" />
        <StatusTile label="Running" value={statusCounts.get('running') ?? 0} tone="brand" />
        <StatusTile label="Done" value={statusCounts.get('done') ?? 0} tone="positive" />
        <StatusTile label="Failed" value={statusCounts.get('failed') ?? 0} tone="danger" />
      </div>

      <Panel
        title="Sync queue failures"
        icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
      >
        {queue.length === 0 ? (
          <Empty text="No failed sync queue rows. The realtime worker is healthy." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              <tr>
                <th className="text-left py-1">Source</th>
                <th className="text-left py-1">Last error</th>
                <th className="text-right py-1">Attempts</th>
                <th className="text-right py-1">Created</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id} className="border-t border-border/40">
                  <td className="py-1.5 text-muted-foreground">{q.trigger_source}</td>
                  <td className="py-1.5 truncate max-w-[400px]">{q.last_error ?? '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{q.attempts}</td>
                  <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                    {q.created_at.slice(5, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel
        title="Failed scraping jobs"
        icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
      >
        {scraping.length === 0 ? (
          <Empty text="No failed scraping jobs." />
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              <tr>
                <th className="text-left py-1">Error</th>
                <th className="text-right py-1">When</th>
              </tr>
            </thead>
            <tbody>
              {scraping.map((s) => (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="py-1.5 truncate max-w-[500px]">{s.error_message ?? '—'}</td>
                  <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                    {s.created_at.slice(5, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'brand' | 'positive' | 'warn' | 'danger';
}) {
  const colours = {
    brand: 'border-neon-lime/30 text-neon-lime',
    positive: 'border-emerald-400/30 text-emerald-300',
    warn: 'border-amber-400/30 text-amber-300',
    danger: 'border-destructive/40 text-destructive',
  } as const;
  return (
    <div className={`rounded-xl border bg-card/40 px-4 py-3 ${colours[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1 text-foreground">{value}</div>
    </div>
  );
}

function Panel({
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

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-emerald-300 py-2">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}
