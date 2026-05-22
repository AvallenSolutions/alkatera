import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Building2, Users } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  primary_market: string | null;
  subscription_tier: string;
  created_at: string;
}

export default async function AdminDistributorsPage() {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: orgs } = (await supabase
    .from('distributor_organizations')
    .select('id, name, slug, primary_market, subscription_tier, created_at')
    .order('created_at', { ascending: false })) as { data: OrgRow[] | null };

  const list = orgs ?? [];

  // Hydrate brand counts + member counts in parallel.
  const counts = await Promise.all(
    list.map(async (org) => {
      const [{ count: brandCount }, { count: memberCount }, { count: contactCount }] =
        await Promise.all([
          supabase
            .from('brand_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('distributor_org_id', org.id),
          supabase
            .from('distributor_members')
            .select('id', { count: 'exact', head: true })
            .eq('distributor_org_id', org.id),
          supabase
            .from('directory_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('distributor_org_id', org.id),
        ]);
      return {
        id: org.id,
        brand_count: brandCount ?? 0,
        member_count: memberCount ?? 0,
        contact_count: contactCount ?? 0,
      };
    }),
  );
  const countsById = new Map(counts.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Distributors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every distributor organisation on the platform, with portfolio + activity summary.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center text-sm">
          No distributor organisations yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="text-left px-4 py-2">Organisation</th>
                <th className="text-left px-4 py-2">Market</th>
                <th className="text-left px-4 py-2">Tier</th>
                <th className="text-right px-4 py-2">Brands</th>
                <th className="text-right px-4 py-2">Members</th>
                <th className="text-right px-4 py-2">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {list.map((org) => {
                const c = countsById.get(org.id);
                return (
                  <tr key={org.id} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/distributors/${org.id}`}
                        className="flex items-center gap-2 hover:text-neon-lime"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {org.primary_market ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground capitalize">
                      {org.subscription_tier}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c?.brand_count ?? 0}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground/60" />
                        {c?.member_count ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c?.contact_count ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
