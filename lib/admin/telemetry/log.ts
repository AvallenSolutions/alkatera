import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fire-and-forget telemetry helpers for the Discover surface. All
 * three log to append-only tables created in
 * 20262607500000_admin_directory_kit.sql. Errors are swallowed —
 * telemetry should never break the user flow.
 *
 * Callers should pass a SERVICE-ROLE client. Telemetry rows include
 * the distributor_org_id + user_id so admins can drill down per-org
 * and per-user, but RLS lets distributors read their own org's rows.
 */

export async function logBrandView(
  service: SupabaseClient,
  args: {
    brandDirectoryId: string;
    distributorOrgId: string | null;
    userId: string | null;
  },
): Promise<void> {
  try {
    await service.from('directory_brand_views').insert({
      brand_directory_id: args.brandDirectoryId,
      distributor_org_id: args.distributorOrgId,
      user_id: args.userId,
    });
  } catch {
    /* swallow */
  }
}

export async function logSearch(
  service: SupabaseClient,
  args: {
    distributorOrgId: string | null;
    userId: string | null;
    query: string | null;
    filters: Record<string, unknown>;
    resultCount: number;
  },
): Promise<void> {
  try {
    await service.from('directory_searches').insert({
      distributor_org_id: args.distributorOrgId,
      user_id: args.userId,
      query: args.query?.slice(0, 200) ?? null,
      filters: args.filters,
      result_count: args.resultCount,
    });
  } catch {
    /* swallow */
  }
}

export async function logContact(
  service: SupabaseClient,
  args: {
    distributorOrgId: string;
    senderUserId: string | null;
    brandDirectoryId: string;
    recipientEmailRedacted: string | null;
    subject: string | null;
    message: string;
    status: 'sent' | 'failed' | 'blocked';
    resendMessageId?: string | null;
    errorMessage?: string | null;
  },
): Promise<string | null> {
  try {
    const { data } = await service
      .from('directory_contacts')
      .insert({
        distributor_org_id: args.distributorOrgId,
        sender_user_id: args.senderUserId,
        brand_directory_id: args.brandDirectoryId,
        recipient_email_redacted: args.recipientEmailRedacted,
        subject: args.subject,
        message_preview: args.message.slice(0, 200),
        resend_message_id: args.resendMessageId ?? null,
        status: args.status,
        error_message: args.errorMessage ?? null,
      })
      .select('id')
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Check whether a (distributor, brand) pair has been contacted within
 * the rate-limit window. Used by the Contact endpoint to block spam.
 *
 * Counts both `sent` and `failed` against the limit (the latter would
 * still bother the brand if Resend retried). `blocked` rows do NOT
 * count — they're the rate-limit log itself.
 */
export async function hasRecentContact(
  service: SupabaseClient,
  args: {
    distributorOrgId: string;
    brandDirectoryId: string;
    withinHours: number;
  },
): Promise<boolean> {
  const cutoff = new Date(Date.now() - args.withinHours * 60 * 60 * 1000).toISOString();
  const { data } = await service
    .from('directory_contacts')
    .select('id, status')
    .eq('distributor_org_id', args.distributorOrgId)
    .eq('brand_directory_id', args.brandDirectoryId)
    .gte('sent_at', cutoff)
    .in('status', ['sent', 'failed']);
  return Array.isArray(data) && data.length > 0;
}
