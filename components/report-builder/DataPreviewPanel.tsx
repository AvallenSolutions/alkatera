'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { ReportConfig } from '@/app/(authenticated)/reports/builder/page';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataPreviewPanelProps {
  config: ReportConfig;
}

interface PreviewData {
  section: string;
  dataPoints: {
    label: string;
    value: string | number;
    quality: 'tier_1' | 'tier_2' | 'tier_3';
    verified: boolean;
  }[];
  completeness: number;
  confidence: number;
  missing: string[];
}

export function DataPreviewPanel({ config }: DataPreviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadPreviewData();
  }, [config.sections, config.reportYear]);

  async function loadPreviewData() {
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

      const data: PreviewData[] = [];

      // Load data for each selected section
      for (const sectionId of config.sections) {
        const sectionData = await loadSectionData(
          sectionId,
          profile.active_organization_id,
          config.reportYear
        );
        if (sectionData) {
          data.push(sectionData);
        }
      }

      setPreviewData(data);
    } catch (error) {
      console.error('Error loading preview data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSectionData(
    sectionId: string,
    orgId: string,
    year: number
  ): Promise<PreviewData | null> {
    switch (sectionId) {
      case 'scope-1-2-3':
        return await loadEmissionsData(orgId, year);
      case 'product-footprints':
        return await loadProductData(orgId);
      case 'ghg-inventory':
        return await loadGHGInventoryData(orgId, year);
      default:
        return null;
    }
  }

  async function loadEmissionsData(orgId: string, year: number): Promise<PreviewData> {
    const { data: report } = await supabase
      .from('corporate_reports')
      .select('*')
      .eq('organization_id', orgId)
      .eq('year', year)
      .single();

    const breakdown = report?.breakdown_json || {};

    return {
      section: 'Scope 1/2/3 Emissions',
      dataPoints: [
        {
          label: 'Scope 1 Emissions',
          value: `${(breakdown.scope1 || 0).toFixed(2)} tCO2e`,
          quality: 'tier_2',
          verified: true,
        },
        {
          label: 'Scope 2 Emissions',
          value: `${(breakdown.scope2 || 0).toFixed(2)} tCO2e`,
          quality: 'tier_2',
          verified: true,
        },
        {
          label: 'Scope 3 Emissions',
          value: `${(breakdown.scope3 || 0).toFixed(2)} tCO2e`,
          quality: 'tier_3',
          verified: false,
        },
        {
          label: 'Total Emissions',
          value: `${(report?.total_emissions || 0).toFixed(2)} tCO2e`,
          quality: 'tier_2',
          verified: true,
        },
      ],
      completeness: report ? 100 : 0,
      confidence: report ? 85 : 0,
      missing: report ? [] : ['No corporate footprint report found for this year'],
    };
  }

  async function loadProductData(orgId: string): Promise<PreviewData> {
    const { data: products } = await supabase
      .from('product_carbon_footprints')
      .select('product_name, aggregated_impacts, status')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .limit(10);

    const dataPoints = products?.map((p) => ({
      label: p.product_name,
      value: `${(p.aggregated_impacts?.climate_change || 0).toFixed(4)} kg CO2e`,
      quality: 'tier_2' as const,
      verified: true,
    })) || [];

    return {
      section: 'Product Carbon Footprints',
      dataPoints,
      completeness: products && products.length > 0 ? 100 : 0,
      confidence: products && products.length > 0 ? 90 : 0,
      missing: products && products.length === 0 ? ['No completed product LCAs found'] : [],
    };
  }

  async function loadGHGInventoryData(orgId: string, year: number): Promise<PreviewData> {
    const { data: materials } = await supabase
      .from('product_carbon_footprint_materials')
      .select(`
        ch4_fossil_kg_co2e,
        ch4_biogenic_kg_co2e,
        n2o_kg_co2e,
        hfc_pfc_kg_co2e,
        product_lcas!inner (organization_id)
      `)
      .eq('product_lcas.organization_id', orgId)
      .limit(100);

    let ch4Fossil = 0;
    let ch4Biogenic = 0;
    let n2o = 0;
    let hfcPfc = 0;

    materials?.forEach((m) => {
      ch4Fossil += m.ch4_fossil_kg_co2e || 0;
      ch4Biogenic += m.ch4_biogenic_kg_co2e || 0;
      n2o += m.n2o_kg_co2e || 0;
      hfcPfc += m.hfc_pfc_kg_co2e || 0;
    });

    return {
      section: 'GHG Gas Inventory (ISO 14067)',
      dataPoints: [
        {
          label: 'CH₄ (Fossil)',
          value: `${ch4Fossil.toFixed(2)} kg CO2e`,
          quality: 'tier_2',
          verified: true,
        },
        {
          label: 'CH₄ (Biogenic)',
          value: `${ch4Biogenic.toFixed(2)} kg CO2e`,
          quality: 'tier_2',
          verified: true,
        },
        {
          label: 'N₂O',
          value: `${n2o.toFixed(2)} kg CO2e`,
          quality: 'tier_2',
          verified: true,
        },
        {
          label: 'HFCs/PFCs',
          value: `${hfcPfc.toFixed(2)} kg CO2e`,
          quality: 'tier_3',
          verified: false,
        },
      ],
      completeness: materials && materials.length > 0 ? 100 : 0,
      confidence: materials && materials.length > 0 ? 75 : 0,
      missing: materials && materials.length === 0 ? ['No GHG inventory data available'] : [],
    };
  }

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'tier_1':
        return <Badge variant="default" className="bg-green-600">Tier 1 (Primary)</Badge>;
      case 'tier_2':
        return <Badge variant="secondary">Tier 2 (Secondary)</Badge>;
      case 'tier_3':
        return <Badge variant="outline">Tier 3 (Estimates)</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (previewData.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Select sections in the Data Selection tab to preview available data.
        </AlertDescription>
      </Alert>
    );
  }

  const overallCompleteness =
    previewData.reduce((sum, d) => sum + d.completeness, 0) / previewData.length;
  const overallConfidence =
    previewData.reduce((sum, d) => sum + d.confidence, 0) / previewData.length;

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Summary</CardTitle>
          <CardDescription>
            Overview of data completeness and confidence for selected sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Data Completeness</div>
              <div className="text-3xl font-bold">{overallCompleteness.toFixed(0)}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${overallCompleteness}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Confidence Score</div>
              <div className="text-3xl font-bold">{overallConfidence.toFixed(0)}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${overallConfidence}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section-by-Section Data */}
      {previewData.map((section) => (
        <Card key={section.section}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{section.section}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={section.completeness === 100 ? 'default' : 'secondary'}>
                  {section.completeness}% Complete
                </Badge>
                <Badge variant="outline">{section.confidence}% Confidence</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.dataPoints.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Point</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.dataPoints.map((point, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{point.label}</TableCell>
                      <TableCell>{point.value}</TableCell>
                      <TableCell>{getQualityBadge(point.quality)}</TableCell>
                      <TableCell>
                        {point.verified ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>No data available for this section</AlertDescription>
              </Alert>
            )}

            {section.missing.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Missing Data:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {section.missing.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
