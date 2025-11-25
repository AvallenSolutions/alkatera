import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Droplets, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { CompanyMetrics } from '@/hooks/data/useCompanyMetrics';

interface WaterCardProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

export function WaterCard({ metrics, loading }: WaterCardProps) {
  if (loading) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const waterConsumption = metrics?.total_impacts.water_consumption || 0;
  const waterScarcity = metrics?.total_impacts.water_scarcity_aware || 0;
  const riskLevel = metrics?.water_risk_level || 'low';

  const riskConfig = {
    high: {
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      label: 'High Risk',
      badgeClass: 'bg-red-600',
    },
    medium: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      borderColor: 'border-amber-200',
      icon: AlertTriangle,
      label: 'Medium Risk',
      badgeClass: 'bg-amber-600',
    },
    low: {
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200',
      icon: CheckCircle2,
      label: 'Low Risk',
      badgeClass: 'bg-green-600',
    },
  };

  const config = riskConfig[riskLevel];
  const RiskIcon = config.icon;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Droplets className="h-5 w-5 text-blue-600" />
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
              Consumption
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-900">
                {waterConsumption.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
              </span>
              <span className="text-sm text-muted-foreground">m³</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Scarcity Impact
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-900">
                {waterScarcity.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground">m³ world eq</span>
            </div>
          </div>
        </div>

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
          <p className="text-xs text-muted-foreground">
            Based on spatially-explicit water scarcity factors across operations
          </p>
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-100/50 transition-colors text-sm font-medium text-blue-900">
          <span>View facility water risks</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
