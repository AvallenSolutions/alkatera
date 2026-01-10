'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Droplets, AlertTriangle, CheckCircle2, ArrowRight, TrendingDown, TrendingUp, Recycle, Factory } from 'lucide-react';
import { CompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import type { CompanyWaterOverview, WaterSourceBreakdown, WaterTimeSeries } from '@/hooks/data/useFacilityWaterData';

interface WaterCardProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
  onClick?: () => void;
  waterOverview?: CompanyWaterOverview | null;
  sourceBreakdown?: WaterSourceBreakdown[];
  waterTimeSeries?: WaterTimeSeries[];
}

export function WaterCard({
  metrics,
  loading,
  onClick,
  waterOverview,
  sourceBreakdown = [],
  waterTimeSeries = []
}: WaterCardProps) {
  if (loading) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const waterConsumption = waterOverview?.total_consumption_m3 || metrics?.total_impacts.water_consumption || 0;
  const waterScarcity = waterOverview?.scarcity_weighted_consumption_m3 || metrics?.total_impacts.water_scarcity_aware || 0;
  const netConsumption = waterOverview?.net_consumption_m3 || waterConsumption;
  const recyclingRate = waterOverview?.avg_recycling_rate || 0;

  const highRiskCount = waterOverview?.high_risk_facilities || 0;
  const mediumRiskCount = waterOverview?.medium_risk_facilities || 0;
  const lowRiskCount = waterOverview?.low_risk_facilities || 0;
  const totalFacilities = waterOverview?.total_facilities || 0;

  const riskLevel = highRiskCount > 0 ? 'high' : mediumRiskCount > 0 ? 'medium' : 'low';

  const riskConfig = {
    high: {
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-200 dark:border-red-800',
      icon: AlertTriangle,
      label: 'High Risk',
      badgeClass: 'bg-red-600',
    },
    medium: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      icon: AlertTriangle,
      label: 'Medium Risk',
      badgeClass: 'bg-amber-600',
    },
    low: {
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-200 dark:border-green-800',
      icon: CheckCircle2,
      label: 'Low Risk',
      badgeClass: 'bg-green-600',
    },
  };

  const config = riskConfig[riskLevel];
  const RiskIcon = config.icon;

  const trend = calculateTrend(waterTimeSeries);

  const formatVolume = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(1);
  };

  return (
    <Card
      className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900/50 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-lg">Water Impact</CardTitle>
          </div>
          <Badge variant="default" className="bg-blue-600">
            E3
          </Badge>
        </div>
        <CardDescription>Water consumption & scarcity (CSRD E3)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total Consumption
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatVolume(waterConsumption)}
              </span>
              <span className="text-sm text-muted-foreground">m³</span>
            </div>
            {trend.direction !== 'stable' && (
              <div className={`flex items-center gap-1 text-xs ${trend.direction === 'down' ? 'text-green-600' : 'text-amber-600'}`}>
                {trend.direction === 'down' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                <span>{trend.percentage.toFixed(1)}% vs prev period</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Scarcity Impact
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatVolume(waterScarcity)}
              </span>
              <span className="text-xs text-muted-foreground">m³ eq</span>
            </div>
            <p className="text-xs text-muted-foreground">AWARE weighted</p>
          </div>
        </div>

        {sourceBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Source Breakdown
            </p>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted">
              {sourceBreakdown.map((source, index) => (
                <div
                  key={index}
                  className="h-full transition-all"
                  style={{
                    width: `${source.percentage}%`,
                    backgroundColor: source.color,
                  }}
                  title={`${source.source}: ${source.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
              {sourceBreakdown.slice(0, 3).map((source, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: source.color }}
                  />
                  <span>{source.source} {source.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recyclingRate > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Recycle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-300">
              {recyclingRate.toFixed(1)}% water recycled/reused
            </span>
          </div>
        )}

        <div className={`p-3 rounded-lg ${config.bgColor} ${config.borderColor} border space-y-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiskIcon className={`h-4 w-4 ${config.color}`} />
              <span className={`text-sm font-semibold ${config.color}`}>
                {config.label}
              </span>
            </div>
            <Badge variant="default" className={config.badgeClass}>
              AWARE
            </Badge>
          </div>

          {totalFacilities > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Factory className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {highRiskCount > 0 && <span className="text-red-600 font-medium">{highRiskCount} high</span>}
                {highRiskCount > 0 && mediumRiskCount > 0 && ' / '}
                {mediumRiskCount > 0 && <span className="text-amber-600 font-medium">{mediumRiskCount} medium</span>}
                {(highRiskCount > 0 || mediumRiskCount > 0) && lowRiskCount > 0 && ' / '}
                {lowRiskCount > 0 && <span className="text-green-600 font-medium">{lowRiskCount} low</span>}
                <span className="ml-1">risk facilities</span>
              </span>
            </div>
          )}
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium text-blue-900 dark:text-blue-100">
          <span>View detailed water analysis</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

function calculateTrend(timeSeries: WaterTimeSeries[]): { direction: 'up' | 'down' | 'stable'; percentage: number } {
  if (timeSeries.length < 4) {
    return { direction: 'stable', percentage: 0 };
  }

  const recentMonths = timeSeries.slice(-2);
  const previousMonths = timeSeries.slice(-4, -2);

  const recentAvg = recentMonths.reduce((sum, d) => sum + d.consumption, 0) / recentMonths.length;
  const previousAvg = previousMonths.reduce((sum, d) => sum + d.consumption, 0) / previousMonths.length;

  if (previousAvg === 0) return { direction: 'stable', percentage: 0 };

  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  return {
    direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
    percentage: Math.abs(change),
  };
}
