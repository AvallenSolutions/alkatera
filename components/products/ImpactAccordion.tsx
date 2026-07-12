"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Panel } from '@/components/studio/panel';
import { PillButton } from '@/components/studio/pill-button';
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
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggle?.(id)}>
      <Panel flush className={className}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between text-left hover:bg-studio-ink/5 transition-colors duration-200">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-studio-dim mt-0.5">{summary}</p>
            </div>

            <div className="flex items-center gap-4">
              {value !== undefined && (
                <div className="text-right">
                  <span className="font-display text-lg font-bold tabular-nums text-foreground">{value.toLocaleString()}</span>
                  {unit && (
                    <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim">{unit}</span>
                  )}
                </div>
              )}
              <ChevronDown className={cn(
                'h-4 w-4 text-studio-dim transition-transform duration-200',
                isExpanded && 'rotate-180'
              )} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-studio-hairline">
            {(onCopyData || onExport || detailsLink) && (
              <div className="flex items-center justify-end gap-1 px-4 py-2">
                {onCopyData && (
                  <PillButton variant="ghost" size="sm" onClick={onCopyData}>
                    Copy
                  </PillButton>
                )}
                {onExport && (
                  <PillButton variant="ghost" size="sm" onClick={onExport}>
                    Export
                  </PillButton>
                )}
                {detailsLink && (
                  <PillButton variant="ghost" size="sm" href={detailsLink}>
                    Full details
                  </PillButton>
                )}
              </div>
            )}
            <div className="p-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Panel>
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
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-sm tabular-nums text-foreground">
                  {item.value.toLocaleString()} {item.unit}
                  {showPercentages && (
                    <span className="text-studio-dim ml-2">
                      ({percentage.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              {showPercentages && (
                <div className="h-1.5 bg-studio-hairline rounded-full overflow-hidden">
                  <div
                    className="h-full bg-room rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              )}
              {item.subLabel && (
                <span className="text-xs text-studio-dim">{item.subLabel}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
