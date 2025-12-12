"use client";

import React from "react";
import { AlertTriangle, Check, Infinity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UsageMeterProps {
  label: string;
  current: number;
  max: number | null;
  isUnlimited?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UsageMeter({
  label,
  current,
  max,
  isUnlimited = false,
  showLabel = true,
  size = "md",
  className,
}: UsageMeterProps) {
  const percentage = isUnlimited || !max ? 0 : Math.min((current / max) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  const sizeClasses = {
    sm: { height: "h-1.5", text: "text-xs" },
    md: { height: "h-2", text: "text-sm" },
    lg: { height: "h-3", text: "text-base" },
  };

  const getProgressColor = () => {
    if (isUnlimited) return "bg-neon-lime";
    if (isAtLimit) return "bg-destructive";
    if (isNearLimit) return "bg-amber-500";
    return "bg-neon-lime";
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className={cn("text-muted-foreground", sizeClasses[size].text)}>
            {label}
          </span>
          <span className={cn("font-medium", sizeClasses[size].text)}>
            {isUnlimited ? (
              <span className="flex items-center gap-1">
                {current} <Infinity className="h-3.5 w-3.5 text-neon-lime" />
              </span>
            ) : (
              <span
                className={cn(
                  isAtLimit && "text-destructive",
                  isNearLimit && !isAtLimit && "text-amber-500"
                )}
              >
                {current} / {max}
              </span>
            )}
          </span>
        </div>
      )}
      {!isUnlimited && max && (
        <div className="relative">
          <Progress
            value={percentage}
            className={cn(sizeClasses[size].height, "bg-muted")}
          />
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-all",
              sizeClasses[size].height,
              getProgressColor()
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface UsageMeterCompactProps {
  current: number;
  max: number | null;
  isUnlimited?: boolean;
  className?: string;
}

export function UsageMeterCompact({
  current,
  max,
  isUnlimited = false,
  className,
}: UsageMeterCompactProps) {
  const percentage = isUnlimited || !max ? 0 : Math.min((current / max) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <span className="text-xs text-muted-foreground">
              {isUnlimited ? (
                <span className="flex items-center gap-1">
                  {current}
                  <Infinity className="h-3 w-3 text-neon-lime" />
                </span>
              ) : (
                <span
                  className={cn(
                    isAtLimit && "text-destructive font-medium",
                    isNearLimit && !isAtLimit && "text-amber-500 font-medium"
                  )}
                >
                  {current}/{max}
                </span>
              )}
            </span>
            {!isUnlimited && (
              <>
                {isAtLimit && (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}
                {isNearLimit && !isAtLimit && (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
                {!isNearLimit && (
                  <Check className="h-3 w-3 text-neon-lime" />
                )}
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isUnlimited
              ? "Unlimited usage"
              : isAtLimit
              ? "Limit reached - upgrade to continue"
              : isNearLimit
              ? "Approaching limit"
              : `${max! - current} remaining`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface UsageStatsGridProps {
  usage: {
    products: { current: number; max: number | null; is_unlimited: boolean };
    reports_monthly: { current: number; max: number | null; is_unlimited: boolean };
    lcas: { current: number; max: number | null; is_unlimited: boolean };
    team_members: { current: number; max: number | null; is_unlimited: boolean };
    facilities: { current: number; max: number | null; is_unlimited: boolean };
    suppliers: { current: number; max: number | null; is_unlimited: boolean };
  };
  className?: string;
}

export function UsageStatsGrid({ usage, className }: UsageStatsGridProps) {
  const stats = [
    { label: "Products", ...usage.products },
    { label: "Reports (Monthly)", ...usage.reports_monthly },
    { label: "LCAs", ...usage.lcas },
    { label: "Team Members", ...usage.team_members },
    { label: "Facilities", ...usage.facilities },
    { label: "Suppliers", ...usage.suppliers },
  ];

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border bg-card p-4 shadow-sm"
        >
          <UsageMeter
            label={stat.label}
            current={stat.current}
            max={stat.max}
            isUnlimited={stat.is_unlimited}
          />
        </div>
      ))}
    </div>
  );
}
