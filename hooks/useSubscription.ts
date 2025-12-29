"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";

export type FeatureCode =
  | "recipe_2016"
  | "ef_31"
  | "ef_31_single_score"
  | "custom_weighting"
  | "pef_reports"
  | "api_access"
  | "product_comparison"
  | "white_label"
  | "ghg_emissions"
  | "water_footprint"
  | "waste_circularity"
  | "biodiversity_tracking"
  | "b_corp_assessment"
  | "live_passport"
  | "monthly_analytics"
  | "sandbox_analytics"
  | "email_support"
  | "priority_chat"
  | "automated_verification"
  | "verified_data"
  | "vehicle_registry"
  | "fleet_reporting";

export type TierName = "seed" | "blossom" | "canopy";
export type TierLevel = 1 | 2 | 3;

export interface UsageInfo {
  current: number;
  max: number | null;
  is_unlimited: boolean;
  resets_at?: string;
}

export interface TierInfo {
  name: TierName;
  level: TierLevel;
  display_name: string;
  status: string;
}

export interface OrganizationUsage {
  tier: TierInfo;
  usage: {
    products: UsageInfo;
    reports_monthly: UsageInfo;
    lcas: UsageInfo;
    team_members: UsageInfo;
    facilities: UsageInfo;
    suppliers: UsageInfo;
  };
  features: FeatureCode[];
}

export interface TierLimits {
  tier_name: TierName;
  tier_level: TierLevel;
  display_name: string;
  max_products: number | null;
  max_reports_per_month: number | null;
  max_team_members: number | null;
  max_facilities: number | null;
  max_suppliers: number | null;
  max_lcas: number | null;
  features_enabled: FeatureCode[];
  description: string;
  monthly_price_gbp: number | null;
  annual_price_gbp: number | null;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason: string | null;
  current_count: number;
  max_count: number | null;
  tier: TierName;
  is_unlimited: boolean;
}

export interface FeatureCheckResult {
  allowed: boolean;
  reason: string | null;
  tier: TierName;
  feature: FeatureCode;
}

interface SubscriptionState {
  usage: OrganizationUsage | null;
  allTiers: TierLimits[];
  isLoading: boolean;
  error: string | null;
}

export function useSubscription() {
  const { currentOrganization } = useOrganization();
  const [state, setState] = useState<SubscriptionState>({
    usage: null,
    allTiers: [],
    isLoading: true,
    error: null,
  });

  const fetchSubscriptionData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setState((prev) => ({
        ...prev,
        usage: null,
        isLoading: false,
      }));
      return;
    }

    try {
      const [usageResult, tiersResult] = await Promise.all([
        supabase.rpc("get_organization_usage", {
          p_organization_id: currentOrganization.id,
        }),
        supabase
          .from("subscription_tier_limits")
          .select("*")
          .eq("is_active", true)
          .order("tier_level"),
      ]);

      if (usageResult.error) {
        console.error("Error fetching usage:", usageResult.error);
        setState((prev) => ({
          ...prev,
          error: usageResult.error.message,
          isLoading: false,
        }));
        return;
      }

      setState({
        usage: usageResult.data as OrganizationUsage,
        allTiers: (tiersResult.data as TierLimits[]) || [],
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching subscription data:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to load subscription data",
        isLoading: false,
      }));
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const checkFeatureAccess = useCallback(
    async (featureCode: FeatureCode): Promise<FeatureCheckResult> => {
      if (!currentOrganization?.id) {
        return {
          allowed: false,
          reason: "No organisation selected",
          tier: "seed",
          feature: featureCode,
        };
      }

      const { data, error } = await supabase.rpc("check_feature_access", {
        p_organization_id: currentOrganization.id,
        p_feature_code: featureCode,
      });

      if (error) {
        return {
          allowed: false,
          reason: error.message,
          tier: "seed",
          feature: featureCode,
        };
      }

      return data as FeatureCheckResult;
    },
    [currentOrganization?.id]
  );

  const checkProductLimit = useCallback(async (): Promise<LimitCheckResult> => {
    if (!currentOrganization?.id) {
      return {
        allowed: false,
        reason: "No organisation selected",
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    const { data, error } = await supabase.rpc("check_product_limit", {
      p_organization_id: currentOrganization.id,
    });

    if (error) {
      return {
        allowed: false,
        reason: error.message,
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    return data as LimitCheckResult;
  }, [currentOrganization?.id]);

  const checkReportLimit = useCallback(async (): Promise<LimitCheckResult> => {
    if (!currentOrganization?.id) {
      return {
        allowed: false,
        reason: "No organisation selected",
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    const { data, error } = await supabase.rpc("check_report_limit", {
      p_organization_id: currentOrganization.id,
    });

    if (error) {
      return {
        allowed: false,
        reason: error.message,
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    return data as LimitCheckResult;
  }, [currentOrganization?.id]);

  const checkLcaLimit = useCallback(async (): Promise<LimitCheckResult> => {
    if (!currentOrganization?.id) {
      return {
        allowed: false,
        reason: "No organisation selected",
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    const { data, error } = await supabase.rpc("check_lca_limit", {
      p_organization_id: currentOrganization.id,
    });

    if (error) {
      return {
        allowed: false,
        reason: error.message,
        current_count: 0,
        max_count: 0,
        tier: "seed",
        is_unlimited: false,
      };
    }

    return data as LimitCheckResult;
  }, [currentOrganization?.id]);

  const hasFeature = useCallback(
    (featureCode: FeatureCode): boolean => {
      if (!state.usage?.features) return false;
      return state.usage.features.includes(featureCode);
    },
    [state.usage?.features]
  );

  const getTierLevel = useCallback((): TierLevel => {
    return state.usage?.tier?.level || 1;
  }, [state.usage?.tier?.level]);

  const isAtLeastTier = useCallback(
    (minTier: TierLevel): boolean => {
      return getTierLevel() >= minTier;
    },
    [getTierLevel]
  );

  const getUsagePercentage = useCallback(
    (usageType: keyof OrganizationUsage["usage"]): number => {
      const usage = state.usage?.usage?.[usageType];
      if (!usage || usage.is_unlimited || !usage.max) return 0;
      return Math.round((usage.current / usage.max) * 100);
    },
    [state.usage?.usage]
  );

  const isNearLimit = useCallback(
    (usageType: keyof OrganizationUsage["usage"], threshold = 80): boolean => {
      return getUsagePercentage(usageType) >= threshold;
    },
    [getUsagePercentage]
  );

  const getUpgradeTier = useCallback((): TierLimits | null => {
    const currentLevel = getTierLevel();
    if (currentLevel >= 3) return null;
    return state.allTiers.find((t) => t.tier_level === currentLevel + 1) || null;
  }, [getTierLevel, state.allTiers]);

  const refresh = useCallback(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  return {
    ...state,
    tierName: state.usage?.tier?.name || "seed",
    tierLevel: state.usage?.tier?.level || 1,
    tierDisplayName: state.usage?.tier?.display_name || "Seed",
    subscriptionStatus: state.usage?.tier?.status || "active",
    hasFeature,
    getTierLevel,
    isAtLeastTier,
    getUsagePercentage,
    isNearLimit,
    getUpgradeTier,
    checkFeatureAccess,
    checkProductLimit,
    checkReportLimit,
    checkLcaLimit,
    refresh,
  };
}

export function useFeatureGate(featureCode: FeatureCode) {
  const { hasFeature, isLoading, tierName, getUpgradeTier } = useSubscription();
  const isEnabled = hasFeature(featureCode);
  const upgradeTier = getUpgradeTier();

  return {
    isEnabled,
    isLoading,
    currentTier: tierName,
    upgradeTier,
    requiredTierForFeature: getRequiredTierForFeature(featureCode),
  };
}

function getRequiredTierForFeature(featureCode: FeatureCode): TierName {
  const blossomFeatures: FeatureCode[] = [
    "ef_31",
    "ef_31_single_score",
    "water_footprint",
    "waste_circularity",
    "monthly_analytics",
    "product_comparison",
    "vehicle_registry",
    "fleet_reporting",
  ];
  const canopyFeatures: FeatureCode[] = [
    "custom_weighting",
    "white_label",
    "biodiversity_tracking",
    "b_corp_assessment",
    "sandbox_analytics",
    "priority_chat",
    "verified_data",
    "pef_reports",
    "api_access",
  ];

  if (canopyFeatures.includes(featureCode)) return "canopy";
  if (blossomFeatures.includes(featureCode)) return "blossom";
  return "seed";
}

export function useProductLimit() {
  const { usage, isLoading, checkProductLimit, refresh } = useSubscription();
  const productUsage = usage?.usage?.products;

  return {
    currentCount: productUsage?.current || 0,
    maxCount: productUsage?.max,
    isUnlimited: productUsage?.is_unlimited || false,
    percentage: productUsage?.max
      ? Math.round(((productUsage?.current || 0) / productUsage.max) * 100)
      : 0,
    isLoading,
    checkLimit: checkProductLimit,
    refresh,
  };
}

export function useReportLimit() {
  const { usage, isLoading, checkReportLimit, refresh } = useSubscription();
  const reportUsage = usage?.usage?.reports_monthly;

  return {
    currentCount: reportUsage?.current || 0,
    maxCount: reportUsage?.max,
    isUnlimited: reportUsage?.is_unlimited || false,
    percentage: reportUsage?.max
      ? Math.round(((reportUsage?.current || 0) / reportUsage.max) * 100)
      : 0,
    resetsAt: reportUsage?.resets_at,
    isLoading,
    checkLimit: checkReportLimit,
    refresh,
  };
}

export function useLcaLimit() {
  const { usage, isLoading, checkLcaLimit, refresh } = useSubscription();
  const lcaUsage = usage?.usage?.lcas;

  return {
    currentCount: lcaUsage?.current || 0,
    maxCount: lcaUsage?.max,
    isUnlimited: lcaUsage?.is_unlimited || false,
    percentage: lcaUsage?.max
      ? Math.round(((lcaUsage?.current || 0) / lcaUsage.max) * 100)
      : 0,
    isLoading,
    checkLimit: checkLcaLimit,
    refresh,
  };
}
