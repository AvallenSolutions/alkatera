"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, HelpCircle, Shield, TrendingUp } from "lucide-react";

interface DataQualityIndicatorProps {
  quality: "Primary" | "Secondary" | "Tertiary" | "Estimated" | "Provisional" | "Verified" | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const qualityConfig = {
  Primary: {
    color: "bg-green-500/20 text-green-300 border-green-500/50",
    icon: CheckCircle2,
    label: "Primary",
    description: "Direct measurement data from source",
    score: 100,
  },
  Secondary: {
    color: "bg-blue-500/20 text-blue-300 border-blue-500/50",
    icon: TrendingUp,
    label: "Secondary",
    description: "Industry-specific emission factors",
    score: 75,
  },
  Tertiary: {
    color: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    icon: AlertCircle,
    label: "Tertiary",
    description: "Generic emission factors or averages",
    score: 50,
  },
  Estimated: {
    color: "bg-orange-500/20 text-orange-300 border-orange-500/50",
    icon: HelpCircle,
    label: "Estimated",
    description: "Estimated values based on approximations",
    score: 30,
  },
  Provisional: {
    color: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    icon: AlertCircle,
    label: "Provisional",
    description: "Awaiting verification",
    score: 60,
  },
  Verified: {
    color: "bg-green-500/20 text-green-300 border-green-500/50",
    icon: Shield,
    label: "Verified",
    description: "Verified and approved data",
    score: 100,
  },
};

export function DataQualityIndicator({
  quality,
  size = "md",
  showLabel = true,
  className = "",
}: DataQualityIndicatorProps) {
  const config = qualityConfig[quality as keyof typeof qualityConfig] || {
    color: "bg-slate-500/20 text-slate-300 border-slate-500/50",
    icon: HelpCircle,
    label: quality || "Unknown",
    description: "Data quality information not available",
    score: 0,
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs h-5",
    md: "text-sm h-6",
    lg: "text-base h-7",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`
              ${config.color}
              ${sizeClasses[size]}
              ${className}
              cursor-help
              transition-all
              hover:scale-105
            `}
          >
            <Icon className={`${iconSizes[size]} ${showLabel ? "mr-1" : ""}`} />
            {showLabel && config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-white">{config.label}</span>
              <Badge className={config.color}>Score: {config.score}</Badge>
            </div>
            <p className="text-xs text-slate-300 max-w-xs">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface PeriodAlignmentIndicatorProps {
  facilityPeriod: { start: string; end: string };
  productPeriod: { start: string; end: string };
  size?: "sm" | "md" | "lg";
}

export function PeriodAlignmentIndicator({
  facilityPeriod,
  productPeriod,
  size = "md",
}: PeriodAlignmentIndicatorProps) {
  const facilityStart = new Date(facilityPeriod.start);
  const facilityEnd = new Date(facilityPeriod.end);
  const productStart = new Date(productPeriod.start);
  const productEnd = new Date(productPeriod.end);

  // Calculate overlap
  const overlapStart = new Date(Math.max(facilityStart.getTime(), productStart.getTime()));
  const overlapEnd = new Date(Math.min(facilityEnd.getTime(), productEnd.getTime()));

  const hasOverlap = overlapStart <= overlapEnd;

  if (!hasOverlap) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-500/20 text-red-300 border-red-500/50 cursor-help">
              <AlertCircle className="h-3 w-3 mr-1" />
              No Overlap
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
            <div className="space-y-2">
              <p className="font-medium text-white">Period Misalignment</p>
              <p className="text-xs text-slate-300">
                Facility and product reporting periods do not overlap.
              </p>
              <div className="text-xs text-slate-400 space-y-1 mt-2">
                <div>Facility: {facilityPeriod.start} to {facilityPeriod.end}</div>
                <div>Product: {productPeriod.start} to {productPeriod.end}</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Calculate overlap percentage
  const facilityDuration = facilityEnd.getTime() - facilityStart.getTime();
  const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();
  const overlapPercentage = Math.round((overlapDuration / facilityDuration) * 100);

  const getAlignmentConfig = () => {
    if (overlapPercentage >= 90) {
      return {
        color: "bg-green-500/20 text-green-300 border-green-500/50",
        icon: CheckCircle2,
        label: "Fully Aligned",
        description: "Reporting periods are well aligned",
      };
    } else if (overlapPercentage >= 50) {
      return {
        color: "bg-amber-500/20 text-amber-300 border-amber-500/50",
        icon: AlertCircle,
        label: "Partial",
        description: "Some period misalignment exists",
      };
    } else {
      return {
        color: "bg-orange-500/20 text-orange-300 border-orange-500/50",
        icon: AlertCircle,
        label: "Low Overlap",
        description: "Significant period misalignment",
      };
    }
  };

  const config = getAlignmentConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.color} cursor-help`}>
            <Icon className="h-3 w-3 mr-1" />
            {overlapPercentage}% Aligned
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
          <div className="space-y-2">
            <p className="font-medium text-white">{config.label}</p>
            <p className="text-xs text-slate-300">{config.description}</p>
            <div className="text-xs text-slate-400 space-y-1 mt-2">
              <div>Facility: {facilityPeriod.start} to {facilityPeriod.end}</div>
              <div>Product: {productPeriod.start} to {productPeriod.end}</div>
              <div className="text-lime-400 font-medium mt-2">
                Overlap: {Math.ceil(overlapDuration / (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
