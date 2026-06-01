import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Mail,
  Link2,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  brand_profile_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

const ICONS: Record<
  string,
  { Icon: LucideIcon; chipBg: string; chipText: string; chipBorder: string }
> = {
  brand_joined_alkatera: {
    Icon: Sparkles,
    chipBg: 'bg-sky-500/10',
    chipText: 'text-sky-300',
    chipBorder: 'border-sky-400/30',
  },
  brand_tier_upgraded: {
    Icon: CheckCircle2,
    chipBg: 'bg-emerald-500/15',
    chipText: 'text-emerald-300',
    chipBorder: 'border-emerald-400/30',
  },
  brand_data_updated: {
    Icon: FileText,
    chipBg: 'bg-sky-500/10',
    chipText: 'text-sky-300',
    chipBorder: 'border-sky-400/30',
  },
  new_document_submitted: {
    Icon: FileText,
    chipBg: 'bg-sky-500/10',
    chipText: 'text-sky-300',
    chipBorder: 'border-sky-400/30',
  },
  conflict_detected: {
    Icon: AlertTriangle,
    chipBg: 'bg-amber-500/15',
    chipText: 'text-amber-300',
    chipBorder: 'border-amber-400/30',
  },
  scraping_complete: {
    Icon: Mail,
    chipBg: 'bg-muted/40',
    chipText: 'text-muted-foreground',
    chipBorder: 'border-border',
  },
  pending_match: {
    Icon: Link2,
    chipBg: 'bg-amber-500/15',
    chipText: 'text-amber-300',
    chipBorder: 'border-amber-400/30',
  },
};

export default async function NotificationsPage() {
  const supabase = getSupabasePortalServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  const { data: rows } = (await supabase
    .from('distributor_notifications')
    .select(
      'id, brand_profile_id, notification_type, title, body, link_url, read_at, created_at',
    )
    .eq('distributor_org_id', member.distributor_org_id)
    .order('created_at', { ascending: false })
    .limit(100)) as { data: NotificationRow[] | null };
  const list = rows ?? [];
  const unreadCount = list.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
            <Bell className="h-3 w-3" />
            {unreadCount > 0
              ? `${unreadCount} unread`
              : `${list.length} total`}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Activity across your portfolio: brand matches, tier upgrades, conflicts and document
            submissions.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="rounded-lg bg-sky-500/10 border border-sky-400/30 p-3">
            <Bell className="h-5 w-5 text-sky-300" />
          </div>
          No notifications yet.
        </div>
      ) : (
        <ul className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden divide-y divide-border/40">
          {list.map((n) => {
            const meta = ICONS[n.notification_type] ?? {
              Icon: Bell,
              chipBg: 'bg-muted/40',
              chipText: 'text-muted-foreground',
              chipBorder: 'border-border',
            };
            const { Icon } = meta;
            const content = (
              <div
                className={`px-5 py-4 flex items-start gap-3 transition-colors ${
                  !n.read_at ? 'bg-sky-500/5' : ''
                }`}
              >
                <div
                  className={`rounded-md border ${meta.chipBg} ${meta.chipBorder} p-1.5 shrink-0`}
                >
                  <Icon className={`h-3.5 w-3.5 ${meta.chipText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${!n.read_at ? 'font-semibold' : 'font-medium'}`}>
                      {n.title}
                    </span>
                    {!n.read_at && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider font-semibold text-sky-200 border-sky-400/40 bg-sky-500/15"
                      >
                        New
                      </Badge>
                    )}
                  </div>
                  {n.body && (
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider font-semibold">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link_url ? (
                  <Link href={n.link_url} className="block hover:bg-sky-500/10 transition-colors">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
