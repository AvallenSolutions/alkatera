'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { StateChip } from '@/components/studio';
import { RelatableMetric } from '@/components/shared/RelatableMetric';

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
  // All emission values are in kg CO₂e — convert to tonnes for display
  const formatEmissions = (kgValue: number): string => {
    const t = kgValue / 1000;
    if (t >= 1000) return `${(t / 1000).toFixed(2)} kt`;
    return `${t.toFixed(2)} t`;
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
    <Card className="border-studio-hairline overflow-hidden relative">
      <div className="bg-studio-ink relative">
        <CardContent className="py-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {/* Left: Total emissions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-studio-cream" />
                <span className="text-sm font-medium text-studio-cream/80">
                  {year} Total Emissions
                </span>
                {status === 'Finalized' ? (
                  <StateChip tone="good">
                    <Lock className="h-3 w-3 mr-1 inline text-current" />
                    Finalised
                  </StateChip>
                ) : (
                  <StateChip tone="quiet">Draft</StateChip>
                )}
              </div>

              {totalEmissions > 0 ? (
                <div className="text-4xl lg:text-5xl font-bold text-studio-cream tracking-tight">
                  {formatEmissions(totalEmissions)}{' '}
                  <span className="text-xl font-normal text-studio-cream/70">CO₂e</span>
                </div>
              ) : (
                <div className="text-2xl font-semibold text-studio-cream/70">
                  No emissions data yet
                </div>
              )}

              {totalEmissions > 0 && (
                <RelatableMetric
                  kind="co2e"
                  valueKg={totalEmissions}
                  variant="dark"
                  className="pt-1 max-w-2xl"
                />
              )}

              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-xs text-studio-cream/70">
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

            {/* Right: Three scope figures */}
            <div className="grid grid-cols-3 gap-3 lg:min-w-[420px]">
              {/* Scope 1 */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-cream/70">Scope 1</span>
                  <span className="text-[10px] tabular-nums text-studio-cream/60">{formatPercentage(scope1Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-studio-cream">
                  {formatEmissions(scope1Emissions)}
                </div>
                <p className="text-[10px] text-studio-cream/60 mt-0.5">Direct</p>
              </div>

              {/* Scope 2 */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-cream/70">Scope 2</span>
                  <span className="text-[10px] tabular-nums text-studio-cream/60">{formatPercentage(scope2Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-studio-cream">
                  {formatEmissions(scope2Emissions)}
                </div>
                <p className="text-[10px] text-studio-cream/60 mt-0.5">Energy</p>
              </div>

              {/* Scope 3 */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-cream/70">Scope 3</span>
                  <span className="text-[10px] tabular-nums text-studio-cream/60">{formatPercentage(scope3Emissions, totalEmissions)}</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-studio-cream">
                  {formatEmissions(scope3Emissions)}
                </div>
                <p className="text-[10px] text-studio-cream/60 mt-0.5">Value chain</p>
              </div>
            </div>
          </div>

          {/* Bottom: Stacked bar + completeness */}
          <div className="mt-6 space-y-3">
            {/* Stacked scope bar */}
            {totalEmissions > 0 && (
              <div className="flex h-2.5 rounded-full overflow-hidden bg-studio-cream/15">
                <div
                  className="bg-studio-cream transition-all"
                  style={{ width: `${scopeBarWidth(scope1Emissions)}%` }}
                />
                <div
                  className="bg-studio-cream/60 transition-all"
                  style={{ width: `${scopeBarWidth(scope2Emissions)}%` }}
                />
                <div
                  className="bg-studio-brick transition-all"
                  style={{ width: `${scopeBarWidth(scope3Emissions)}%` }}
                />
              </div>
            )}

            {/* Data completeness bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-studio-cream/70 whitespace-nowrap">Data completeness</span>
                <div className="flex-1 max-w-48">
                  <Progress
                    value={dataCompletenessScore}
                    className="h-1.5 bg-secondary"
                  />
                </div>
                <span className="text-xs font-medium text-studio-cream">{dataCompletenessScore}%</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-studio-cream/70 hover:text-studio-cream"
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
