'use client';

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
import { useDataQualityMetrics } from '@/hooks/data/useDataQualityMetrics';
import { useOrganization } from '@/lib/organizationContext';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Users,
  Target,
  Award,
  Database,
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
    loading,
    error,
  } = useDataQualityMetrics(currentOrganization?.id);

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

  const getQualityColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600';
    if (percentage >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

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
        <h1 className="text-3xl font-bold tracking-tight">Data Quality Dashboard</h1>
        <p className="text-muted-foreground">
          Track data sources, assess quality metrics, and identify opportunities to improve LCA accuracy
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Quality Score
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
                ? `${((supplierVerifiedCount / distribution.total_count) * 100).toFixed(0)}% of materials`
                : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hybrid Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-blue-600">{hybridSourcesCount}</div>
              <Database className="h-8 w-8 text-blue-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              DEFRA GWP + Ecoinvent non-GWP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upgrade Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-purple-600">{upgradeOpportunities.length}</div>
              <Target className="h-8 w-8 text-purple-600 opacity-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Materials that could benefit from supplier data
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
                <CardTitle>Data Quality Distribution</CardTitle>
                <CardDescription>Breakdown of {distribution.total_count} materials by quality grade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">High Quality</span>
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
                      Supplier verified EPDs with third-party certification (95% confidence)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        <span className="font-medium">Medium Quality</span>
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
                      Regional standards (DEFRA, Ecoinvent) with 70-85% confidence
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Low Quality</span>
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
                      Generic proxies with broad assumptions (50% confidence)
                    </p>
                  </div>
                </div>

                {distribution.low_percentage > 30 && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Over 30% of materials use low-quality data. Engaging suppliers could significantly improve LCA accuracy.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Data Source Methodology */}
            <Card>
              <CardHeader>
                <CardTitle>Data Source Methodology</CardTitle>
                <CardDescription>Sources used across your product portfolio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">DEFRA 2025</div>
                      <div className="text-xs text-muted-foreground">
                        UK Government emission factors
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{defraCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">Hybrid (DEFRA + Ecoinvent)</div>
                      <div className="text-xs text-muted-foreground">
                        GWP from DEFRA, other impacts from Ecoinvent
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{hybridSourcesCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">Supplier EPDs</div>
                      <div className="text-xs text-muted-foreground">
                        Third-party verified supplier data
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{supplierVerifiedCount}</div>
                      <div className="text-xs text-muted-foreground">materials</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="font-medium">Ecoinvent 3.12</div>
                      <div className="text-xs text-muted-foreground">
                        Full lifecycle inventory database
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
                    Hybrid approach combines UK regulatory compliance (DEFRA) with comprehensive environmental assessment (Ecoinvent)
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Upgrade Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Engagement Opportunities</CardTitle>
              <CardDescription>
                Materials ranked by potential impact improvement. Prioritise high-impact materials for supplier engagement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upgradeOpportunities.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium">Excellent data quality!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    All materials are using high-quality data sources.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Current Quality</TableHead>
                      <TableHead className="text-right">GHG Impact (kg CO2e)</TableHead>
                      <TableHead className="text-right">Confidence Gain</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upgradeOpportunities.map((opp) => (
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
                            <Link href={`/products/${opp.product_id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Framework</CardTitle>
                <CardDescription>Regulatory and standards compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">UK Regulatory Compliance</div>
                    <p className="text-xs text-muted-foreground">
                      DEFRA 2025 factors for SECR, ESOS, and UK ETS reporting
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">ISO 14044/14067</div>
                    <p className="text-xs text-muted-foreground">
                      Compliant LCA methodology and carbon footprint standards
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-medium">CSRD E1-E5</div>
                    <p className="text-xs text-muted-foreground">
                      Complete environmental reporting (climate, water, biodiversity, resources)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impact Coverage</CardTitle>
                <CardDescription>Environmental indicators tracked</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Climate Change (GWP100)</span>
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
