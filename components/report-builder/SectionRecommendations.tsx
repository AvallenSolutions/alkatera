'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  TrendingUp,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { ReportConfig } from '@/types/report-builder';

interface SectionRecommendationsProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}

interface SectionRecommendation {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  dataCompleteness: number;
  rationale: string;
  estimatedImpact: string;
  dataAvailability: {
    available: string[];
    missing: string[];
  };
}

export function SectionRecommendations({ config, onChange }: SectionRecommendationsProps) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>([]);
  const [autoSelectApplied, setAutoSelectApplied] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadRecommendations();
  }, [config.reportYear, config.audience, config.standards]);

  async function loadRecommendations() {
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

      // Fetch organization data
      const orgId = profile.active_organization_id;
      const year = config.reportYear;

      // Check data availability for each section type
      const [corporateData, productData, facilitiesData, suppliersData] = await Promise.all([
        supabase
          .from('corporate_reports')
          .select('id, total_emissions, breakdown_json')
          .eq('organization_id', orgId)
          .eq('year', year)
          .single(),
        supabase
          .from('product_carbon_footprints')
          .select('id, status')
          .eq('organization_id', orgId)
          .eq('status', 'completed'),
        supabase
          .from('facilities')
          .select('id, name')
          .eq('organization_id', orgId),
        supabase
          .from('suppliers')
          .select('id, name')
          .eq('organization_id', orgId),
      ]);

      // Generate recommendations based on available data
      const recs = generateRecommendations({
        hasCorporateReport: !!corporateData.data,
        corporateData: corporateData.data,
        productCount: productData.data?.length || 0,
        facilityCount: facilitiesData.data?.length || 0,
        supplierCount: suppliersData.data?.length || 0,
        audience: config.audience,
        standards: config.standards,
      });

      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  }

  function generateRecommendations(data: any): SectionRecommendation[] {
    const recs: SectionRecommendation[] = [];

    // Executive Summary - Always high priority
    recs.push({
      id: 'executive-summary',
      name: 'Executive Summary',
      priority: 'high',
      dataCompleteness: 100,
      rationale: 'Required section for all reports. Provides high-level overview.',
      estimatedImpact: 'Essential for stakeholder engagement',
      dataAvailability: { available: ['Organization info'], missing: [] },
    });

    // Company Overview
    recs.push({
      id: 'company-overview',
      name: 'Company Overview',
      priority: 'high',
      dataCompleteness: 100,
      rationale: 'Establishes context for all sustainability metrics.',
      estimatedImpact: 'Critical for first-time readers',
      dataAvailability: { available: ['Organization details'], missing: [] },
    });

    // Scope 1/2/3 Emissions
    if (data.hasCorporateReport) {
      const scope1 = data.corporateData?.breakdown_json?.scope1 || 0;
      const scope2 = data.corporateData?.breakdown_json?.scope2 || 0;
      const scope3 = data.corporateData?.breakdown_json?.scope3 || 0;
      const hasScope3 = scope3 > 0;

      recs.push({
        id: 'scope-1-2-3',
        name: 'Scope 1/2/3 Emissions',
        priority: 'high',
        dataCompleteness: hasScope3 ? 100 : 75,
        rationale: `Corporate footprint data available for ${data.corporateData.year}. ${hasScope3 ? 'Complete scope coverage.' : 'Scope 3 data limited.'}`,
        estimatedImpact: 'Critical for climate disclosure compliance',
        dataAvailability: {
          available: ['Scope 1 data', 'Scope 2 data', hasScope3 ? 'Scope 3 data' : ''],
          missing: hasScope3 ? [] : ['Complete Scope 3 inventory'],
        },
      });
    } else {
      recs.push({
        id: 'scope-1-2-3',
        name: 'Scope 1/2/3 Emissions',
        priority: 'low',
        dataCompleteness: 0,
        rationale: `No corporate footprint report found for ${data.year}.`,
        estimatedImpact: 'Essential but data not available',
        dataAvailability: {
          available: [],
          missing: ['Corporate emissions data', 'Scope 1/2/3 calculations'],
        },
      });
    }

    // Product Environmental Impacts
    if (data.productCount > 0) {
      recs.push({
        id: 'product-footprints',
        name: 'Product Environmental Impacts',
        priority: data.productCount >= 5 ? 'high' : 'medium',
        dataCompleteness: Math.min(100, (data.productCount / 10) * 100),
        rationale: `${data.productCount} completed product PEI${data.productCount > 1 ? 's' : ''} available.`,
        estimatedImpact: data.productCount >= 5 ? 'Strong differentiation for customers' : 'Good foundation for product disclosure',
        dataAvailability: {
          available: [`${data.productCount} product PEIs`],
          missing: data.productCount < 5 ? ['Additional product assessments recommended'] : [],
        },
      });
    } else {
      recs.push({
        id: 'product-footprints',
        name: 'Product Environmental Impacts',
        priority: 'low',
        dataCompleteness: 0,
        rationale: 'No completed product PEIs found.',
        estimatedImpact: 'Would enhance customer engagement',
        dataAvailability: {
          available: [],
          missing: ['Product Environmental Impact data'],
        },
      });
    }

    // Targets & Commitments
    recs.push({
      id: 'targets',
      name: 'Targets & Commitments',
      priority: config.standards.includes('sbti') || config.audience === 'regulators' ? 'high' : 'medium',
      dataCompleteness: 100,
      rationale: config.standards.includes('sbti') ? 'Required for SBTi reporting.' : 'Shows commitment to improvement.',
      estimatedImpact: 'Demonstrates leadership and accountability',
      dataAvailability: {
        available: ['Target setting framework'],
        missing: [],
      },
    });

    // Trends & Progress
    if (data.hasCorporateReport) {
      recs.push({
        id: 'trends',
        name: 'Multi-Year Trends',
        priority: config.isMultiYear ? 'high' : 'medium',
        dataCompleteness: config.isMultiYear ? 100 : 50,
        rationale: config.isMultiYear ? 'Multi-year data selected for comparison.' : 'Enable multi-year toggle to show progress over time.',
        estimatedImpact: 'Demonstrates trajectory and progress',
        dataAvailability: {
          available: config.isMultiYear ? ['Multi-year emissions data'] : ['Current year data'],
          missing: config.isMultiYear ? [] : ['Historical comparison'],
        },
      });
    }

    // Supply Chain
    if (data.supplierCount > 0) {
      recs.push({
        id: 'supply-chain',
        name: 'Supply Chain Emissions',
        priority: data.supplierCount >= 10 ? 'high' : 'medium',
        dataCompleteness: Math.min(100, (data.supplierCount / 20) * 100),
        rationale: `${data.supplierCount} supplier${data.supplierCount > 1 ? 's' : ''} in database.`,
        estimatedImpact: data.supplierCount >= 10 ? 'Comprehensive value chain view' : 'Initial supplier engagement',
        dataAvailability: {
          available: [`${data.supplierCount} supplier records`],
          missing: data.supplierCount < 10 ? ['Additional supplier assessments'] : [],
        },
      });
    }

    // Methodology - Always recommended for technical/regulatory audiences
    if (config.audience === 'regulators' || config.audience === 'technical' || config.standards.length > 0) {
      recs.push({
        id: 'methodology',
        name: 'Methodology & Standards',
        priority: 'high',
        dataCompleteness: 100,
        rationale: 'Required for regulatory compliance and technical credibility.',
        estimatedImpact: 'Essential for audit and verification',
        dataAvailability: {
          available: ['Calculation methodologies', 'Standard references'],
          missing: [],
        },
      });
    }

    // Regulatory Compliance
    if (config.standards.includes('csrd') || config.standards.includes('cdp') || config.audience === 'regulators') {
      recs.push({
        id: 'regulatory',
        name: 'Regulatory Compliance',
        priority: 'high',
        dataCompleteness: 100,
        rationale: config.standards.includes('csrd') ? 'CSRD compliance requires regulatory section.' : 'Demonstrates due diligence.',
        estimatedImpact: 'Critical for mandatory reporting',
        dataAvailability: {
          available: ['Compliance framework'],
          missing: [],
        },
      });
    }

    return recs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority] || b.dataCompleteness - a.dataCompleteness;
    });
  }

  function handleAutoSelect() {
    // Auto-select all high priority sections with >50% data completeness
    const recommendedSections = recommendations
      .filter(rec => rec.priority === 'high' && rec.dataCompleteness >= 50)
      .map(rec => rec.id);

    onChange({ sections: recommendedSections });
    setAutoSelectApplied(true);
  }

  function handleToggleSection(sectionId: string, checked: boolean) {
    const newSections = checked
      ? [...config.sections, sectionId]
      : config.sections.filter(s => s !== sectionId);
    onChange({ sections: newSections });
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-green-600">Recommended</Badge>;
      case 'medium':
        return <Badge variant="secondary">Optional</Badge>;
      case 'low':
        return <Badge variant="outline">Low Data</Badge>;
      default:
        return null;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'medium':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'low':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
  const selectedCount = config.sections.length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>AI-Powered Section Recommendations</CardTitle>
                <CardDescription>
                  Based on your available data, audience, and selected standards
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleAutoSelect} variant="outline" size="sm">
              <Lightbulb className="mr-2 h-4 w-4" />
              Auto-Select Recommended
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{highPriorityCount}</div>
              <div className="text-sm text-muted-foreground">Recommended Sections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{selectedCount}</div>
              <div className="text-sm text-muted-foreground">Currently Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {recommendations.reduce((sum, r) => sum + r.dataCompleteness, 0) / recommendations.length || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg. Data Completeness</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {autoSelectApplied && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            Auto-selected {selectedCount} recommended sections with sufficient data.
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations List */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isSelected = config.sections.includes(rec.id);

          return (
            <Card
              key={rec.id}
              className={`transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50/30' : 'hover:border-gray-300'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id={`rec-${rec.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleToggleSection(rec.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getPriorityIcon(rec.priority)}
                        <div>
                          <label
                            htmlFor={`rec-${rec.id}`}
                            className="text-base font-semibold cursor-pointer"
                          >
                            {rec.name}
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            {getPriorityBadge(rec.priority)}
                            <Badge variant="outline">
                              {rec.dataCompleteness}% Data Available
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rationale */}
                    <p className="text-sm text-muted-foreground">{rec.rationale}</p>

                    {/* Impact */}
                    <div className="flex items-start gap-2 text-sm">
                      <BarChart3 className="h-4 w-4 text-blue-600 mt-0.5" />
                      <span>
                        <strong>Impact:</strong> {rec.estimatedImpact}
                      </span>
                    </div>

                    {/* Data Availability */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {rec.dataAvailability.available.length > 0 && (
                        <div>
                          <div className="font-medium text-green-700 mb-1">Available:</div>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {rec.dataAvailability.available.filter(Boolean).map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rec.dataAvailability.missing.length > 0 && (
                        <div>
                          <div className="font-medium text-yellow-700 mb-1">Missing:</div>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {rec.dataAvailability.missing.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Data Completeness Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          rec.dataCompleteness >= 75
                            ? 'bg-green-600'
                            : rec.dataCompleteness >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${rec.dataCompleteness}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
