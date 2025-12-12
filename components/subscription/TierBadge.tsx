"use client";

import React from "react";
import { Crown, Gem, Star } from "lucide-react";
import { TierName, TierLevel } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TierBadgeProps {
  tier: TierName | TierLevel;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function TierBadge({
  tier,
  size = "md",
  showIcon = true,
  className,
}: TierBadgeProps) {
  const tierName: TierName =
    typeof tier === "number"
      ? tier === 1
        ? "basic"
        : tier === 2
        ? "premium"
        : "enterprise"
      : tier;

  const config = {
    basic: {
      label: "Starter",
      icon: Star,
      className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    premium: {
      label: "Professional",
      icon: Gem,
      className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    enterprise: {
      label: "Enterprise",
      icon: Crown,
      className: "bg-amber-100 text-amber-700 border-amber-200",
    },
  };

  const { label, icon: Icon, className: tierClassName } = config[tierName];

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        tierClassName,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("mr-1", iconSizes[size])} />}
      {label}
    </Badge>
  );
}

interface TierLevelIndicatorProps {
  level: TierLevel;
  className?: string;
}

export function TierLevelIndicator({
  level,
  className,
}: TierLevelIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3].map((l) => (
        <div
          key={l}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            l <= level ? "bg-neon-lime" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
