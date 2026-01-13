"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Minus,
  type LucideIcon
} from 'lucide-react';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'filled' | 'outline' | 'subtle';
  className?: string;
}

const statusConfig: Record<StatusType, {
  label: string;
  icon: LucideIcon;
  filledClass: string;
  outlineClass: string;
  subtleClass: string;
}> = {
  success: {
    label: 'Complete',
    icon: CheckCircle2,
    filledClass: 'bg-green-500 text-white border-green-500',
    outlineClass: 'border-green-500 text-green-600 dark:text-green-400',
    subtleClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  warning: {
    label: 'Warning',
    icon: AlertCircle,
    filledClass: 'bg-amber-500 text-white border-amber-500',
    outlineClass: 'border-amber-500 text-amber-600 dark:text-amber-400',
    subtleClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    filledClass: 'bg-red-500 text-white border-red-500',
    outlineClass: 'border-red-500 text-red-600 dark:text-red-400',
    subtleClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  info: {
    label: 'Info',
    icon: AlertCircle,
    filledClass: 'bg-blue-500 text-white border-blue-500',
    outlineClass: 'border-blue-500 text-blue-600 dark:text-blue-400',
    subtleClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    filledClass: 'bg-gray-500 text-white border-gray-500',
    outlineClass: 'border-gray-400 text-gray-600 dark:text-gray-400',
    subtleClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  neutral: {
    label: 'N/A',
    icon: Minus,
    filledClass: 'bg-gray-400 text-white border-gray-400',
    outlineClass: 'border-gray-300 text-gray-500',
    subtleClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500',
  },
};

const sizeConfig = {
  sm: { iconSize: 'h-3 w-3', textSize: 'text-xs', padding: 'px-1.5 py-0.5' },
  md: { iconSize: 'h-3.5 w-3.5', textSize: 'text-xs', padding: 'px-2 py-0.5' },
  lg: { iconSize: 'h-4 w-4', textSize: 'text-sm', padding: 'px-2.5 py-1' },
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = 'md',
  variant = 'subtle',
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const variantClass = variant === 'filled'
    ? config.filledClass
    : variant === 'outline'
      ? config.outlineClass
      : config.subtleClass;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium border',
      sizes.padding,
      sizes.textSize,
      variantClass,
      variant === 'subtle' && 'border-transparent',
      className
    )}>
      {showIcon && <Icon className={sizes.iconSize} />}
      <span>{label || config.label}</span>
    </span>
  );
}

interface DataQualityBadgeProps {
  quality: 'primary' | 'secondary' | 'estimated' | 'missing';
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function DataQualityBadge({
  quality,
  showLabel = true,
  size = 'sm',
  className,
}: DataQualityBadgeProps) {
  const config: Record<string, { label: string; colorClass: string; confidence: string }> = {
    primary: {
      label: 'Primary',
      colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      confidence: '95%',
    },
    secondary: {
      label: 'Secondary',
      colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      confidence: '75%',
    },
    estimated: {
      label: 'Estimated',
      colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      confidence: '50%',
    },
    missing: {
      label: 'Missing',
      colorClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      confidence: '0%',
    },
  };

  const { label, colorClass } = config[quality] || config.missing;
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      sizeClass,
      colorClass,
      className
    )}>
      {showLabel ? label : quality.charAt(0).toUpperCase()}
    </span>
  );
}

interface ComplianceBadgeProps {
  standard: 'ISO14044' | 'ISO14067' | 'GHGProtocol' | 'CSRD' | 'ReCiPe' | 'EF31' | 'TNFD';
  status?: 'compliant' | 'partial' | 'pending';
  className?: string;
}

export function ComplianceBadge({
  standard,
  status = 'compliant',
  className,
}: ComplianceBadgeProps) {
  const labels: Record<string, string> = {
    ISO14044: 'ISO 14044',
    ISO14067: 'ISO 14067',
    GHGProtocol: 'GHG Protocol',
    CSRD: 'CSRD',
    ReCiPe: 'ReCiPe 2016',
    EF31: 'EF 3.1',
    TNFD: 'TNFD',
  };

  const statusColors: Record<string, string> = {
    compliant: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
      statusColors[status],
      className
    )}>
      {status === 'compliant' && <CheckCircle2 className="h-3 w-3" />}
      {labels[standard] || standard}
    </span>
  );
}
