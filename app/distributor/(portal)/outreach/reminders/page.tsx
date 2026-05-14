import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Bell } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { ReminderSchedulesUI, type ReminderScheduleRow } from '@/components/distributor/outreach/reminder-schedules-ui';

export const dynamic = 'force-dynamic';

export default async function ReminderSchedulesPage() {
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
  const canEdit = member.role !== 'viewer';

  const { data: rows } = (await supabase
    .from('outreach_reminder_schedules')
    .select('id, brand_profile_id, interval_days, max_reminders, active, created_at')
    .eq('distributor_org_id', member.distributor_org_id)
    .order('created_at', { ascending: false })) as { data: ReminderScheduleRow[] | null };
  const schedules = rows ?? [];

  // Resolve brand names for per-brand schedules so the UI can show them.
  const brandIds = schedules.map((s) => s.brand_profile_id).filter((v): v is string => !!v);
  let brandNameById = new Map<string, string>();
  if (brandIds.length > 0) {
    const { data: brands } = await supabase
      .from('brand_profiles')
      .select('id, name')
      .in('id', brandIds);
    brandNameById = new Map(
      (brands ?? []).map((b: { id: string; name: string }) => [b.id, b.name]),
    );
  }

  const annotated = schedules.map((s) => ({
    ...s,
    brand_name: s.brand_profile_id ? brandNameById.get(s.brand_profile_id) ?? null : null,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/distributor/outreach"
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to outreach
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/30 p-3 shrink-0 shadow-[0_0_24px_rgba(56,189,248,0.15)]">
            <Bell className="h-6 w-6 text-sky-300" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-sky-300 bg-sky-500/10 border border-sky-400/30 rounded-full px-2.5 py-1">
              Automation
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Reminder schedules
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Automate follow-ups for brands that don't respond to the initial outreach.
            </p>
          </div>
        </div>
      </div>

      <ReminderSchedulesUI initialSchedules={annotated} canEdit={canEdit} />
    </div>
  );
}
