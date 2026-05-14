import type { SupabaseClient } from '@supabase/supabase-js';
import { Mail, MailX, History } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Badge } from '@/components/ui/badge';
import { BrandOutreachCard } from '@/components/distributor/outreach/brand-outreach-card';
import type { BrandProfile } from '@/types/distributor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

const STATUS_COLOURS: Record<string, string> = {
  sent: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  delivered: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  opened: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  bounced: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  failed: 'text-destructive border-destructive/30 bg-destructive/10',
};

export default async function BrandOutreachTabPage({ params }: PageProps) {
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

  const { data: brand } = (await supabase
    .from('brand_profiles')
    .select(
      'id, name, outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, upload_token, upload_token_expires_at',
    )
    .eq('id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle()) as { data: BrandProfile | null };
  if (!brand) return null;

  const { data: history } = await supabase
    .from('outreach_emails')
    .select('id, email_type, recipient_email, status, error_message, sent_at')
    .eq('brand_profile_id', brand.id)
    .order('sent_at', { ascending: false });

  type EmailRow = {
    id: string;
    email_type: 'initial' | 'reminder';
    recipient_email: string;
    status: string;
    error_message: string | null;
    sent_at: string;
  };
  const rows = (history ?? []) as EmailRow[];

  return (
    <div className="space-y-6">
      <BrandOutreachCard
        brandId={brand.id}
        initialEmail={brand.outreach_email}
        uploadToken={brand.upload_token}
        uploadTokenExpiresAt={brand.upload_token_expires_at}
        outreachSentAt={brand.outreach_sent_at}
        reminderCount={brand.outreach_reminder_count}
        lastReminderAt={brand.outreach_last_reminder_at}
        canEdit={canEdit}
      />

      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
            <History className="h-4 w-4 text-sky-300" />
          </div>
          <div className="text-sm font-semibold">Email history</div>
        </div>
        <div className="px-5 pb-5">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-2">
              No emails sent to this brand yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-3 text-sm rounded-lg border border-border/40 bg-background/40 p-3"
                >
                  <EmailIcon type={row.email_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold">
                        {row.email_type === 'initial' ? 'Initial outreach' : 'Reminder'}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider font-semibold ${
                          STATUS_COLOURS[row.status] ?? ''
                        }`}
                      >
                        {row.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      To <span className="text-foreground/80 font-medium">{row.recipient_email}</span> ·{' '}
                      {new Date(row.sent_at).toLocaleString()}
                    </div>
                    {row.error_message && (
                      <div className="text-xs text-destructive mt-1">{row.error_message}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailIcon({ type }: { type: 'initial' | 'reminder' }) {
  if (type === 'initial') {
    return (
      <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5 shrink-0">
        <Mail className="h-3.5 w-3.5 text-sky-300" />
      </div>
    );
  }
  return (
    <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5 shrink-0">
      <MailX className="h-3.5 w-3.5 text-amber-300" />
    </div>
  );
}
