"use client";

import React from "react";
import { Lock, Sparkles } from "lucide-react";
import { useFeatureGate, FeatureCode, TierName } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FeatureGateProps {
  feature: FeatureCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockIcon?: boolean;
  showUpgradePrompt?: boolean;
  className?: string;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showLockIcon = true,
  showUpgradePrompt = true,
  className,
}: FeatureGateProps) {
  const { isEnabled, isLoading, currentTier, requiredTierForFeature } =
    useFeatureGate(feature);

  if (isLoading) {
    return <div className={cn("animate-pulse bg-muted rounded", className)} />;
  }

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <LockedFeatureCard
      feature={feature}
      currentTier={currentTier}
      requiredTier={requiredTierForFeature}
      showLockIcon={showLockIcon}
      className={className}
    />
  );
}

interface LockedFeatureCardProps {
  feature: FeatureCode;
  currentTier: TierName;
  requiredTier: TierName;
  showLockIcon?: boolean;
  className?: string;
}

function LockedFeatureCard({
  feature,
  currentTier,
  requiredTier,
  showLockIcon = true,
  className,
}: LockedFeatureCardProps) {
  const featureNames: Record<FeatureCode, string> = {
    recipe_2016: "ReCiPe 2016 Methodology",
    ef_31: "EF 3.1 Methodology",
    ef_31_single_score: "EF 3.1 Single Score",
    custom_weighting: "Custom Weighting Sets",
    pef_reports: "PEF Compliance Reports",
    api_access: "API Access",
    product_comparison: "Product Comparison",
    white_label: "White-label Reports",
    ghg_emissions: "GHG Emissions Module",
    water_footprint: "Water Footprint Module",
    waste_circularity: "Waste & Circularity Module",
    biodiversity_tracking: "Biodiversity Module",
    b_corp_assessment: "B Corp Assessment",
    live_passport: "Live Passport Analytics",
    monthly_analytics: "Monthly Analytics",
    sandbox_analytics: "Sandbox Environment",
    email_support: "Email Support",
    priority_chat: "Priority Chat Support",
    automated_verification: "Automated Verification",
    verified_data: "Verified Data",
  };

  const tierDisplayNames: Record<TierName, string> = {
    seed: "Seed",
    blossom: "Blossom",
    canopy: "Canopy",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center",
        className
      )}
    >
      {showLockIcon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h4 className="mb-1 text-sm font-medium">{featureNames[feature]}</h4>
      <p className="mb-4 text-xs text-muted-foreground">
        Available on {tierDisplayNames[requiredTier]} plan and above
      </p>
      <Button size="sm" variant="default" className="gap-2">
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade to {tierDisplayNames[requiredTier]}
      </Button>
    </div>
  );
}

interface FeatureGateInlineProps {
  feature: FeatureCode;
  children: React.ReactNode;
  lockedContent?: React.ReactNode;
}

export function FeatureGateInline({
  feature,
  children,
  lockedContent,
}: FeatureGateInlineProps) {
  const { isEnabled, isLoading, requiredTierForFeature } =
    useFeatureGate(feature);

  if (isLoading) {
    return <span className="animate-pulse bg-muted rounded px-2">...</span>;
  }

  if (isEnabled) {
    return <>{children}</>;
  }

  if (lockedContent) {
    return <>{lockedContent}</>;
  }

  const tierDisplayNames: Record<TierName, string> = {
    seed: "Seed",
    blossom: "Blossom",
    canopy: "Canopy",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span className="line-through opacity-50">{children}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Upgrade to {tierDisplayNames[requiredTierForFeature]} to unlock this
            feature
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FeatureLockIconProps {
  feature: FeatureCode;
  className?: string;
}

export function FeatureLockIcon({ feature, className }: FeatureLockIconProps) {
  const { isEnabled, requiredTierForFeature } = useFeatureGate(feature);

  if (isEnabled) {
    return null;
  }

  const tierDisplayNames: Record<TierName, string> = {
    seed: "Seed",
    blossom: "Blossom",
    canopy: "Canopy",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className={cn("h-3 w-3 text-muted-foreground", className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p>Requires {tierDisplayNames[requiredTierForFeature]} plan</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
