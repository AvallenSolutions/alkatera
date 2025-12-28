'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { Leaf, TrendingDown, TrendingUp, Minus, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

function ScopeDonut({
  scope1,
  scope2,
  scope3
}: {
  scope1: number;
  scope2: number;
  scope3: number;
}) {
  const total = scope1 + scope2 + scope3;
  if (total === 0) return null;

  const s1Pct = (scope1 / total) * 100;
  const s2Pct = (scope2 / total) * 100;
  const s3Pct = (scope3 / total) * 100;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const s1Offset = 0;
  const s1Length = (s1Pct / 100) * circumference;
  const s2Offset = s1Length;
  const s2Length = (s2Pct / 100) * circumference;
  const s3Offset = s1Length + s2Length;
  const s3Length = (s3Pct / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-slate-100 dark:text-slate-800"
        />
        {scope1 > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth="12"
            strokeDasharray={`${s1Length} ${circumference - s1Length}`}
            strokeDashoffset={-s1Offset}
            className="transition-all duration-500"
          />
        )}
        {scope2 > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="12"
            strokeDasharray={`${s2Length} ${circumference - s2Length}`}
            strokeDashoffset={-s2Offset}
            className="transition-all duration-500"
          />
        )}
        {scope3 > 0 && (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#22c55e"
            strokeWidth="12"
            strokeDasharray={`${s3Length} ${circumference - s3Length}`}
            strokeDashoffset={-s3Offset}
            className="transition-all duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-sm font-bold">{total.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">tCO₂e</span>
      </div>
    </div>
  );
}

export function HeadlineMetricsWidget() {
  const currentYear = new Date().getFullYear();
  const { footprint, previewMode, loading, error, refetch } = useCompanyFootprint(currentYear);

  if (loading) {
    return (
      <Card className="col-span-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <div className="space-y-4 flex-1">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-16 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">Failed to load metrics: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalEmissions = footprint?.total_emissions ? footprint.total_emissions / 1000 : 0;
  const scope1 = footprint?.breakdown?.scope1 ? footprint.breakdown.scope1 / 1000 : 0;
  const scope2 = footprint?.breakdown?.scope2 ? footprint.breakdown.scope2 / 1000 : 0;
  const scope3 = footprint?.breakdown?.scope3?.total ? footprint.breakdown.scope3.total / 1000 : 0;
  const hasData = footprint?.has_data || false;

  useEffect(() => {
    if (footprint) {
      console.log('📊 [HeadlineMetricsWidget] Displaying:', {
        total_emissions_display: totalEmissions,
        scope1_display: scope1,
        scope2_display: scope2,
        scope3_display: scope3,
        unit: 'tCO2e',
        preview_mode: previewMode,
        data_source: previewMode ? 'Preview (production_logs × LCAs)' : 'Official (corporate_reports)'
      });
    }
  }, [footprint, totalEmissions, scope1, scope2, scope3, previewMode]);

  return (
    <Card className="col-span-full bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30 border-0 shadow-lg overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-200/30 to-transparent dark:from-emerald-800/20 rounded-full -translate-y-32 translate-x-32" />
      <CardContent className="p-6 relative">
        {previewMode && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Preview Mode - Unofficial Data
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Showing estimated emissions from product LCAs only. Generate official report for complete data.
                </p>
              </div>
              <Button size="sm" variant="default" asChild>
                <Link href={`/reports/company-footprint/${currentYear}`}>
                  Generate Report
                </Link>
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                <Leaf className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Carbon Footprint
                </h2>
                <p className="text-sm text-muted-foreground">
                  {footprint?.year || currentYear} footprint
                </p>
              </div>
            </div>

            {hasData ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {totalEmissions.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-xl text-muted-foreground">tCO₂e</span>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-500" />
                    <span className="text-sm">
                      <span className="font-medium">Scope 1:</span>{' '}
                      {scope1.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm">
                      <span className="font-medium">Scope 2:</span>{' '}
                      {scope2.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm">
                      <span className="font-medium">Scope 3:</span>{' '}
                      {scope3.toLocaleString('en-GB', { maximumFractionDigits: 1 })} tCO₂e
                    </span>
                  </div>
                </div>

                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link href={`/reports/company-footprint/${currentYear}`}>
                    View Full Report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-600 dark:text-slate-400">
                  Start tracking your carbon footprint by adding products and logging production data.
                </p>
                <Button asChild>
                  <Link href="/products/new">
                    Add Your First Product
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {hasData && (
            <div className="flex-shrink-0">
              <ScopeDonut scope1={scope1} scope2={scope2} scope3={scope3} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
