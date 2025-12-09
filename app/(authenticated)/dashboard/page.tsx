'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { useDashboardPreferences } from '@/hooks/data/useDashboardPreferences';
import { DashboardCustomiseModal } from '@/components/dashboard/DashboardCustomiseModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Settings2, RefreshCw } from 'lucide-react';

import {
  HeadlineMetricsWidget,
  QuickActionsWidget,
  GHGEmissionsSummaryWidget,
  SupplierEngagementWidget,
  RecentActivityWidget,
  DataQualityWidget,
  ProductLCAStatusWidget,
  GettingStartedWidget,
  WaterRiskWidget,
  ComplianceStatusWidget,
  EmissionsTrendWidget,
} from '@/components/dashboard/widgets';

const widgetComponents: Record<string, React.ComponentType> = {
  'headline-metrics': HeadlineMetricsWidget,
  'quick-actions': QuickActionsWidget,
  'ghg-summary': GHGEmissionsSummaryWidget,
  'supplier-engagement': SupplierEngagementWidget,
  'recent-activity': RecentActivityWidget,
  'data-quality': DataQualityWidget,
  'product-lca-status': ProductLCAStatusWidget,
  'getting-started': GettingStartedWidget,
  'water-risk': WaterRiskWidget,
  'compliance-status': ComplianceStatusWidget,
  'emissions-trend': EmissionsTrendWidget,
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-64 rounded-xl col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-80 rounded-xl col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Settings2 className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Widgets Enabled</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        You have hidden all dashboard widgets. Click customise to enable the widgets you want to see.
      </p>
      <DashboardCustomiseModal>
        <Button>
          <Settings2 className="h-4 w-4 mr-2" />
          Customise Dashboard
        </Button>
      </DashboardCustomiseModal>
    </div>
  );
}

export default function DashboardPage() {
  const { currentOrganization } = useOrganization();
  const { enabledWidgets, loading, error, refetch } = useDashboardPreferences();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    setLastUpdated(new Date());
  }, [enabledWidgets]);

  const getColSpanClass = (colSpan: number) => {
    switch (colSpan) {
      case 1:
        return 'col-span-1';
      case 2:
        return 'col-span-1 md:col-span-2';
      case 3:
        return 'col-span-1 md:col-span-2 lg:col-span-3';
      case 4:
        return 'col-span-full';
      default:
        return 'col-span-1 md:col-span-2';
    }
  };

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  if (loading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {currentOrganization?.name ? `${currentOrganization.name} Dashboard` : 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh dashboard">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DashboardCustomiseModal />
        </div>
      </div>

      {enabledWidgets.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {enabledWidgets.map((pref) => {
            const WidgetComponent = widgetComponents[pref.widget_id];
            if (!WidgetComponent) return null;

            return (
              <div
                key={pref.widget_id}
                className={getColSpanClass(pref.col_span)}
              >
                <WidgetComponent />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
