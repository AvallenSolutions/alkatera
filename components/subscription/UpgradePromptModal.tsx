"use client";

import React from "react";
import {
  Check,
  Crown,
  Gem,
  Lock,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { TierName, TierLimits, useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  feature?: string;
  limitType?: "products" | "reports" | "lcas" | "team" | "facilities" | "suppliers";
}

export function UpgradePromptModal({
  open,
  onOpenChange,
  reason,
  feature,
  limitType,
}: UpgradePromptModalProps) {
  const { tierName, allTiers, getUpgradeTier } = useSubscription();
  const upgradeTier = getUpgradeTier();

  const limitMessages: Record<string, string> = {
    products: "You've reached your product limit",
    reports: "You've reached your monthly report limit",
    lcas: "You've reached your LCA limit",
    team: "You've reached your team member limit",
    facilities: "You've reached your facility limit",
    suppliers: "You've reached your supplier limit",
  };

  const title = limitType
    ? limitMessages[limitType]
    : feature
    ? `Unlock ${feature}`
    : reason || "Upgrade Your Plan";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-neon-lime/20">
            <Zap className="h-8 w-8 text-neon-lime" />
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">
            Upgrade your plan to unlock more features and higher limits
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TierComparisonCard
            tier={allTiers.find((t) => t.tier_name === tierName) || allTiers[0]}
            isCurrent
          />
          {upgradeTier && (
            <TierComparisonCard tier={upgradeTier} isRecommended />
          )}
        </div>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-blue-600 to-neon-lime text-white hover:opacity-90">
            <Sparkles className="h-4 w-4" />
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TierComparisonCardProps {
  tier: TierLimits;
  isCurrent?: boolean;
  isRecommended?: boolean;
}

function TierComparisonCard({
  tier,
  isCurrent,
  isRecommended,
}: TierComparisonCardProps) {
  const tierIcons: Record<TierName, React.ComponentType<{ className?: string }>> = {
    basic: Star,
    premium: Gem,
    enterprise: Crown,
  };

  const Icon = tierIcons[tier.tier_name];

  const features = [
    {
      label: "Products",
      value: tier.max_products ?? "Unlimited",
    },
    {
      label: "Reports/month",
      value: tier.max_reports_per_month ?? "Unlimited",
    },
    {
      label: "LCAs",
      value: tier.max_lcas ?? "Unlimited",
    },
    {
      label: "Team members",
      value: tier.max_team_members ?? "Unlimited",
    },
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4",
        isRecommended && "border-neon-lime bg-neon-lime/5",
        isCurrent && "border-muted bg-muted/30"
      )}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-neon-lime px-3 py-1 text-xs font-medium text-black">
            Recommended
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-muted-foreground/20 px-3 py-1 text-xs font-medium">
            Current Plan
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 pt-2">
        <Icon
          className={cn(
            "h-5 w-5",
            isRecommended ? "text-neon-lime" : "text-muted-foreground"
          )}
        />
        <span className="font-semibold">{tier.display_name}</span>
      </div>

      <ul className="space-y-2">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-center gap-2 text-sm">
            <Check
              className={cn(
                "h-4 w-4 flex-shrink-0",
                isRecommended ? "text-neon-lime" : "text-muted-foreground"
              )}
            />
            <span className="text-muted-foreground">{feature.label}:</span>
            <span className="font-medium">{feature.value}</span>
          </li>
        ))}
      </ul>

      {tier.monthly_price_gbp && (
        <div className="mt-4 border-t pt-4">
          <span className="text-2xl font-bold">
            £{tier.monthly_price_gbp}
          </span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>
      )}
    </div>
  );
}

interface LimitReachedBannerProps {
  type: "products" | "reports" | "lcas";
  current: number;
  max: number;
  onUpgrade: () => void;
  className?: string;
}

export function LimitReachedBanner({
  type,
  current,
  max,
  onUpgrade,
  className,
}: LimitReachedBannerProps) {
  const messages = {
    products: "product",
    reports: "report",
    lcas: "LCA",
  };

  const isAtLimit = current >= max;
  const isNearLimit = current >= max * 0.8;

  if (!isNearLimit) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-4",
        isAtLimit
          ? "border-destructive/50 bg-destructive/10"
          : "border-amber-500/50 bg-amber-500/10",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            isAtLimit ? "bg-destructive/20" : "bg-amber-500/20"
          )}
        >
          <Lock
            className={cn(
              "h-5 w-5",
              isAtLimit ? "text-destructive" : "text-amber-500"
            )}
          />
        </div>
        <div>
          <p className="font-medium">
            {isAtLimit
              ? `${messages[type].charAt(0).toUpperCase() + messages[type].slice(1)} limit reached`
              : `Approaching ${messages[type]} limit`}
          </p>
          <p className="text-sm text-muted-foreground">
            {current} of {max} {messages[type]}s used
          </p>
        </div>
      </div>
      <Button onClick={onUpgrade} size="sm" className="gap-2">
        <Sparkles className="h-4 w-4" />
        Upgrade
      </Button>
    </div>
  );
}
