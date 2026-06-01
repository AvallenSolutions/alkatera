/**
 * Procurement tier types. The procurement portal sits above
 * distributor_organizations and aggregates SKU + sustainability data
 * across multiple distributor tenants linked to a procurement org.
 *
 * Wire model mirrors `types/distributor.ts` where the concepts overlap;
 * procurement-specific concepts (channel labels, source distributor,
 * branding) are layered on top.
 */

export type ProcurementRole = 'owner' | 'viewer';

export type ProcurementSubscriptionTier = 'trial' | 'starter' | 'pro' | 'enterprise';

export type ProcurementSkuListStatus =
  | 'pending'
  | 'mapping'
  | 'processing'
  | 'complete'
  | 'error';

export type ProcurementSkuListFileType = 'csv' | 'xlsx' | 'pdf';

export type ProcurementLinkStatus = 'active' | 'invited' | 'suspended';

export interface ProcurementBranding {
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  email_logo_url: string | null;
  email_sender_name: string | null;
  email_sender_email: string | null;
  email_footer_text: string | null;
  pdf_footer_text: string | null;
}

export interface ProcurementOrganization extends ProcurementBranding {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  parent_company: string | null;
  website: string | null;
  primary_market: string | null;
  subscription_tier: ProcurementSubscriptionTier;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementMember {
  id: string;
  procurement_org_id: string;
  user_id: string;
  role: ProcurementRole;
  invited_by: string | null;
  joined_at: string;
}

export interface ProcurementInvitation {
  id: string;
  procurement_org_id: string;
  email: string;
  role: ProcurementRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ProcurementDistributorLink {
  id: string;
  procurement_org_id: string;
  distributor_org_id: string;
  channel_label: string;
  status: ProcurementLinkStatus;
  reply_to_user_id: string | null;
  email_subject_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementSkuList {
  id: string;
  procurement_org_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: ProcurementSkuListFileType;
  row_count: number | null;
  brand_count: number | null;
  channel_summary: Record<string, number> | null;
  status: ProcurementSkuListStatus;
  error_message: string | null;
  column_mapping: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementSku {
  id: string;
  procurement_org_id: string;
  procurement_sku_list_id: string | null;
  brand_directory_id: string;
  source_distributor_org_id: string;
  source_brand_sku_id: string | null;
  channel_label: string;
  product_name: string;
  sku_code: string | null;
  category: string | null;
  country_of_origin: string | null;
  vintage: number | null;
  volume_per_year_liters: number | null;
  list_price_gbp: number | null;
  listing_status: 'active' | 'delisted';
  procurement_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementContextValue {
  organization: ProcurementOrganization;
  member: ProcurementMember;
}

/**
 * Column mapping fields a procurement SKU upload supports. Mirrors
 * `ColumnMapping` from types/distributor.ts plus the procurement-only
 * fields: `distributor_channel` (required), `vintage`, `volume_per_year_liters`,
 * `list_price_gbp`.
 */
export type ProcurementColumnField =
  | 'brand_name'
  | 'product_name'
  | 'distributor_channel'
  | 'sku_code'
  | 'gtin'
  | 'category'
  | 'country_of_origin'
  | 'listing_status'
  | 'website'
  | 'vintage'
  | 'volume_per_year_liters'
  | 'list_price_gbp';

export interface ProcurementColumnMapping {
  brand_name: string;
  product_name: string;
  distributor_channel: string;
  sku_code?: string;
  gtin?: string;
  category?: string;
  country_of_origin?: string;
  listing_status?: string;
  website?: string;
  vintage?: string;
  volume_per_year_liters?: string;
  list_price_gbp?: string;
}

export interface ProcurementSkuListParseResult {
  preview: Record<string, string>[];
  detected_columns: string[];
  suggestions: Partial<ProcurementColumnMapping>;
  /** Distinct channel values seen in the preview rows — surfaced in the UI so the user can spot typos before confirming. */
  detected_channels: string[];
  /** Channel labels the procurement org has active links for, so the UI can show what the column values must match. */
  known_channels: string[];
}

export interface ProcurementSkuListConfirmResult {
  brand_count: number;
  sku_count: number;
  row_count: number;
  channel_summary: Record<string, number>;
  unresolved_channels: Array<{ value: string; row_count: number }>;
  scraping_queued: number;
  scraping_skipped_directory_hit: number;
  alkatera_auto_linked: number;
  alkatera_suggested: number;
  warnings: string[];
}
