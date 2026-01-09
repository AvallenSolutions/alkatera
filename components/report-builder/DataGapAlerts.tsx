'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  FileWarning,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import Link from 'next/link';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';

interface DataGapAlertsProps {
  config: ReportConfig;
}

interface DataGap {
  id: string;
  gap_type: 'scope_1' | 'scope_2' | 'scope_3' | 'product_lca' | 'facility' | 'supplier' | 'other';
  section_id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact_on_reporting: string;
  data_required: string;
  fill_url: string | null;
  is_resolved: boolean;
}

interface GapAnalysis {
  totalGaps: number;
  criticalGaps: number;
  highGaps: number;
  resolvedGaps: number;
  overallCompleteness: number;
  gapsBySection: Record<string, DataGap[]>;
}

export function DataGapAlerts({ config }: DataGapAlertsProps) {
  const [loading, setLoading] = useState(true);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    analyzeDataGaps();
  }, [config.sections, config.reportYear]);

  async function analyzeDataGaps() {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.active_organization_id) return;

      const orgId = profile.active_organization_id;

      // Check for existing data gaps
      const { data: existingGaps } = await supabase
        .from('data_gaps')
        .select('*')
        .eq('organization_id', orgId)
        .order('severity', { ascending: true });

      // Analyze current data availability
      const detectedGaps = await detectDataGaps(orgId, config);

      // Merge existing and detected gaps
      const allGaps = mergeGaps(existingGaps || [], detectedGaps);
      setGaps(allGaps);

      // Calculate analysis
      const gapAnalysis = calculateGapAnalysis(allGaps);
      setAnalysis(gapAnalysis);
    } catch (error) {
      console.error('Error analyzing data gaps:', error);
    } finally {
      setLoading(false);
    }
  }

  async function detectDataGaps(orgId: string, config: ReportConfig): Promise<DataGap[]> {
    const detectedGaps: DataGap[] = [];

    // Check corporate emissions data
    if (config.sections.includes('scope-1-2-3')) {
      const { data: corporateReport } = await supabase
        .from('corporate_reports')
        .select('breakdown_json')
        .eq('organization_id', orgId)
        .eq('year', config.reportYear)
        .single();

      if (!corporateReport) {
        detectedGaps.push({
          id: `gap-corp-${Date.now()}`,
          gap_type: 'scope_1',
          section_id: 'scope-1-2-3',
          description: `No corporate footprint data for ${config.reportYear}`,
          severity: 'critical',
          impact_on_reporting: 'Cannot generate emissions section without baseline data',
          data_required: 'Corporate carbon footprint calculation',
          fill_url: '/reports/corporate',
          is_resolved: false,
        });
      } else {
        const breakdown = corporateReport.breakdown_json || {};

        if (!breakdown.scope1 || breakdown.scope1 === 0) {
          detectedGaps.push({
            id: `gap-scope1-${Date.now()}`,
            gap_type: 'scope_1',
            section_id: 'scope-1-2-3',
            description: 'Scope 1 emissions data missing or zero',
            severity: 'high',
            impact_on_reporting: 'Incomplete emissions breakdown',
            data_required: 'Direct emissions from owned sources',
            fill_url: '/reports/corporate',
            is_resolved: false,
          });
        }

        if (!breakdown.scope3 || breakdown.scope3 === 0) {
          detectedGaps.push({
            id: `gap-scope3-${Date.now()}`,
            gap_type: 'scope_3',
            section_id: 'scope-1-2-3',
            description: 'Scope 3 emissions data incomplete',
            severity: 'medium',
            impact_on_reporting: 'Value chain emissions not represented',
            data_required: 'Scope 3 category calculations',
            fill_url: '/reports/corporate',
            is_resolved: false,
          });
        }
      }
    }

    // Check product LCA data
    if (config.sections.includes('product-footprints')) {
      const { data: products } = await supabase
        .from('product_lcas')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'completed');

      if (!products || products.length === 0) {
        detectedGaps.push({
          id: `gap-products-${Date.now()}`,
          gap_type: 'product_lca',
          section_id: 'product-footprints',
          description: 'No completed product LCAs available',
          severity: 'critical',
          impact_on_reporting: 'Cannot include product footprint section',
          data_required: 'At least 1 completed product LCA',
          fill_url: '/lca',
          is_resolved: false,
        });
      } else if (products.length < 3) {
        detectedGaps.push({
          id: `gap-products-few-${Date.now()}`,
          gap_type: 'product_lca',
          section_id: 'product-footprints',
          description: `Only ${products.length} product LCA${products.length > 1 ? 's' : ''} available`,
          severity: 'medium',
          impact_on_reporting: 'Limited product coverage may not represent full portfolio',
          data_required: 'Additional product assessments',
          fill_url: '/lca',
          is_resolved: false,
        });
      }
    }

    // Check facility data
    if (config.sections.includes('facilities') || config.sections.includes('scope-1-2-3')) {
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id')
        .eq('organization_id', orgId);

      if (!facilities || facilities.length === 0) {
        detectedGaps.push({
          id: `gap-facilities-${Date.now()}`,
          gap_type: 'facility',
          section_id: 'facilities',
          description: 'No facilities registered',
          severity: 'high',
          impact_on_reporting: 'Cannot provide site-level breakdown',
          data_required: 'Facility registration and emissions data',
          fill_url: '/facilities',
          is_resolved: false,
        });
      }
    }

    // Check supplier data
    if (config.sections.includes('supply-chain')) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id')
        .eq('organization_id', orgId);

      if (!suppliers || suppliers.length === 0) {
        detectedGaps.push({
          id: `gap-suppliers-${Date.now()}`,
          gap_type: 'supplier',
          section_id: 'supply-chain',
          description: 'No suppliers in database',
          severity: 'high',
          impact_on_reporting: 'Cannot analyze supply chain emissions',
          data_required: 'Supplier registration and assessments',
          fill_url: '/supply-chain',
          is_resolved: false,
        });
      } else if (suppliers.length < 5) {
        detectedGaps.push({
          id: `gap-suppliers-few-${Date.now()}`,
          gap_type: 'supplier',
          section_id: 'supply-chain',
          description: `Only ${suppliers.length} supplier${suppliers.length > 1 ? 's' : ''} tracked`,
          severity: 'medium',
          impact_on_reporting: 'Limited visibility into supply chain',
          data_required: 'Additional supplier data',
          fill_url: '/supply-chain',
          is_resolved: false,
        });
      }
    }

    // Check multi-year data availability
    if (config.isMultiYear && config.reportYears && config.reportYears.length > 1) {
      for (const year of config.reportYears) {
        if (year !== config.reportYear) {
          const { data: historicalReport } = await supabase
            .from('corporate_reports')
            .select('id')
            .eq('organization_id', orgId)
            .eq('year', year)
            .single();

          if (!historicalReport) {
            detectedGaps.push({
              id: `gap-historical-${year}`,
              gap_type: 'other',
              section_id: 'trends',
              description: `No data available for year ${year}`,
              severity: 'medium',
              impact_on_reporting: 'Cannot show complete multi-year trend',
              data_required: `Corporate footprint for ${year}`,
              fill_url: '/reports/corporate',
              is_resolved: false,
            });
          }
        }
      }
    }

    return detectedGaps;
  }

  function mergeGaps(existing: DataGap[], detected: DataGap[]): DataGap[] {
    // Prioritize existing gaps from database, add new detected ones
    const existingIds = new Set(existing.map((g) => g.section_id + g.description));
    const newGaps = detected.filter(
      (g) => !existingIds.has(g.section_id + g.description)
    );
    return [...existing, ...newGaps];
  }

  function calculateGapAnalysis(gaps: DataGap[]): GapAnalysis {
    const unresolvedGaps = gaps.filter((g) => !g.is_resolved);

    const analysis: GapAnalysis = {
      totalGaps: unresolvedGaps.length,
      criticalGaps: unresolvedGaps.filter((g) => g.severity === 'critical').length,
      highGaps: unresolvedGaps.filter((g) => g.severity === 'high').length,
      resolvedGaps: gaps.filter((g) => g.is_resolved).length,
      overallCompleteness: 100 - (unresolvedGaps.length / Math.max(gaps.length, 1)) * 100,
      gapsBySection: {},
    };

    // Group by section
    unresolvedGaps.forEach((gap) => {
      if (!analysis.gapsBySection[gap.section_id]) {
        analysis.gapsBySection[gap.section_id] = [];
      }
      analysis.gapsBySection[gap.section_id].push(gap);
    });

    return analysis;
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-600">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const unresolvedGaps = gaps.filter((g) => !g.is_resolved);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className={`border-2 ${
        analysis && analysis.criticalGaps > 0
          ? 'border-red-200 bg-red-50/50'
          : analysis && analysis.highGaps > 0
          ? 'border-yellow-200 bg-yellow-50/50'
          : 'border-green-200 bg-green-50/50'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileWarning className={`h-6 w-6 ${
                analysis && analysis.criticalGaps > 0
                  ? 'text-red-600'
                  : analysis && analysis.highGaps > 0
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`} />
              <div>
                <CardTitle>Data Gaps Analysis</CardTitle>
                <CardDescription>
                  {unresolvedGaps.length === 0
                    ? 'All data requirements met!'
                    : `${unresolvedGaps.length} data gap${unresolvedGaps.length > 1 ? 's' : ''} detected`}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{analysis?.criticalGaps || 0}</div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{analysis?.highGaps || 0}</div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{unresolvedGaps.length}</div>
              <div className="text-sm text-muted-foreground">Total Unresolved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{analysis?.resolvedGaps || 0}</div>
              <div className="text-sm text-muted-foreground">Resolved</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Data Completeness</span>
              <span className="text-sm font-bold">{analysis?.overallCompleteness.toFixed(0)}%</span>
            </div>
            <Progress value={analysis?.overallCompleteness || 0} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Data Gaps by Section */}
      {unresolvedGaps.length === 0 ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Excellent! All required data is available for your selected sections. You're ready to generate a high-quality report.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {Object.entries(analysis?.gapsBySection || {}).map(([sectionId, sectionGaps]) => (
            <Card key={sectionId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {sectionId.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </CardTitle>
                <CardDescription>{sectionGaps.length} data gap{sectionGaps.length > 1 ? 's' : ''}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sectionGaps.map((gap) => (
                  <div key={gap.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getSeverityIcon(gap.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{gap.description}</span>
                            {getSeverityBadge(gap.severity)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>Impact:</strong> {gap.impact_on_reporting}
                          </p>
                          <p className="text-sm">
                            <strong>Required:</strong> {gap.data_required}
                          </p>
                        </div>
                      </div>
                    </div>

                    {gap.fill_url && (
                      <Link href={gap.fill_url}>
                        <Button size="sm" className="mt-2">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Fill This Data Gap
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Recommendations */}
      {unresolvedGaps.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Recommended Action:</strong> Address critical and high-priority gaps first to significantly improve report quality. Each gap includes a direct link to the data entry page.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
