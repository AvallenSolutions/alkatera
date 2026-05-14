export type DistributorRole = 'owner' | 'data_manager' | 'viewer';

export type SubscriptionTier = 'starter' | 'pro' | 'enterprise';

export type SkuListStatus = 'pending' | 'mapping' | 'processing' | 'complete' | 'error';

export type SkuListFileType = 'csv' | 'xlsx' | 'pdf';

export type ScoreTier = 'leader' | 'progressing' | 'developing' | 'insufficient';

export type ListingStatus = 'active' | 'delisted';

export interface DistributorOrganization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  primary_market: string | null;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface DistributorMember {
  id: string;
  distributor_org_id: string;
  user_id: string;
  role: DistributorRole;
  brand_scope: string[] | null;
  category_scope: string[] | null;
  invited_by: string | null;
  joined_at: string;
}

export interface DistributorInvitation {
  id: string;
  distributor_org_id: string;
  email: string;
  role: DistributorRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface DistributorSkuList {
  id: string;
  distributor_org_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: SkuListFileType;
  row_count: number | null;
  brand_count: number | null;
  status: SkuListStatus;
  error_message: string | null;
  column_mapping: ColumnMapping | null;
  created_at: string;
  updated_at: string;
}

export interface BrandProfile {
  id: string;
  distributor_org_id: string;
  alkatera_org_id: string | null;
  name: string;
  normalized_name: string;
  website: string | null;
  country_of_origin: string | null;
  category: string | null;
  alkatera_tier: 1 | 2 | 3 | 4;
  outreach_email: string | null;
  outreach_sent_at: string | null;
  outreach_last_reminder_at: string | null;
  outreach_reminder_count: number;
  upload_token: string | null;
  upload_token_expires_at: string | null;
  first_submission_at: string | null;
  last_submission_at: string | null;
  completeness_score: number | null;
  sustainability_score: number | null;
  score_tier: ScoreTier | null;
  score_updated_at: string | null;
  directory_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandSku {
  id: string;
  brand_profile_id: string;
  distributor_org_id: string;
  sku_list_id: string | null;
  sku_code: string | null;
  product_name: string;
  category: string | null;
  country_of_origin: string | null;
  listing_status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export type ColumnMappingField =
  | 'brand_name'
  | 'product_name'
  | 'sku_code'
  | 'category'
  | 'country_of_origin'
  | 'listing_status'
  | 'website';

export interface ColumnMapping {
  brand_name: string;
  product_name: string;
  sku_code?: string;
  category?: string;
  country_of_origin?: string;
  listing_status?: string;
  /** Brand-level field. Used to seed brand_profiles.website so the
   *  Phase 2 scraping pipeline has a URL to fetch for each brand. */
  website?: string;
}

export interface SkuListParseResult {
  preview: Record<string, string>[];
  detected_columns: string[];
  suggestions: Partial<ColumnMapping>;
}

export interface DistributorContextValue {
  organization: DistributorOrganization;
  member: DistributorMember;
}
