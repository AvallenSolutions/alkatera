import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Activity, Search, Mail, Eye } from 'lucide-react';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

export const dynamic = 'force-dynamic';

export default async function AdminActivityPage() {
  const supabase = getSupabaseAdminClient() as unknown as SupabaseClient;

  const [
    { data: views },
    { data: searches },
    { data: contacts },
  ] = await Promise.all([
    supabase
      .from('directory_brand_views')
      .select('id, brand_directory_id, distributor_org_id, viewed_at')
      .order('viewed_at', { ascending: false })
      .limit(30),
    supabase
      .from('directory_searches')
      .select('id, query, filters, result_count, distributor_org_id, searched_at')
      .order('searched_at', { ascending: false })
      .limit(30),
    supabase
      .from('directory_contacts')
      .select(
        'id, distributor_org_id, brand_directory_id, recipient_email_redacted, status, subject, sent_at',
      )
      .order('sent_at', { ascending: false })
      .limit(30),
  ]);

  const viewRows = (views ?? []) as Array<{
    id: string;
    brand_directory_id: string;
    distributor_org_id: string | null;
    viewed_at: string;
  }>;
  const searchRows = (searches ?? []) as Array<{
    id: string;
    query: string | null;
    filters: Record<string, unknown> | null;
    result_count: number | null;
    distributor_org_id: string | null;
    searched_at: string;
  }>;
  const contactRows = (contacts ?? []) as Array<{
    id: string;
    distributor_org_id: string;
    brand_directory_id: string;
    recipient_email_redacted: string | null;
    status: string;
    subject: string | null;
    sent_at: string;
  }>;

  const brandIds = Array.from(
    new Set([
      ...viewRows.map((v) => v.brand_directory_id),
      ...contactRows.map((c) => c.brand_directory_id),
    ]),
  );
  const orgIds = Array.from(
    new Set(
      [
        ...viewRows.map((v) => v.distributor_org_id),
        ...searchRows.map((s) => s.distributor_org_id),
        ...contactRows.map((c) => c.distributor_org_id),
      ].filter((id): id is string => id !== null),
    ),
  );

  const [{ data: brandsLookup }, { data: orgsLookup }] = await Promise.all([
    brandIds.length > 0
      ? supabase.from('brand_directory').select('id, name').in('id', brandIds)
      : Promise.resolve({ data: [] }),
    orgIds.length > 0
      ? supabase.from('distributor_organizations').select('id, name').in('id', orgIds)
      : Promise.resolve({ data: [] }),
  ]);
  const brandNameById = new Map(
    ((brandsLookup ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
  );
  const orgNameById = new Map(
    ((orgsLookup ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent searches, brand views, and contact messages across the Discover surface.
        </p>
      </div>

      <Panel
        title="Recent brand views"
        icon={<Eye className="h-4 w-4 text-neon-lime" />}
        empty={viewRows.length === 0 && 'No brand views logged yet.'}
      >
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            <tr>
              <th className="text-left py-1">Brand</th>
              <th className="text-left py-1">Distributor</th>
              <th className="text-right py-1">Viewed</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map((v) => (
              <tr key={v.id} className="border-t border-border/40">
                <td className="py-1.5">
                  <Link
                    href={`/admin/directory/brands/${v.brand_directory_id}`}
                    className="hover:text-neon-lime"
                  >
                    {brandNameById.get(v.brand_directory_id) ?? '—'}
                  </Link>
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {v.distributor_org_id ? orgNameById.get(v.distributor_org_id) ?? '—' : '—'}
                </td>
                <td className="py-1.5 text-right text-[11px] text-muted-foreground tabular-nums">
                  {formatAge(v.viewed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Recent searches"
        icon={<Search className="h-4 w-4 text-neon-lime" />}
        empty={searchRows.length === 0 && 'No searches logged yet.'}
      >
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            <tr>
              <th className="text-left py-1">Query</th>
              <th className="text-left py-1">Distributor</th>
              <th className="text-right py-1">Results</th>
              <th className="text-right py-1">When</th>
            </tr>
          </thead>
          <tbody>
            {searchRows.map((s) => (
              <tr key={s.id} className="border-t border-border/40">
                <td className="py-1.5">
                  <span className="font-mono text-[12px]">{s.query ?? '(filters only)'}</span>
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {s.distributor_org_id ? orgNameById.get(s.distributor_org_id) ?? '—' : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums">{s.result_count ?? '—'}</td>
                <td className="py-1.5 text-right text-[11px] text-muted-foreground tabular-nums">
                  {formatAge(s.searched_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Recent contacts"
        icon={<Mail className="h-4 w-4 text-neon-lime" />}
        empty={contactRows.length === 0 && 'No contacts sent yet.'}
      >
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
            <tr>
              <th className="text-left py-1">Distributor</th>
              <th className="text-left py-1">Brand</th>
              <th className="text-left py-1">Subject</th>
              <th className="text-left py-1">Status</th>
              <th className="text-right py-1">When</th>
            </tr>
          </thead>
          <tbody>
            {contactRows.map((c) => (
              <tr key={c.id} className="border-t border-border/40">
                <td className="py-1.5 text-muted-foreground">{orgNameById.get(c.distributor_org_id) ?? '—'}</td>
                <td className="py-1.5">
                  <Link
                    href={`/admin/directory/brands/${c.brand_directory_id}`}
                    className="hover:text-neon-lime"
                  >
                    {brandNameById.get(c.brand_directory_id) ?? '—'}
                  </Link>
                </td>
                <td className="py-1.5 text-muted-foreground truncate max-w-[260px]">
                  {c.subject ?? '(no subject)'}
                </td>
                <td className="py-1.5">
                  <span
                    className={
                      c.status === 'sent'
                        ? 'text-emerald-300'
                        : c.status === 'failed'
                          ? 'text-destructive'
                          : 'text-amber-300'
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="py-1.5 text-right text-[11px] text-muted-foreground tabular-nums">
                  {formatAge(c.sent_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  empty?: string | false;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="px-5 pb-5">
        {empty ? (
          <div className="text-xs text-muted-foreground py-4 text-center">{empty}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function formatAge(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const m = Math.round(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}
