"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Leaf,
  Droplets,
  Recycle,
  TreePine,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ImpactCategory } from './QuickImpactBar';

interface ImpactAccordionProps {
  id: string;
  category: ImpactCategory;
  title: string;
  summary: string;
  value?: number;
  unit?: string;
  isExpanded?: boolean;
  onToggle?: (id: string) => void;
  onCopyData?: () => void;
  onExport?: () => void;
  detailsLink?: string;
  children: React.ReactNode;
  className?: string;
}

const categoryConfig: Record<ImpactCategory, {
  icon: LucideIcon;
  gradient: string;
  border: string;
  iconBg: string;
  iconColor: string;
}> = {
  climate: {
    icon: Leaf,
    gradient: 'from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  water: {
    icon: Droplets,
    gradient: 'from-blue-50/50 to-transparent dark:from-blue-950/20 dark:to-transparent',
    border: 'border-blue-200 dark:border-blue-800/50',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  circularity: {
    icon: Recycle,
    gradient: 'from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent',
    border: 'border-amber-200 dark:border-amber-800/50',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  nature: {
    icon: TreePine,
    gradient: 'from-green-50/50 to-transparent dark:from-green-950/20 dark:to-transparent',
    border: 'border-green-200 dark:border-green-800/50',
    iconBg: 'bg-green-100 dark:bg-green-900/50',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  energy: {
    icon: Zap,
    gradient: 'from-violet-50/50 to-transparent dark:from-violet-950/20 dark:to-transparent',
    border: 'border-violet-200 dark:border-violet-800/50',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
};

export function ImpactAccordion({
  id,
  category,
  title,
  summary,
  value,
  unit,
  isExpanded = false,
  onToggle,
  onCopyData,
  onExport,
  detailsLink,
  children,
  className,
}: ImpactAccordionProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle?.(id)}>
      <Card className={cn(
        'overflow-hidden transition-all duration-300',
        isExpanded && 'ring-2 ring-primary/20',
        className
      )}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            'w-full p-4 flex items-center justify-between text-left',
            'hover:bg-muted/50 transition-colors duration-200',
            `bg-gradient-to-r ${config.gradient}`
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl',
                config.iconBg
              )}>
                <Icon className={cn('h-5 w-5', config.iconColor)} />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {value !== undefined && (
                <div className="text-right">
                  <span className="text-lg font-bold tabular-nums">{value.toLocaleString()}</span>
                  {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
                </div>
              )}
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full',
                'bg-muted/50 transition-transform duration-200',
                isExpanded && 'rotate-180'
              )}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {(onCopyData || onExport || detailsLink) && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/30">
                {onCopyData && (
                  <Button variant="ghost" size="sm" onClick={onCopyData}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                )}
                {onExport && (
                  <Button variant="ghost" size="sm" onClick={onExport}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export
                  </Button>
                )}
                {detailsLink && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={detailsLink}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Full Details
                    </a>
                  </Button>
                )}
              </div>
            )}
            <div className="p-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface ImpactAccordionGroupProps {
  children: React.ReactNode;
  defaultExpanded?: string[];
  allowMultiple?: boolean;
  className?: string;
}

export function ImpactAccordionGroup({
  children,
  defaultExpanded = [],
  allowMultiple = false,
  className,
}: ImpactAccordionGroupProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const handleToggle = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement<ImpactAccordionProps>(child)) {
          return React.cloneElement(child, {
            isExpanded: expandedItems.has(child.props.id),
            onToggle: handleToggle,
          });
        }
        return child;
      })}
    </div>
  );
}

interface SimpleBreakdownTableProps {
  data: Array<{
    name: string;
    value: number;
    unit: string;
    percentage?: number;
    subLabel?: string;
  }>;
  sortBy?: 'value' | 'name' | 'percentage';
  showPercentages?: boolean;
  className?: string;
}

/**
 * Largest Remainder Method: ensures percentages sum to exactly the target (e.g. 100.0%).
 * Rounds down all values, then distributes the remaining difference to items with the
 * largest fractional remainders.
 */
function largestRemainderRound(values: number[], decimals: number = 1, target: number = 100): number[] {
  const factor = Math.pow(10, decimals);
  const floored = values.map(v => Math.floor(v * factor) / factor);
  const remainders = values.map((v, i) => v * factor - Math.floor(v * factor));
  const currentSum = floored.reduce((a, b) => a + b, 0);
  const step = 1 / factor;
  let diff = Math.round((target - currentSum) * factor);

  // Sort indices by remainder descending to distribute rounding
  const indices = values.map((_, i) => i).sort((a, b) => remainders[b] - remainders[a]);

  const result = [...floored];
  for (let i = 0; i < Math.abs(diff) && i < indices.length; i++) {
    result[indices[i]] += diff > 0 ? step : -step;
  }

  // Clean up floating point artifacts
  return result.map(v => Math.round(v * factor) / factor);
}

export function SimpleBreakdownTable({
  data,
  sortBy = 'value',
  showPercentages = true,
  className,
}: SimpleBreakdownTableProps) {
  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'percentage') return (b.percentage || 0) - (a.percentage || 0);
    return b.value - a.value;
  });

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate raw percentages and apply Largest Remainder Method
  const rawPercentages = sortedData.map(item =>
    item.percentage ?? (total > 0 ? (item.value / total) * 100 : 0)
  );
  const adjustedPercentages = showPercentages && total > 0
    ? largestRemainderRound(rawPercentages, 1, 100)
    : rawPercentages;

  return (
    <div className={cn('space-y-2', className)}>
      {sortedData.map((item, index) => {
        const percentage = adjustedPercentages[index];

        return (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm tabular-nums">
                  {item.value.toLocaleString()} {item.unit}
                  {showPercentages && (
                    <span className="text-muted-foreground ml-2">
                      ({percentage.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              {showPercentages && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              )}
              {item.subLabel && (
                <span className="text-xs text-muted-foreground">{item.subLabel}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
