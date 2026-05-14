import type { SupabaseClient } from '@supabase/supabase-js';

export type DistributorNotificationType =
  | 'brand_joined_alkatera'
  | 'brand_data_updated'
  | 'brand_tier_upgraded'
  | 'new_document_submitted'
  | 'scraping_complete'
  | 'conflict_detected'
  | 'pending_match';

export interface CreateNotificationArgs {
  supabase: SupabaseClient;
  distributorOrgId: string;
  brandProfileId?: string | null;
  type: DistributorNotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}

/**
 * Insert a row into distributor_notifications. Best-effort: a failed
 * notification insert should never block the underlying business
 * operation (linking, tier upgrade, scrape, etc.), so callers wrap
 * this in try/catch.
 */
export async function createDistributorNotification(args: CreateNotificationArgs): Promise<void> {
  await args.supabase.from('distributor_notifications').insert({
    distributor_org_id: args.distributorOrgId,
    brand_profile_id: args.brandProfileId ?? null,
    notification_type: args.type,
    title: args.title,
    body: args.body ?? null,
    link_url: args.linkUrl ?? null,
  });
}
