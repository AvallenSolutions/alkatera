import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOutreachEmail } from './send';

export interface DispatchArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  distributorName: string;
  /** Address brand replies should route back to (typically the calling user). */
  replyTo: string | null;
  /** auth.users.id of the distributor user who pressed the button (for audit). */
  sentBy: string;
  brandProfileIds: string[];
  emailType: 'initial' | 'reminder';
  force?: boolean;
}

export interface DispatchOutcome {
  brand_profile_id: string;
  status: 'sent' | 'skipped' | 'error';
  reason?: string;
  message_id?: string | null;
}

export interface DispatchResult {
  sent: number;
  skipped: number;
  errors: number;
  outcomes: DispatchOutcome[];
}

const REMINDER_MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Walk a list of brand IDs and send the right outreach email to each
 * one. Persists an outreach_emails audit row for every successful send
 * and stamps brand_profiles with the relevant timestamp so the dashboard
 * can show "last contacted X days ago".
 *
 * Honours four guards before sending:
 *   - the brand must have an outreach_email set
 *   - for `initial` sends, outreach_sent_at must be null (unless force=true)
 *   - for `reminder` sends, at least 7 days must have passed since the
 *     last outreach
 *   - the brand must belong to the given distributor_org_id (defence in
 *     depth — RLS would block this too)
 */
export async function dispatchOutreach(args: DispatchArgs): Promise<DispatchResult> {
  const outcomes: DispatchOutcome[] = [];

  const { data: brands } = await args.supabase
    .from('brand_profiles')
    .select(
      'id, name, distributor_org_id, outreach_email, outreach_sent_at, outreach_last_reminder_at, outreach_reminder_count, upload_token, upload_token_expires_at',
    )
    .in('id', args.brandProfileIds)
    .eq('distributor_org_id', args.distributorOrgId);

  if (!brands || brands.length === 0) {
    return { sent: 0, skipped: 0, errors: 0, outcomes };
  }

  for (const brand of brands as Array<{
    id: string;
    name: string;
    distributor_org_id: string;
    outreach_email: string | null;
    outreach_sent_at: string | null;
    outreach_last_reminder_at: string | null;
    outreach_reminder_count: number;
    upload_token: string | null;
    upload_token_expires_at: string | null;
  }>) {
    if (!brand.outreach_email) {
      outcomes.push({ brand_profile_id: brand.id, status: 'skipped', reason: 'no_outreach_email' });
      continue;
    }
    if (!brand.upload_token) {
      outcomes.push({ brand_profile_id: brand.id, status: 'skipped', reason: 'no_upload_token' });
      continue;
    }

    if (args.emailType === 'initial' && brand.outreach_sent_at && !args.force) {
      outcomes.push({ brand_profile_id: brand.id, status: 'skipped', reason: 'already_sent' });
      continue;
    }
    if (args.emailType === 'reminder') {
      const last = mostRecent([brand.outreach_last_reminder_at, brand.outreach_sent_at]);
      if (!last) {
        outcomes.push({ brand_profile_id: brand.id, status: 'skipped', reason: 'no_initial_outreach' });
        continue;
      }
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < REMINDER_MIN_INTERVAL_MS && !args.force) {
        outcomes.push({ brand_profile_id: brand.id, status: 'skipped', reason: 'too_soon' });
        continue;
      }
    }

    // Pull active SKU names for the email body.
    const { data: skus } = await args.supabase
      .from('brand_skus')
      .select('product_name')
      .eq('brand_profile_id', brand.id)
      .eq('listing_status', 'active')
      .order('product_name')
      .limit(20);
    const skuNames = (skus ?? []).map((s: { product_name: string }) => s.product_name);

    const result = await sendOutreachEmail({
      recipient: brand.outreach_email,
      emailType: args.emailType,
      brandName: brand.name,
      distributorName: args.distributorName,
      skuNames,
      totalSkuCount: skuNames.length,
      uploadToken: brand.upload_token,
      replyTo: args.replyTo,
      distributorContactEmail: args.replyTo,
    });

    const auditRow = {
      brand_profile_id: brand.id,
      distributor_org_id: brand.distributor_org_id,
      sent_by: args.sentBy,
      email_type: args.emailType,
      recipient_email: brand.outreach_email,
      resend_message_id: result.message_id ?? null,
      status: result.ok ? 'sent' : 'failed',
      error_message: result.ok ? null : result.error ?? null,
    } as const;

    await args.supabase.from('outreach_emails').insert(auditRow);

    if (!result.ok) {
      outcomes.push({
        brand_profile_id: brand.id,
        status: 'error',
        reason: result.error ?? 'unknown_error',
      });
      continue;
    }

    // Stamp brand_profiles with the relevant timestamp.
    const nowIso = new Date().toISOString();
    if (args.emailType === 'initial') {
      await args.supabase
        .from('brand_profiles')
        .update({ outreach_sent_at: nowIso, outreach_email: brand.outreach_email })
        .eq('id', brand.id);
    } else {
      await args.supabase
        .from('brand_profiles')
        .update({
          outreach_last_reminder_at: nowIso,
          outreach_reminder_count: brand.outreach_reminder_count + 1,
        })
        .eq('id', brand.id);
    }

    outcomes.push({ brand_profile_id: brand.id, status: 'sent', message_id: result.message_id });
  }

  const summary = outcomes.reduce(
    (acc, o) => {
      if (o.status === 'sent') acc.sent += 1;
      else if (o.status === 'skipped') acc.skipped += 1;
      else acc.errors += 1;
      return acc;
    },
    { sent: 0, skipped: 0, errors: 0 },
  );

  return { ...summary, outcomes };
}

function mostRecent(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || new Date(v).getTime() > new Date(best).getTime()) best = v;
  }
  return best;
}
