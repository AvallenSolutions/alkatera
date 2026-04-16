'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataQualityMetrics } from '@/hooks/data/useDataQualityMetrics';
import { useOrganization } from '@/lib/organizationContext';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Target,
  Award,
  Database,
  Flame,
} from 'lucide-react';
import Link from 'next/link';
import { PageLoader } from '@/components/ui/page-loader';

export default function DataQualityDashboard() {
  const { currentOrganization } = useOrganization();
  const {
    distribution,
    averageConfidence,
    hybridSourcesCount,
    defraCount,
    supplierVerifiedCount,
    upgradeOpportunities,
    totalUpgradeOpportunities,
    carbonAtRisk,
    productQualityBreakdown,
    loading,
    error,
  } = useDataQualityMetrics(currentOrganization?.id);

  // Upgrade Opportunities filter + pagination state
  const [opportunityQualityFilter, setOpportunityQualityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM'>('ALL');
  const [opportunityProductFilter, setOpportunityProductFilter] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Reset visible count whenever filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [opportunityQualityFilter, opportunityProductFilter]);

  const filteredOpportunities = upgradeOpportunities
    .filter(o => opportunityQualityFilter === 'ALL' || o.current_quality === opportunityQualityFilter)
    .filter(o => opportunityProductFilter === 'ALL' || o.product_id === opportunityProductFilter);

  const visibleOpportunities = filteredOpportunities.slice(0, visibleCount);

  const opportunityProducts = Array.from(
    new Map(upgradeOpportunities.map(o => [o.product_id, o.product_name])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Improvement simulator: what would upgrading top 3 materials do to the score?
  const simulatorData = (() => {
    if (upgradeOpportunities.length < 3 || distribution.total_count === 0) return null;
    const top3 = upgradeOpportunities.slice(0, 3);
    const gainedConfidence = top3.reduce((sum, opp) => sum + opp.confidence_gain, 0);
    const simulatedScore = Math.min(
      100,
      Math.round(averageConfidence + gainedConfidence / distribution.total_count)
    );
    return { simulatedScore, top3Names: top3.map(o => o.material_name) };
  })();

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error loading data quality metrics: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getQualityRating = () => {
    if (averageConfidence >= 85) return { rating: 'Excellent', color: 'text-green-600' };
    if (averageConfidence >= 70) return { rating: 'Good', color: 'text-blue-600' };
    if (averageConfidence >= 50) return { rating: 'Fair', color: 'text-amber-600' };
    return { rating: 'Needs Improvement', color: 'text-red-600' };
  };

  const qualityRating = getQualityRating();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground">
          See how accurate your carbon footprint data is across your products, and find out where you
          can improve it by getting better numbers from your suppliers.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className={`text-3xl font-bold ${qualityRating.color}`}>{averageConfidence}%</div>
              <Badge variant="outline" className={qualityRating.color}>
                {qualityRating.rating}
              </Badge>
            </div>
            <Progress value={averageConfidence} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Supplier Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-green-600">{supplierVerifiedCount}</div>
              <Award className="h-8 w-8 text-green-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {distribution.total_count > 0
                ? `${((supplierVerifiedCount / distribution.total_count) * 100).toFixed(0)}% of your materials have supplier-specific data`
                : 'No data yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Combined Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-blue-600">{hybridSourcesCount}</div>
              <Database className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Using both UK government and international research data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Can Be Improved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-purple-600">{totalUpgradeOpportunities}</div>
              <Target className="h-8 w-8 text-purple-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Materials where supplier data could make your footprint more accurate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Carbon at Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-orange-600">
                {carbonAtRisk.toFixed(1)}
              </div>
              <Flame className="h-8 w-8 text-orange-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              kg CO₂e from low-quality materials — most uncertain part of your footprint
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="opportunities">Upgrade Opportunities</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>How Reliable Is Your Data?</CardTitle>
                <CardDescription>Breakdown of {distribution.total_count} materials by data quality</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Well Established</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {distribution.high_count}
                        </Badge>
                        <span className="text-muted-foreground font-mono w-14 text-right">
                          {distribution.high_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={distribution.high_percentage}
                      className="h-3"
                      indicatorClassName="bg-green-600"
                    />
                    <p className="text-xs text-muted-foreground pl-6">
                      Primary verified data — supplier EPDs, direct measurements, or peer-reviewed primary datasets
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        <span className="font-medium">Good Estimate</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          {distribution.medium_count}
                        </Badge>
                        <span className="text-muted-foreground font-mono w-14 text-right">
                          {distribution.medium_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={distribution.medium_percentage}
                      className="h-3"
                      indicatorClassName="bg-amber-600"
                    />
                    <p className="text-xs text-muted-foreground pl-6">
                      Based on trusted regional databases — good accuracy for most reporting needs
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Best Available</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {distribution.low_count}
                        </Badge>
                        <span className="text-muted-foreground font-mono w-14 text-right">
                          {distribution.low_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={distribution.low_percentage}
                      className="h-3"
                      indicatorClassName="bg-red-600"
                    />
                    <p className="text-xs text-muted-foreground pl-6">
                      Based on general industry averages — can be improved with supplier-specific data
                    </p>
                  </div>
                </div>

                {distribution.low_percentage > 30 && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Over 30% of your materials rely on general estimates. Asking your suppliers for their own data could make your carbon footprint much more accurate.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Data Source Methodology */}
            <Card>
              <CardHeader>
                <CardTitle>Where Your Data Comes From</CardTitle>
                <CardDescription>The databases and sources we use across your products</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">UK Government (DEFRA 2025)</div>
                      <div className="text-xs text-muted-foreground">
                        Official UK emission factors used for regulatory reporting
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{defraCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">Combined (UK + International)</div>
                      <div className="text-xs text-muted-foreground">
                        UK carbon data combined with international environmental data
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{hybridSourcesCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">Direct From Suppliers</div>
                      <div className="text-xs text-muted-foreground">
                        Verified data provided by your own suppliers
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{supplierVerifiedCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">International Research (Ecoinvent)</div>
                      <div className="text-xs text-muted-foreground">
                        Comprehensive environmental database used worldwide
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-teal-600">
                        {distribution.total_count - defraCount - supplierVerifiedCount}
                      </div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    We combine UK government data (DEFRA) with international research databases (Ecoinvent) to give you the most complete and compliant picture possible.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          {/* Per-product quality breakdown */}
          {productQualityBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quality by Product</CardTitle>
                <CardDescription>
                  Data quality breakdown for each product, sorted by quality score — products most in need of improvement appear first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Materials</TableHead>
                      <TableHead className="text-right">Quality Score</TableHead>
                      <TableHead className="w-[200px]">Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productQualityBreakdown.map((row) => (
                      <TableRow key={row.product_id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/products/${row.product_id}`}
                            className="hover:underline"
                          >
                            {row.product_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.material_count}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={
                            row.quality_score >= 70
                              ? 'text-green-600 font-medium'
                              : row.quality_score >= 40
                              ? 'text-amber-600 font-medium'
                              : 'text-red-600 font-medium'
                          }>
                            {row.quality_score}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 items-center">
                            {row.high_count > 0 && (
                              <div
                                className="h-3 rounded-sm bg-green-500"
                                style={{ width: `${(row.high_count / row.material_count) * 120}px` }}
                                title={`${row.high_count} high quality`}
                              />
                            )}
                            {row.medium_count > 0 && (
                              <div
                                className="h-3 rounded-sm bg-amber-400"
                                style={{ width: `${(row.medium_count / row.material_count) * 120}px` }}
                                title={`${row.medium_count} medium quality`}
                              />
                            )}
                            {row.low_count > 0 && (
                              <div
                                className="h-3 rounded-sm bg-red-400"
                                style={{ width: `${(row.low_count / row.material_count) * 120}px` }}
                                title={`${row.low_count} low quality`}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Upgrade Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          {/* Improvement simulator */}
          {simulatorData && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <span className="font-medium">Improvement estimate:</span> If you upgraded your top
                3 materials ({simulatorData.top3Names.join(', ')}) to high-quality data, your
                overall score could improve from{' '}
                <span className="font-semibold">{averageConfidence}%</span> to{' '}
                <span className="font-semibold">{simulatorData.simulatedScore}%</span>.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle>Where You Can Improve</CardTitle>
                  <CardDescription className="mt-1">
                    Ranked by how much upgrading each material would improve your overall accuracy.{' '}
                    {filteredOpportunities.length !== totalUpgradeOpportunities
                      ? `Showing ${filteredOpportunities.length} of ${totalUpgradeOpportunities} materials.`
                      : `${totalUpgradeOpportunities} material${totalUpgradeOpportunities !== 1 ? 's' : ''} identified.`}
                  </CardDescription>
                </div>
                {/* Filters */}
                <div className="flex gap-2 flex-shrink-0">
                  <Select
                    value={opportunityQualityFilter}
                    onValueChange={(v) => setOpportunityQualityFilter(v as 'ALL' | 'LOW' | 'MEDIUM')}
                  >
                    <SelectTrigger className="w-[130px] h-9 text-sm">
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All quality</SelectItem>
                      <SelectItem value="LOW">Low only</SelectItem>
                      <SelectItem value="MEDIUM">Medium only</SelectItem>
                    </SelectContent>
                  </Select>

                  {opportunityProducts.length > 1 && (
                    <Select
                      value={opportunityProductFilter}
                      onValueChange={setOpportunityProductFilter}
                    >
                      <SelectTrigger className="w-[160px] h-9 text-sm">
                        <SelectValue placeholder="All products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All products</SelectItem>
                        {opportunityProducts.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOpportunities.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">
                    {upgradeOpportunities.length === 0
                      ? 'Your data is in great shape!'
                      : 'No results match the current filters.'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {upgradeOpportunities.length === 0
                      ? 'All your materials are using well-established data sources.'
                      : 'Try adjusting the quality or product filter above.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Current Quality</TableHead>
                        <TableHead className="text-right">Carbon Impact</TableHead>
                        <TableHead className="text-right">Potential Improvement</TableHead>
                        <TableHead>Suggested Action</TableHead>
                        <TableHead className="w-[120px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleOpportunities.map((opp) => (
                        <TableRow key={opp.material_id}>
                          <TableCell className="font-medium">{opp.material_name}</TableCell>
                          <TableCell className="text-muted-foreground">{opp.product_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                opp.current_quality === 'LOW'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-amber-50 text-amber-700'
                              }
                            >
                              {opp.current_quality} ({opp.current_confidence}%)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {opp.ghg_impact.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-green-600 font-medium">
                              +{opp.confidence_gain}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{opp.recommendation}</span>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/products/${opp.product_id}`}>View product</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination footer */}
                  {filteredOpportunities.length > visibleCount && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Showing {visibleCount} of {filteredOpportunities.length}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount(v => v + 10)}
                      >
                        Show more
                      </Button>
                    </div>
                  )}
                  {filteredOpportunities.length <= visibleCount && filteredOpportunities.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center mt-4 pt-4 border-t">
                      Showing all {filteredOpportunities.length} results
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Standards We Follow</CardTitle>
                <CardDescription>Your data meets these recognised reporting standards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">UK Government Standards</div>
                    <p className="text-xs text-muted-foreground">
                      Uses official DEFRA 2025 numbers for UK energy and emissions reporting
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">International Best Practice</div>
                    <p className="text-xs text-muted-foreground">
                      Follows ISO standards for lifecycle assessment and carbon footprinting
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">EU Sustainability Reporting</div>
                    <p className="text-xs text-muted-foreground">
                      Covers climate, water, biodiversity, and resource use for CSRD compliance
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What We Measure</CardTitle>
                <CardDescription>Environmental impacts tracked across your products</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Climate Change</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Water Consumption</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Land Use</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Ozone Depletion</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Particulate Matter</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Eutrophication</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Acidification</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Ecotoxicity</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Resource Scarcity</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between py-1 font-medium">
                    <span>Total Impact Categories</span>
                    <Badge variant="secondary">18</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
