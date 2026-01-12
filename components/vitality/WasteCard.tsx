import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Recycle, Trash2, AlertTriangle, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { WasteMetrics } from '@/hooks/data/useWasteMetrics';
import {
  getDiversionLevel,
  getHazardLevel,
  getDiversionColorClass,
  getDiversionBgColorClass,
  getHazardColorClass,
  formatWeight as formatWeightShared,
} from '@/lib/calculations/waste-circularity';

interface WasteCardProps {
  metrics: WasteMetrics | null;
  loading: boolean;
  onClick?: () => void;
}

// Use shared formatWeight from waste-circularity service
const formatWeight = formatWeightShared;

export function WasteCard({ metrics, loading, onClick }: WasteCardProps) {
  if (loading) {
    return (
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalWaste = metrics?.total_waste_kg || 0;
  const diversionRate = metrics?.waste_diversion_rate || 0;
  const hazardousPercentage = metrics?.hazardous_waste_percentage || 0;
  const circularityRate = metrics?.circularity_rate || 0;
  const wasteIntensity = metrics?.waste_intensity_per_unit || 0;

  // Use shared threshold functions for consistency across all surfaces
  const diversionLevel = getDiversionLevel(diversionRate);
  const diversionColor = getDiversionColorClass(diversionLevel);
  const diversionBarColor = getDiversionBgColorClass(diversionLevel);

  const hazardLevel = getHazardLevel(hazardousPercentage);
  const hazardColor = getHazardColorClass(hazardLevel);

  const formatted = formatWeight(totalWaste);

  return (
    <Card
      className="border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100">
              <Recycle className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-lg">Waste & Circularity</CardTitle>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
              Gate
            </Badge>
            <Badge variant="default" className="bg-amber-600">
              E5
            </Badge>
          </div>
        </div>
        <CardDescription>Operational waste (cradle-to-gate) per CSRD E5</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Total Waste</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-amber-900">{formatted.value}</span>
              <span className="text-sm text-muted-foreground">{formatted.unit}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Recycle className="h-3.5 w-3.5" />
              <span>Diversion Rate</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${diversionColor}`}>
                {diversionRate.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Circularity Progress</span>
            <span className={`font-medium ${diversionColor}`}>
              {diversionLevel === 'high' ? 'Circular' : diversionLevel === 'medium' ? 'Transitioning' : 'Linear'}
            </span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${diversionBarColor} transition-all duration-500`}
              style={{ width: `${Math.min(circularityRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>100% Circular</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Hazardous</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold ${hazardColor}`}>
                {hazardousPercentage.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              {wasteIntensity < 0.5 ? (
                <TrendingDown className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingUp className="h-3 w-3 text-amber-500" />
              )}
              <span>Intensity</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold text-amber-900">
                {wasteIntensity.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">kg/unit</span>
            </div>
          </div>
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-amber-100/50 transition-colors text-sm font-medium text-amber-900">
          <span>View waste streams & circularity</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
