"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  X,
  Leaf,
  Droplets,
  Recycle,
  TreePine,
  Zap,
  Users,
  Factory,
  Truck,
  type LucideIcon
} from 'lucide-react';
import Link from 'next/link';

export type ActionPriority = 'high' | 'medium' | 'low';

interface PriorityAction {
  id: string;
  priority: ActionPriority;
  title: string;
  description?: string;
  impact?: string;
  impactValue?: string;
  category: 'climate' | 'water' | 'waste' | 'nature' | 'energy' | 'suppliers' | 'facilities' | 'transport';
  href?: string;
  dismissible?: boolean;
}

interface PriorityActionCardProps extends PriorityAction {
  onDismiss?: (id: string) => void;
  className?: string;
}

const priorityConfig: Record<ActionPriority, {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
}> = {
  high: {
    label: 'HIGH',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
  medium: {
    label: 'MEDIUM',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  low: {
    label: 'LOW',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
};

const categoryIcons: Record<string, LucideIcon> = {
  climate: Leaf,
  water: Droplets,
  waste: Recycle,
  nature: TreePine,
  energy: Zap,
  suppliers: Users,
  facilities: Factory,
  transport: Truck,
};

export function PriorityActionCard({
  id,
  priority,
  title,
  description,
  impact,
  impactValue,
  category,
  href,
  dismissible = true,
  onDismiss,
  className,
}: PriorityActionCardProps) {
  const config = priorityConfig[priority];
  const Icon = categoryIcons[category] || Leaf;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border border-gray-200 dark:border-gray-800',
        'hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold',
            config.bgClass,
            config.textClass
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
            {config.label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
              <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight">
                {title}
              </h4>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {description}
                </p>
              )}
              {(impact || impactValue) && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                  {impactValue && <span>Impact: {impactValue}</span>}
                  {impact && !impactValue && <span>{impact}</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {href && (
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <Link href={href}>
                <span className="sr-only">Take action</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onDismiss(id)}
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

interface PriorityActionsListProps {
  actions: PriorityAction[];
  onDismiss?: (id: string) => void;
  maxVisible?: number;
  className?: string;
  emptyMessage?: string;
}

export function PriorityActionsList({
  actions,
  onDismiss,
  maxVisible = 5,
  className,
  emptyMessage = "No priority actions at this time. Great work!",
}: PriorityActionsListProps) {
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const visibleActions = sortedActions.slice(0, maxVisible);
  const hiddenCount = Math.max(0, actions.length - maxVisible);

  if (actions.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {visibleActions.map((action) => (
        <PriorityActionCard
          key={action.id}
          {...action}
          onDismiss={onDismiss}
        />
      ))}
      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          +{hiddenCount} more action{hiddenCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export function generatePriorityActions(data: {
  scope1Percentage?: number;
  scope2Percentage?: number;
  scope3Percentage?: number;
  topMaterialHotspot?: { name: string; percentage: number };
  waterRiskFacilities?: number;
  circularityRate?: number;
  supplierEngagementRate?: number;
}): PriorityAction[] {
  const actions: PriorityAction[] = [];

  if (data.scope2Percentage && data.scope2Percentage > 15) {
    actions.push({
      id: 'scope2-renewable',
      priority: data.scope2Percentage > 30 ? 'high' : 'medium',
      title: 'Switch to renewable electricity',
      description: `Scope 2 accounts for ${data.scope2Percentage.toFixed(0)}% of your emissions`,
      impactValue: `-${Math.round(data.scope2Percentage * 0.8)}% emissions`,
      category: 'energy',
      href: '/company/facilities',
    });
  }

  if (data.scope1Percentage && data.scope1Percentage > 20) {
    actions.push({
      id: 'scope1-efficiency',
      priority: 'high',
      title: 'Improve facility energy efficiency',
      description: `Direct emissions are ${data.scope1Percentage.toFixed(0)}% of total`,
      impactValue: `-${Math.round(data.scope1Percentage * 0.3)}% emissions`,
      category: 'facilities',
      href: '/company/facilities',
    });
  }

  if (data.topMaterialHotspot && data.topMaterialHotspot.percentage > 25) {
    actions.push({
      id: 'material-hotspot',
      priority: 'high',
      title: `Optimise ${data.topMaterialHotspot.name} sourcing`,
      description: `Contributes ${data.topMaterialHotspot.percentage.toFixed(0)}% of product emissions`,
      impactValue: 'Significant reduction potential',
      category: 'climate',
      href: '/products',
    });
  }

  if (data.waterRiskFacilities && data.waterRiskFacilities > 0) {
    actions.push({
      id: 'water-risk',
      priority: data.waterRiskFacilities > 2 ? 'high' : 'medium',
      title: `Address water scarcity at ${data.waterRiskFacilities} facility${data.waterRiskFacilities !== 1 ? 'ies' : ''}`,
      description: 'High water stress locations need attention',
      impactValue: 'Reduce operational risk',
      category: 'water',
      href: '/company/facilities',
    });
  }

  if (data.circularityRate !== undefined && data.circularityRate < 50) {
    actions.push({
      id: 'circularity',
      priority: data.circularityRate < 30 ? 'high' : 'medium',
      title: 'Increase packaging recyclability',
      description: `Current circularity rate: ${data.circularityRate.toFixed(0)}%`,
      impactValue: `Target: 80%+ circularity`,
      category: 'waste',
      href: '/products',
    });
  }

  if (data.supplierEngagementRate !== undefined && data.supplierEngagementRate < 50) {
    actions.push({
      id: 'supplier-engagement',
      priority: 'medium',
      title: 'Engage suppliers for emissions data',
      description: `Only ${data.supplierEngagementRate.toFixed(0)}% of suppliers providing data`,
      impactValue: 'Improve data quality',
      category: 'suppliers',
      href: '/suppliers',
    });
  }

  if (data.scope3Percentage && data.scope3Percentage > 70) {
    actions.push({
      id: 'scope3-reduction',
      priority: 'medium',
      title: 'Develop supply chain reduction strategy',
      description: `Scope 3 is ${data.scope3Percentage.toFixed(0)}% of total emissions`,
      impactValue: 'Long-term impact',
      category: 'suppliers',
      href: '/reports/company-footprint',
    });
  }

  return actions;
}
