'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { Droplet, AlertTriangle, CheckCircle, Info, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const riskColors = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const riskIcons = {
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle,
};

export function WaterRiskWidget() {
  const { metrics, facilityWaterRisks, loading, error } = useCompanyMetrics();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Water Risk
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Water Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load water data</p>
        </CardContent>
      </Card>
    );
  }

  const waterRisk = metrics?.water_risk_level || 'low';
  const RiskIcon = riskIcons[waterRisk];

  const highRiskFacilities = facilityWaterRisks.filter((f) => f.risk_level === 'high');
  const mediumRiskFacilities = facilityWaterRisks.filter((f) => f.risk_level === 'medium');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplet className="h-5 w-5 text-blue-500" />
          Water Risk
        </CardTitle>
        <CardDescription>Facility water scarcity assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`flex items-center gap-3 p-4 rounded-xl ${riskColors[waterRisk]}`}
        >
          <RiskIcon className="h-6 w-6" />
          <div>
            <p className="font-semibold capitalize">{waterRisk} Risk</p>
            <p className="text-sm opacity-80">
              {waterRisk === 'high'
                ? 'Immediate attention required'
                : waterRisk === 'medium'
                ? 'Monitor water usage closely'
                : 'Water resources are adequate'}
            </p>
          </div>
        </div>

        {facilityWaterRisks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Facilities at Risk
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20">
                <span className="text-red-700 dark:text-red-400">High</span>
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                  {highRiskFacilities.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                <span className="text-amber-700 dark:text-amber-400">Medium</span>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  {mediumRiskFacilities.length}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {facilityWaterRisks.length === 0 && (
          <div className="text-center py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Add facilities to assess water risk by location
            </p>
            <Button size="sm" asChild>
              <Link href="/company/facilities">
                Add Facility
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        <div className="pt-2 border-t space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Water Consumption</span>
            <span className="font-medium">
              {metrics?.total_impacts?.water_consumption?.toFixed(1) || 0} m³
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/data/water-footprint">
              View Water Data
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
