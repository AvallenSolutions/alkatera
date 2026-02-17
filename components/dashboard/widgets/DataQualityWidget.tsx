'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDataQualityMetrics } from '@/hooks/data/useDataQualityMetrics';
import { useOrganization } from '@/lib/organizationContext';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, Users, Leaf, ArrowRight, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';

export function DataQualityWidget() {
  const { currentOrganization } = useOrganization();
  const {
    distribution,
    averageConfidence,
    hybridSourcesCount,
    defraCount,
    supplierVerifiedCount,
    upgradeOpportunities,
    loading,
    error,
  } = useDataQualityMetrics(currentOrganization?.id);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Quality & Upgrade Opportunities
          </CardTitle>
          <CardDescription>Analysing data sources and quality metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded" />
            <div className="h-24 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality & Upgrade Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Error loading data quality metrics: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (distribution.total_count === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Quality & Upgrade Opportunities
          </CardTitle>
          <CardDescription>Track data sources and identify improvement opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Leaf className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-3">
              Once you create your first product LCA, I can analyse your data quality and show you exactly where to improve.
            </p>
            <Button asChild size="sm" className="bg-neon-lime text-black hover:bg-neon-lime/90">
              <Link href="/products/new">
                Create Your First Product <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getQualityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Data Quality & Upgrade Opportunities
        </CardTitle>
        <CardDescription>
          {distribution.total_count} materials tracked across {upgradeOpportunities.length} products
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Average Confidence Score</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                    <p className="font-semibold mb-1">How this is calculated</p>
                    <p className="mb-2">
                      Each material is scored based on its data quality grade, then averaged across all {distribution.total_count} materials:
                    </p>
                    <ul className="space-y-1 mb-2">
                      <li><span className="font-medium text-green-500">High</span> (Supplier EPD / Verified) = 100%</li>
                      <li><span className="font-medium text-amber-500">Medium</span> (Regional standard / DEFRA) = 60%</li>
                      <li><span className="font-medium text-red-500">Low</span> (Generic proxy / estimate) = 25%</li>
                    </ul>
                    <p className="text-muted-foreground">
                      Reach 100% by obtaining supplier-verified data (EPDs) for every material. Upgrade high-impact materials first for the biggest improvement.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className={`text-2xl font-bold ${getQualityColor(averageConfidence)}`}>
              {averageConfidence}%
            </span>
          </div>
          <Progress value={averageConfidence} className="h-2" />
        </div>

        {/* Data Quality Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Data Quality Distribution</h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>High Quality (Supplier Verified)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                  {distribution.high_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.high_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.high_percentage} className="h-1.5 bg-green-100 dark:bg-green-950" />

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <span>Medium Quality (Regional Standard)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {distribution.medium_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.medium_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.medium_percentage} className="h-1.5 bg-amber-100 dark:bg-amber-950" />

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span>Low Quality (Generic Proxy)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                  {distribution.low_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.low_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.low_percentage} className="h-1.5 bg-red-100 dark:bg-red-950" />
          </div>
        </div>

        {/* Data Source Summary */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t">
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-blue-600">{hybridSourcesCount}</div>
            <div className="text-xs text-muted-foreground">Hybrid Sources</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-green-600">{defraCount}</div>
            <div className="text-xs text-muted-foreground">DEFRA 2025</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold text-purple-600">{supplierVerifiedCount}</div>
            <div className="text-xs text-muted-foreground">Supplier Verified</div>
          </div>
        </div>

        {/* Top Upgrade Opportunities */}
        {upgradeOpportunities.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Upgrade Opportunities
              </h4>
              <Badge variant="secondary">{upgradeOpportunities.length}</Badge>
            </div>

            <div className="space-y-2">
              {upgradeOpportunities.slice(0, 3).map((opp) => (
                <div
                  key={opp.material_id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{opp.material_name}</span>
                        <Badge
                          variant="outline"
                          className={
                            opp.current_quality === 'LOW'
                              ? 'bg-red-50 text-red-700 text-xs'
                              : 'bg-amber-50 text-amber-700 text-xs'
                          }
                        >
                          {opp.current_quality}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{opp.product_name}</p>
                      <p className="text-xs text-muted-foreground italic">{opp.recommendation}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        {opp.ghg_impact.toFixed(1)} kg
                      </div>
                      <div className="text-xs text-green-600">+{opp.confidence_gain}% confidence</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {upgradeOpportunities.length > 3 && (
              <Button variant="outline" className="w-full" size="sm" asChild>
                <Link href="/suppliers">
                  View All {upgradeOpportunities.length} Opportunities →
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Call to Action */}
        {distribution.low_percentage > 30 && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              {distribution.low_percentage.toFixed(0)}% of your materials use generic data. Engaging
              suppliers to provide EPDs could improve data quality significantly.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
