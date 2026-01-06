import { getSupabaseServerClient } from './supabase/server-client';
import { SubscriptionTier, TIER_PRICING } from './stripe-config';

/**
 * Subscription Limits and Usage Tracking
 *
 * This module provides functions to check and enforce subscription tier limits.
 * It uses the existing Supabase RPC functions for database operations.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type LimitType =
  | 'products'
  | 'lcas'
  | 'reports'
  | 'teamMembers'
  | 'facilities'
  | 'suppliers';

export interface UsageLimitCheck {
  allowed: boolean;
  reason: string | null;
  current: number;
  max: number | null;
  isUnlimited: boolean;
  tier: SubscriptionTier;
}

export interface OrganizationUsage {
  tier: {
    name: SubscriptionTier;
    level: number;
    display_name: string;
    status: string;
  };
  usage: {
    products: { current: number; max: number | null; is_unlimited: boolean };
    reports_monthly: {
      current: number;
      max: number | null;
      is_unlimited: boolean;
      resets_at: string;
    };
    lcas: { current: number; max: number | null; is_unlimited: boolean };
    team_members: { current: number; max: number | null; is_unlimited: boolean };
    facilities: { current: number; max: number | null; is_unlimited: boolean };
    suppliers: { current: number; max: number | null; is_unlimited: boolean };
  };
  features: any;
}

// ============================================================================
// Usage Checking Functions
// ============================================================================

/**
 * Check if organization can create a product
 */
export async function checkProductLimit(
  organizationId: string
): Promise<UsageLimitCheck> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('check_product_limit', {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error('Error checking product limit:', error);
    return {
      allowed: false,
      reason: 'Failed to check product limit',
      current: 0,
      max: 0,
      isUnlimited: false,
      tier: 'seed',
    };
  }

  return {
    allowed: data.allowed,
    reason: data.reason,
    current: data.current_count,
    max: data.max_count,
    isUnlimited: data.is_unlimited,
    tier: data.tier,
  };
}

/**
 * Check if organization can create an LCA
 */
export async function checkLCALimit(organizationId: string): Promise<UsageLimitCheck> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('check_lca_limit', {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error('Error checking LCA limit:', error);
    return {
      allowed: false,
      reason: 'Failed to check LCA limit',
      current: 0,
      max: 0,
      isUnlimited: false,
      tier: 'seed',
    };
  }

  return {
    allowed: data.allowed,
    reason: data.reason,
    current: data.current_count,
    max: data.max_count,
    isUnlimited: data.is_unlimited,
    tier: data.tier,
  };
}

/**
 * Check if organization can generate a report
 */
export async function checkReportLimit(
  organizationId: string
): Promise<UsageLimitCheck> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('check_report_limit', {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error('Error checking report limit:', error);
    return {
      allowed: false,
      reason: 'Failed to check report limit',
      current: 0,
      max: 0,
      isUnlimited: false,
      tier: 'seed',
    };
  }

  return {
    allowed: data.allowed,
    reason: data.reason,
    current: data.current_count,
    max: data.max_count,
    isUnlimited: data.is_unlimited,
    tier: data.tier,
  };
}

/**
 * Check if organization has access to a specific feature
 */
export async function checkFeatureAccess(
  organizationId: string,
  featureCode: string
): Promise<{ allowed: boolean; reason: string | null; tier: SubscriptionTier }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('check_feature_access', {
    p_organization_id: organizationId,
    p_feature_code: featureCode,
  });

  if (error) {
    console.error('Error checking feature access:', error);
    return {
      allowed: false,
      reason: 'Failed to check feature access',
      tier: 'seed',
    };
  }

  return {
    allowed: data.allowed,
    reason: data.reason,
    tier: data.tier,
  };
}

/**
 * Get complete organization usage summary
 */
export async function getOrganizationUsage(
  organizationId: string
): Promise<OrganizationUsage | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_organization_usage', {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error('Error getting organization usage:', error);
    return null;
  }

  return data as OrganizationUsage;
}

/**
 * Increment product count (called after creating a product)
 */
export async function incrementProductCount(
  organizationId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('increment_product_count', {
    p_organization_id: organizationId,
    p_user_id: userId || null,
  });

  if (error) {
    console.error('Error incrementing product count:', error);
    return { success: false, error: error.message };
  }

  if (!data.allowed) {
    return { success: false, error: data.reason };
  }

  return { success: true };
}

/**
 * Increment LCA count (called after creating an LCA)
 */
export async function incrementLCACount(
  organizationId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('increment_lca_count', {
    p_organization_id: organizationId,
    p_user_id: userId || null,
  });

  if (error) {
    console.error('Error incrementing LCA count:', error);
    return { success: false, error: error.message };
  }

  if (!data.allowed) {
    return { success: false, error: data.reason };
  }

  return { success: true };
}

/**
 * Increment report count (called after generating a report)
 */
export async function incrementReportCount(
  organizationId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('increment_report_count', {
    p_organization_id: organizationId,
    p_user_id: userId || null,
  });

  if (error) {
    console.error('Error incrementing report count:', error);
    return { success: false, error: error.message };
  }

  if (!data.allowed) {
    return { success: false, error: data.reason };
  }

  return { success: true };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate usage percentage for display
 */
export function calculateUsagePercentage(current: number, max: number | null): number {
  if (max === null) return 0; // Unlimited
  if (max === 0) return 100;
  return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Get usage status color for UI
 */
export function getUsageStatusColor(percentage: number): string {
  if (percentage < 70) return 'green';
  if (percentage < 90) return 'yellow';
  return 'red';
}

/**
 * Check if organization is approaching limit
 */
export function isApproachingLimit(current: number, max: number | null): boolean {
  if (max === null) return false; // Unlimited
  return current >= max * 0.8; // 80% threshold
}

/**
 * Get tier limits from configuration
 */
export function getTierLimits(tier: SubscriptionTier) {
  return TIER_PRICING[tier].limits;
}
