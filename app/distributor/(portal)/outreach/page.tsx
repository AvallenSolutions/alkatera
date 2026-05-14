import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Bell, Mail } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Button } from '@/components/ui/button';
import { OutreachTable, type OutreachBrandRow } from '@/components/distributor/outreach/outreach-table';

export const dynamic = 'force-dynamic';

export default async function OutreachPage() {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  const { data: brands } = (await supabase
    .from('brand_profiles')
    .select(
      'id, name, category, outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, first_submission_at, last_submission_at, alkatera_tier',
    )
    .eq('distributor_org_id', member.distributor_org_id)
    .order('name')) as { data: OutreachBrandRow[] | null };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start justify-between flex-wrap gap-5">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              <Mail className="h-3 w-3" />
              Brand outreach
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Outreach</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Email brands a tokenised upload link and track who's submitted documents back to you.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100 shrink-0"
          >
            <Link href="/distributor/outreach/reminders">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              Reminder schedules
            </Link>
          </Button>
        </div>
      </div>
      <OutreachTable brands={brands ?? []} canSend={member.role !== 'viewer'} />
    </div>
  );
}
