import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateAlkateraTier } from './tier-calculator';
import { createDistributorNotification } from './notifications';
import { sendNewLinkEmailToBrand } from './link-emails';
import { syncAlkateraDataForBrand } from './alkatera-sync';
import {
  findAlkateraOrgMatch,
  MATCH_THRESHOLDS,
  type BrandForMatching,
  type MatchMethod,
} from './brand-matcher';

export interface LinkCreationArgs {
  supabase: SupabaseClient;
  brandProfileId: string;
  alkateraOrgId: string;
  matchMethod: MatchMethod;
  matchConfidence: number;
  /** Manual link from the distributor UI sets needsBrandConfirmation=true; auto-link via name match sets false. */
  needsBrandConfirmation: boolean;
}

export interface LinkCreationResult {
  ok: boolean;
  link_id?: string;
  new_tier?: number;
  error?: string;
}

/**
 * Insert a brand_distributor_links row, sync brand_profiles.alkatera_org_id +
 * alkatera_tier, fire the brand-side email + distributor notification.
 *
 * Idempotent: if a link already exists for (brand, alkatera_org), returns
 * ok=true with the existing link_id and no side effects.
 */
export async function createBrandDistributorLink(
  args: LinkCreationArgs,
): Promise<LinkCreationResult> {
  const { supabase, brandProfileId, alkateraOrgId } = args;

  const { data: existing } = await supabase
    .from('brand_distributor_links')
    .select('id')
    .eq('brand_profile_id', brandProfileId)
    .eq('alkatera_org_id', alkateraOrgId)
    .maybeSingle();
  if (existing) {
    return { ok: true, link_id: (existing as { id: string }).id };
  }

  // Need distributor_org_id and a few fields off brand_profiles to write
  // the link + recompute tier.
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, name, distributor_org_id, first_submission_at')
    .eq('id', brandProfileId)
    .maybeSingle();
  if (!brand) return { ok: false, error: 'brand_not_found' };

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, subscription_status')
    .eq('id', alkateraOrgId)
    .maybeSingle();
  if (!org) return { ok: false, error: 'alkatera_org_not_found' };

  const confirmedNow = !args.needsBrandConfirmation;
  const { data: link, error: insertError } = await supabase
    .from('brand_distributor_links')
    .insert({
      brand_profile_id: brandProfileId,
      distributor_org_id: (brand as { distributor_org_id: string }).distributor_org_id,
      alkatera_org_id: alkateraOrgId,
      match_method: args.matchMethod,
      match_confidence: args.matchConfidence,
      confirmed_by_brand: confirmedNow,
      confirmed_at: confirmedNow ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (insertError || !link) {
    return { ok: false, error: insertError?.message ?? 'insert_failed' };
  }

  const tier = await syncBrandTier(supabase, brandProfileId);

  // Stamp brand_profiles.alkatera_org_id for fast joins.
  await supabase
    .from('brand_profiles')
    .update({ alkatera_org_id: alkateraOrgId })
    .eq('id', brandProfileId);

  // If the link was auto-confirmed (high-confidence match), sync the
  // alkatera brand's live data immediately so the distributor sees
  // richer data right away. For brand-confirmation-required matches,
  // sync runs when the brand confirms (see /api/brand/distributors).
  if (confirmedNow) {
    try {
      await syncAlkateraDataForBrand(supabase, brandProfileId);
    } catch {
      // best-effort — daily cron will retry
    }
  }

  // In-app notification for the distributor (best-effort).
  try {
    await createDistributorNotification({
      supabase,
      distributorOrgId: (brand as { distributor_org_id: string }).distributor_org_id,
      brandProfileId,
      type: 'brand_joined_alkatera',
      title: `${(brand as { name: string }).name} is on alka**tera**`,
      body: args.needsBrandConfirmation
        ? `We've requested confirmation from the brand. Their data tier will upgrade once they accept.`
        : `Their data has been upgraded to Tier ${tier} and is now syncing live.`,
      linkUrl: `/distributor/brands/${brandProfileId}`,
    });
  } catch {
    // swallow — non-blocking
  }

  // Brand-side email (best-effort).
  try {
    await sendNewLinkEmailToBrand(supabase, alkateraOrgId, {
      distributorName:
        (await supabase
          .from('distributor_organizations')
          .select('name')
          .eq('id', (brand as { distributor_org_id: string }).distributor_org_id)
          .maybeSingle()).data?.name ?? 'A distributor',
      alkateraOrgName: (org as { name: string }).name,
      needsBrandConfirmation: args.needsBrandConfirmation,
    });
  } catch {
    // swallow
  }

  return { ok: true, link_id: (link as { id: string }).id, new_tier: tier };
}

export interface UnlinkResult {
  ok: boolean;
  new_tier?: number;
  error?: string;
}

/**
 * Remove a link entirely (distributor-initiated; brands use the
 * sharing_active toggle instead).
 */
export async function removeBrandDistributorLink(
  supabase: SupabaseClient,
  brandProfileId: string,
  alkateraOrgId: string,
): Promise<UnlinkResult> {
  const { error } = await supabase
    .from('brand_distributor_links')
    .delete()
    .eq('brand_profile_id', brandProfileId)
    .eq('alkatera_org_id', alkateraOrgId);
  if (error) return { ok: false, error: error.message };

  // Clear the alkatera_org_id pointer on the brand_profile.
  await supabase.from('brand_profiles').update({ alkatera_org_id: null }).eq('id', brandProfileId);

  const tier = await syncBrandTier(supabase, brandProfileId);
  return { ok: true, new_tier: tier };
}

/**
 * Recompute brand_profiles.alkatera_tier from the current link + submission
 * state. Returns the new tier value.
 */
export async function syncBrandTier(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<number> {
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, first_submission_at, alkatera_tier, distributor_org_id, name')
    .eq('id', brandProfileId)
    .maybeSingle();
  if (!brand) return 1;

  const { data: link } = await supabase
    .from('brand_distributor_links')
    .select('alkatera_org_id, confirmed_by_brand, sharing_active')
    .eq('brand_profile_id', brandProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let alkateraFullAccount = false;
  if (link && (link as { alkatera_org_id: string }).alkatera_org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_status, subscription_tier')
      .eq('id', (link as { alkatera_org_id: string }).alkatera_org_id)
      .maybeSingle();
    if (org) {
      alkateraFullAccount =
        (org as { subscription_status?: string | null }).subscription_status === 'active' ||
        (org as { subscription_status?: string | null }).subscription_status === 'trialing';
    }
  }

  const newTier = calculateAlkateraTier({
    has_submission: !!(brand as { first_submission_at: string | null }).first_submission_at,
    is_linked: !!link && (link as { sharing_active: boolean }).sharing_active,
    link_confirmed: !!link && (link as { confirmed_by_brand: boolean }).confirmed_by_brand && (link as { sharing_active: boolean }).sharing_active,
    alkatera_full_account: alkateraFullAccount,
  });

  const previousTier = (brand as { alkatera_tier: number }).alkatera_tier;
  if (newTier !== previousTier) {
    await supabase.from('brand_profiles').update({ alkatera_tier: newTier }).eq('id', brandProfileId);

    if (newTier > previousTier) {
      try {
        await createDistributorNotification({
          supabase,
          distributorOrgId: (brand as { distributor_org_id: string }).distributor_org_id,
          brandProfileId,
          type: 'brand_tier_upgraded',
          title: `${(brand as { name: string }).name} moved to Tier ${newTier}`,
          body: `Up from Tier ${previousTier}. New verified data may now be available.`,
          linkUrl: `/distributor/brands/${brandProfileId}`,
        });
      } catch {
        // best-effort
      }
    }
  }
  return newTier;
}

/**
 * Attempt a match for one brand and act on the result. Used by the
 * matching cron and the Phase 1 confirm route. Returns the action taken.
 */
export async function attemptAutoMatch(
  supabase: SupabaseClient,
  brand: BrandForMatching,
): Promise<{ action: 'linked' | 'suggested' | 'no_match'; org_id?: string; confidence?: number }> {
  const match = await findAlkateraOrgMatch(supabase, brand);
  if (!match) return { action: 'no_match' };

  if (match.confidence >= MATCH_THRESHOLDS.AUTO_LINK) {
    await createBrandDistributorLink({
      supabase,
      brandProfileId: brand.id,
      alkateraOrgId: match.org_id,
      matchMethod: match.method,
      matchConfidence: match.confidence,
      needsBrandConfirmation: false,
    });
    return { action: 'linked', org_id: match.org_id, confidence: match.confidence };
  }

  // Lower-confidence match → file a "pending match" notification so the
  // distributor can confirm or dismiss it. We never auto-create a link
  // below the threshold.
  try {
    const { data: brandRow } = await supabase
      .from('brand_profiles')
      .select('distributor_org_id, name')
      .eq('id', brand.id)
      .maybeSingle();
    if (brandRow) {
      await createDistributorNotification({
        supabase,
        distributorOrgId: (brandRow as { distributor_org_id: string }).distributor_org_id,
        brandProfileId: brand.id,
        type: 'pending_match',
        title: `Possible match: ${match.org_name}`,
        body: `${(brandRow as { name: string }).name} may be the alkatera-registered ${match.org_name} (${Math.round(match.confidence * 100)}% similarity). Review the suggestion to confirm.`,
        linkUrl: `/distributor/brands/pending-matches`,
      });
    }
  } catch {
    // best-effort
  }

  return { action: 'suggested', org_id: match.org_id, confidence: match.confidence };
}
