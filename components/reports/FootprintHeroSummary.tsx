'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FootprintHeroSummaryProps {
  totalEmissions: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  dataCompletenessScore: number;
  year: number;
  status: string;
  lastUpdated?: string;
}

export function FootprintHeroSummary({
  totalEmissions,
  scope1Emissions,
  scope2Emissions,
  scope3Emissions,
  dataCompletenessScore,
  year,
  status,
  lastUpdated,
}: FootprintHeroSummaryProps) {
  const formatEmissions = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} kt`;
    }
    return `${(value / 1000).toFixed(2)} t`;
  };

  const formatPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const scopeBarWidth = (value: number) => {
    if (totalEmissions === 0) return 0;
    return (value / totalEmissions) * 100;
  };

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700 overflow-hidden relative">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 relative">
        <CardContent className="py-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Total emissions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-medium text-slate-300">
                  {year} Total Emissions
                </span>
                {status === 'Finalized' ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Finalised
                  </Badge>
                ) : (
                  <Badge className="bg-slate-700 text-slate-300 text-xs">Draft</Badge>
                )}
              </div>

              {totalEmissions > 0 ? (
                <div className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  {formatEmissions(totalEmissions)}{' '}
                  <span className="text-xl font-normal text-slate-400">CO₂e</span>
                </div>
              ) : (
                <div className="text-2xl font-semibold text-slate-400">
                  No emissions data yet
                </div>
              )}

              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Updated{' '}
                  {new Date(lastUpdated).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            {/* Right: Three scope mini-cards */}
            <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
              {/* Scope 1 */}
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-orange-300">Scope 1</span>
                  <span className="text-[10px] text-orange-400">{formatPercentage(scope1Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold text-orange-100">
                  {formatEmissions(scope1Emissions)}
                </div>
                <p className="text-[10px] text-orange-300/70 mt-0.5">Direct</p>
              </div>

              {/* Scope 2 */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-300">Scope 2</span>
                  <span className="text-[10px] text-blue-400">{formatPercentage(scope2Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold text-blue-100">
                  {formatEmissions(scope2Emissions)}
                </div>
                <p className="text-[10px] text-blue-300/70 mt-0.5">Energy</p>
              </div>

              {/* Scope 3 */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-emerald-300">Scope 3</span>
                  <span className="text-[10px] text-emerald-400">{formatPercentage(scope3Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold text-emerald-100">
                  {formatEmissions(scope3Emissions)}
                </div>
                <p className="text-[10px] text-emerald-300/70 mt-0.5">Value chain</p>
              </div>
            </div>
          </div>

          {/* Bottom: Stacked bar + completeness */}
          <div className="mt-6 space-y-3">
            {/* Stacked scope bar */}
            {totalEmissions > 0 && (
              <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-700/50">
                <div
                  className="bg-orange-500 transition-all"
                  style={{ width: `${scopeBarWidth(scope1Emissions)}%` }}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${scopeBarWidth(scope2Emissions)}%` }}
                />
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${scopeBarWidth(scope3Emissions)}%` }}
                />
              </div>
            )}

            {/* Data completeness bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-slate-400 whitespace-nowrap">Data completeness</span>
                <div className="flex-1 max-w-48">
                  <Progress
                    value={dataCompletenessScore}
                    className="h-1.5 bg-slate-700/50"
                  />
                </div>
                <span className="text-xs font-medium text-slate-300">{dataCompletenessScore}%</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => {
                  document.getElementById('summary-dashboard')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View full breakdown
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
