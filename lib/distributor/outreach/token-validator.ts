import type { SupabaseClient } from '@supabase/supabase-js';

export type TokenInvalidReason = 'not_found' | 'expired';

export type TokenValidationResult =
  | {
      ok: true;
      brand: {
        id: string;
        distributor_org_id: string;
        name: string;
        category: string | null;
        country_of_origin: string | null;
        upload_token_expires_at: string | null;
      };
    }
  | { ok: false; reason: TokenInvalidReason };

/**
 * Look up a brand by its public upload_token. Returns a sanitised brand
 * shape suitable for the public upload page — no distributor ID is
 * exposed in the result, the caller fetches the distributor name
 * separately when it needs to display it.
 *
 * Callers should always use a service-role client because the brand
 * uploader has no Supabase session.
 */
export async function validateUploadToken(
  supabase: SupabaseClient,
  token: string,
): Promise<TokenValidationResult> {
  if (!token || token.length < 16) {
    return { ok: false, reason: 'not_found' };
  }

  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, distributor_org_id, name, category, country_of_origin, upload_token_expires_at')
    .eq('upload_token', token)
    .maybeSingle();

  if (!brand) {
    return { ok: false, reason: 'not_found' };
  }

  if (brand.upload_token_expires_at && new Date(brand.upload_token_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, brand };
}
