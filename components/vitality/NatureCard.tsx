import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mountain, Leaf, ArrowRight } from 'lucide-react';
import { CompanyMetrics } from '@/hooks/data/useCompanyMetrics';

interface NatureCardProps {
  metrics: CompanyMetrics | null;
  loading: boolean;
}

export function NatureCard({ metrics, loading }: NatureCardProps) {
  if (loading) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
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

  const landUse = metrics?.total_impacts.land_use || 0;
  const ecotoxicity = metrics?.total_impacts.terrestrial_ecotoxicity || 0;
  const landFootprintTotal = metrics?.land_footprint_total || 0;

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100">
              <Mountain className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-lg">Nature & Biodiversity</CardTitle>
          </div>
          <div className="flex gap-1">
            <Badge variant="default" className="bg-green-600 text-xs">
              E4
            </Badge>
            <Badge variant="outline" className="text-xs">
              TNFD
            </Badge>
          </div>
        </div>
        <CardDescription>Land use & biodiversity impact (CSRD E4 / TNFD)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Land Footprint
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-green-900">
              {landFootprintTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-lg text-muted-foreground">m²a</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Crop equivalent land occupation and transformation
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-100/50 space-y-1">
            <div className="flex items-center gap-2">
              <Leaf className="h-3 w-3 text-green-600" />
              <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">
                Land Use
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-green-900">
                {landUse.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground">m²a</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-green-100/50 space-y-1">
            <div className="flex items-center gap-2">
              <Mountain className="h-3 w-3 text-green-600" />
              <span className="text-xs font-semibold text-green-900 uppercase tracking-wide">
                Ecotoxicity
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-green-900">
                {ecotoxicity.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-muted-foreground">kg DCB</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-green-100/80 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
              ReCiPe 2016
            </Badge>
            <span className="text-xs text-green-800 font-medium">
              Multi-capital Assessment
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Comprehensive biodiversity impact across land transformation, habitat quality, and ecosystem toxicity
          </p>
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-green-100/50 transition-colors text-sm font-medium text-green-900">
          <span>View nature metrics</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
