import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upload an image to the public report-assets bucket and return its public
 * URL. Shared by the funnel branding slots and the Brand kit editor.
 *
 * Path prefixes are organisational convention only, NOT a security boundary:
 * the bucket's RLS lets any authenticated user write any path (see
 * supabase/migrations/20260712180000_report_assets_bucket.sql), and reads are
 * public. Brand-kit uploads use `brand/{orgId}`; the funnel keeps its
 * historical `logos` / `leadership` / `hero` prefixes.
 */
export async function uploadReportAsset(
  supabase: SupabaseClient,
  file: File,
  pathPrefix: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const { data, error } = await supabase.storage
    .from('report-assets')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('report-assets').getPublicUrl(data.path);
  return urlData.publicUrl;
}
