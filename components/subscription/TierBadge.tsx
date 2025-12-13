"use client";

import React from "react";
import { Leaf, Flower2, TreeDeciduous } from "lucide-react";
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
        ? "seed"
        : tier === 2
        ? "blossom"
        : "canopy"
      : tier;

  const config = {
    seed: {
      label: "Seed",
      icon: Leaf,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    blossom: {
      label: "Blossom",
      icon: Flower2,
      className: "bg-pink-50 text-pink-700 border-pink-200",
    },
    canopy: {
      label: "Canopy",
      icon: TreeDeciduous,
      className: "bg-teal-50 text-teal-700 border-teal-200",
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
