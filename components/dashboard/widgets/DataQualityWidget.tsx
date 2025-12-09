'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDataQualityMetrics } from '@/hooks/data/useDataQualityMetrics';
import { useOrganization } from '@/lib/organizationContext';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, Users } from 'lucide-react';
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
          <div className="text-center py-6 text-muted-foreground">
            <p>No LCA data available yet.</p>
            <p className="text-sm mt-2">Create your first product LCA to see data quality metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getQualityColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 40) return 'text-amber-600';
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
            <span className="text-sm font-medium">Average Confidence Score</span>
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
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {distribution.high_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.high_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.high_percentage} className="h-1.5 bg-green-100" />

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <span>Medium Quality (Regional Standard)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                  {distribution.medium_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.medium_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.medium_percentage} className="h-1.5 bg-amber-100" />

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span>Low Quality (Generic Proxy)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {distribution.low_count}
                </Badge>
                <span className="text-muted-foreground w-12 text-right">
                  {distribution.low_percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <Progress value={distribution.low_percentage} className="h-1.5 bg-red-100" />
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
