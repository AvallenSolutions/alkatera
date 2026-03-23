'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Lightbulb,
  Clock,
  Lock,
  TrendingUp,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useSubscription, type FeatureCode } from '@/hooks/useSubscription';
import type { ReportConfig, SectionDefinition } from '@/types/report-builder';
import { AVAILABLE_SECTIONS, SECTION_CATEGORIES } from '@/types/report-builder';

interface ContentSelectionStepProps {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  organizationId: string | null;
}

interface SectionRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  dataCompleteness: number;
  rationale: string;
}

export function ContentSelectionStep({ config, onChange, organizationId }: ContentSelectionStepProps) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Record<string, SectionRecommendation>>({});
  const supabase = getSupabaseBrowserClient();
  const { hasFeature } = useSubscription();

  useEffect(() => {
    loadRecommendations();
  }, [config.reportYear, config.audience, config.standards]);

  async function loadRecommendations() {
    setLoading(true);
    try {
      if (!organizationId) return;

      const orgId = organizationId;
      const year = config.reportYear;

      const [corporateData, productData, facilitiesData, suppliersData, multiYearCorporateData] = await Promise.all([
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
          .select('id')
          .eq('organization_id', orgId),
        supabase
          .from('suppliers')
          .select('id')
          .eq('organization_id', orgId),
        supabase
          .from('corporate_reports')
          .select('id, year')
          .eq('organization_id', orgId)
          .order('year', { ascending: false }),
      ]);

      const hasCorporate = !!corporateData.data;
      const productCount = productData.data?.length || 0;
      const facilityCount = facilitiesData.data?.length || 0;
      const supplierCount = suppliersData.data?.length || 0;

      const recs: Record<string, SectionRecommendation> = {};

      // Executive Summary - always high
      recs['executive-summary'] = { id: 'executive-summary', priority: 'high', dataCompleteness: 100, rationale: 'Required overview section' };
      recs['company-overview'] = { id: 'company-overview', priority: 'high', dataCompleteness: 100, rationale: 'Establishes context' };

      const corporateYearCount = multiYearCorporateData.data?.length || 0;
      const hasMultiYearCorporate = corporateYearCount >= 2;

      if (hasCorporate) {
        const scope3 = corporateData.data?.breakdown_json?.scope3 || 0;
        recs['scope-1-2-3'] = { id: 'scope-1-2-3', priority: 'high', dataCompleteness: scope3 > 0 ? 100 : 75, rationale: 'Corporate emissions data available' };
        recs['ghg-inventory'] = { id: 'ghg-inventory', priority: 'medium', dataCompleteness: 70, rationale: 'Gas-level breakdown from corporate data' };
        recs['trends'] = { id: 'trends', priority: config.isMultiYear ? 'high' : 'medium', dataCompleteness: config.isMultiYear ? 100 : 50, rationale: config.isMultiYear ? 'Multi-year data selected' : 'Single year - enable multi-year for trends' };
        recs['key-findings'] = { id: 'key-findings', priority: hasMultiYearCorporate ? 'high' : 'low', dataCompleteness: hasMultiYearCorporate ? 90 : 0, rationale: hasMultiYearCorporate ? `${corporateYearCount} years of corporate data available for change analysis` : 'Requires multiple years of corporate reports' };
      } else {
        recs['scope-1-2-3'] = { id: 'scope-1-2-3', priority: 'low', dataCompleteness: 0, rationale: 'No corporate footprint data' };
        recs['ghg-inventory'] = { id: 'ghg-inventory', priority: 'low', dataCompleteness: 0, rationale: 'No emissions data available' };
        recs['key-findings'] = { id: 'key-findings', priority: 'low', dataCompleteness: 0, rationale: 'Requires multiple years of corporate reports' };
      }

      if (productCount > 0) {
        recs['product-footprints'] = { id: 'product-footprints', priority: productCount >= 5 ? 'high' : 'medium', dataCompleteness: Math.min(100, (productCount / 10) * 100), rationale: `${productCount} product LCA${productCount > 1 ? 's' : ''} available` };
        // Carbon origin and multi-capital derive from product LCA data
        recs['carbon-origin'] = { id: 'carbon-origin', priority: 'medium', dataCompleteness: 70, rationale: 'Derived from product LCA data' };
        recs['multi-capital'] = { id: 'multi-capital', priority: 'medium', dataCompleteness: 70, rationale: 'Water, land use, and other impacts from product LCAs' };
      } else {
        recs['product-footprints'] = { id: 'product-footprints', priority: 'low', dataCompleteness: 0, rationale: 'No product LCAs completed' };
        recs['carbon-origin'] = { id: 'carbon-origin', priority: 'low', dataCompleteness: 0, rationale: 'Requires product LCA data' };
        recs['multi-capital'] = { id: 'multi-capital', priority: 'low', dataCompleteness: 0, rationale: 'Requires product LCA data' };
      }

      if (supplierCount > 0) {
        recs['supply-chain'] = { id: 'supply-chain', priority: supplierCount >= 10 ? 'high' : 'medium', dataCompleteness: Math.min(100, (supplierCount / 20) * 100), rationale: `${supplierCount} supplier${supplierCount > 1 ? 's' : ''} tracked` };
      } else {
        recs['supply-chain'] = { id: 'supply-chain', priority: 'low', dataCompleteness: 0, rationale: 'No supplier data' };
      }

      if (facilityCount > 0) {
        recs['facilities'] = { id: 'facilities', priority: 'medium', dataCompleteness: Math.min(100, (facilityCount / 5) * 100), rationale: `${facilityCount} facilit${facilityCount > 1 ? 'ies' : 'y'} registered` };
      } else {
        recs['facilities'] = { id: 'facilities', priority: 'low', dataCompleteness: 0, rationale: 'No facility data' };
      }

      recs['targets'] = { id: 'targets', priority: config.audience === 'regulators' ? 'high' : 'medium', dataCompleteness: 100, rationale: 'Framework-based targets' };
      recs['methodology'] = { id: 'methodology', priority: config.audience === 'regulators' || config.audience === 'technical' ? 'high' : 'medium', dataCompleteness: 100, rationale: 'Calculation methodology documentation' };
      recs['regulatory'] = { id: 'regulatory', priority: config.standards.includes('csrd') ? 'high' : 'medium', dataCompleteness: 100, rationale: config.standards.includes('csrd') ? 'Required for CSRD compliance' : 'Standards alignment' };
      recs['appendix'] = { id: 'appendix', priority: 'low', dataCompleteness: 100, rationale: 'Supplementary data and assumptions' };

      // Impact Valuation — check if a calculation result exists
      const { data: ivResult } = await supabase
        .from('impact_valuation_results')
        .select('id, grand_total, data_coverage')
        .eq('organization_id', orgId)
        .eq('reporting_year', year)
        .maybeSingle();
      if (ivResult) {
        const coverage = ivResult.data_coverage || 0;
        recs['impact-valuation'] = { id: 'impact-valuation', priority: coverage > 50 ? 'high' : 'medium', dataCompleteness: Math.min(100, coverage), rationale: `Impact valuation calculated (${Math.round(coverage)}% data coverage)` };
      } else {
        recs['impact-valuation'] = { id: 'impact-valuation', priority: 'low', dataCompleteness: 0, rationale: 'No impact valuation calculated yet' };
      }

      // People & Culture — check if scores exist
      const { data: pcScore } = await supabase
        .from('people_culture_scores')
        .select('id, overall_score')
        .eq('organization_id', orgId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pcScore) {
        recs['people-culture'] = { id: 'people-culture', priority: 'high', dataCompleteness: 80, rationale: 'People & Culture score data available' };
      } else {
        // Check if any raw data exists
        const { count: compCount } = await supabase
          .from('people_employee_compensation')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true);
        recs['people-culture'] = { id: 'people-culture', priority: (compCount || 0) > 0 ? 'medium' : 'low', dataCompleteness: (compCount || 0) > 0 ? 40 : 0, rationale: (compCount || 0) > 0 ? 'Some workforce data available' : 'No people data captured yet' };
      }

      // Governance — check if mission or policies exist
      const { data: govMission } = await supabase
        .from('governance_mission')
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      const { count: policyCount } = await supabase
        .from('governance_policies')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      const hasGovData = !!govMission || (policyCount || 0) > 0;
      recs['governance'] = { id: 'governance', priority: hasGovData ? 'high' : 'low', dataCompleteness: hasGovData ? 70 : 0, rationale: hasGovData ? 'Governance data available' : 'No governance data captured yet' };

      // Community Impact — check if scores or donations exist
      const { data: ciScore } = await supabase
        .from('community_impact_scores')
        .select('id, overall_score')
        .eq('organization_id', orgId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ciScore) {
        recs['community-impact'] = { id: 'community-impact', priority: 'high', dataCompleteness: 80, rationale: 'Community impact score data available' };
      } else {
        const { count: donationCount } = await supabase
          .from('community_donations')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId);
        recs['community-impact'] = { id: 'community-impact', priority: (donationCount || 0) > 0 ? 'medium' : 'low', dataCompleteness: (donationCount || 0) > 0 ? 40 : 0, rationale: (donationCount || 0) > 0 ? 'Some community data available' : 'No community impact data yet' };
      }

      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAutoSelect() {
    const recommended = Object.values(recommendations)
      .filter(rec => rec.priority === 'high' && rec.dataCompleteness >= 50)
      .map(rec => rec.id);
    // Always include executive-summary
    if (!recommended.includes('executive-summary')) recommended.unshift('executive-summary');
    onChange({ sections: recommended });
  }

  function handleSelectAll() {
    const allIds = AVAILABLE_SECTIONS.filter(s => !s.comingSoon && (!s.requiresFeature || hasFeature(s.requiresFeature as FeatureCode))).map(s => s.id);
    onChange({ sections: allIds });
  }

  function handleSelectNone() {
    const required = AVAILABLE_SECTIONS.filter(s => s.required).map(s => s.id);
    onChange({ sections: required });
  }

  function handleToggle(sectionId: string, checked: boolean) {
    const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
    if (section?.required) return;
    const newSections = checked
      ? [...config.sections, sectionId]
      : config.sections.filter(s => s !== sectionId);
    onChange({ sections: newSections });
  }

  const getPriorityBadge = (rec?: SectionRecommendation) => {
    if (!rec) return null;
    switch (rec.priority) {
      case 'high': return <Badge className="bg-green-600 text-xs">Recommended</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-xs">Optional</Badge>;
      case 'low': return <Badge variant="outline" className="text-xs">Low Data</Badge>;
    }
  };

  const getCompletenessColor = (pct: number) => {
    if (pct >= 75) return 'bg-green-600';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <span className="font-medium">{config.sections.length} sections selected</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleAutoSelect}>
            <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
            Auto-Select Recommended
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSelectAll}>Select All</Button>
          <Button size="sm" variant="ghost" onClick={handleSelectNone}>Select None</Button>
        </div>
      </div>

      {/* Sections by Category */}
      {SECTION_CATEGORIES.map((category) => {
        const sectionsInCategory = AVAILABLE_SECTIONS.filter(s => s.category === category);
        if (sectionsInCategory.length === 0) return null;

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{category}</h3>
            {sectionsInCategory.map((section) => {
              const isSelected = config.sections.includes(section.id);
              const rec = recommendations[section.id];
              const isComingSoon = section.comingSoon;
              const isFeatureLocked = section.requiresFeature ? !hasFeature(section.requiresFeature as FeatureCode) : false;
              const isDisabled = isComingSoon || isFeatureLocked;

              return (
                <div
                  key={section.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' :
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50 cursor-pointer'
                  }`}
                  onClick={() => !isDisabled && handleToggle(section.id, !isSelected)}
                  title={isFeatureLocked ? 'Beta access required' : undefined}
                >
                  <Checkbox
                    checked={isSelected && !isFeatureLocked}
                    disabled={section.required || isDisabled}
                    onCheckedChange={(checked) => handleToggle(section.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{section.label}</span>
                      {section.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                      {isComingSoon && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Coming Soon
                        </Badge>
                      )}
                      {isFeatureLocked && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <Lock className="h-3 w-3 mr-1" />
                          Beta access required
                        </Badge>
                      )}
                      {section.requiresFeature && !isFeatureLocked && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-400 bg-amber-50 text-xs font-semibold"
                        >
                          BETA
                        </Badge>
                      )}
                      {!isDisabled && !section.requiresFeature && getPriorityBadge(rec)}
                      {!isDisabled && section.requiresFeature && !isFeatureLocked && getPriorityBadge(rec)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    {rec && !isDisabled && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">{rec.rationale}</p>
                    )}
                  </div>
                  {rec && !isDisabled && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${getCompletenessColor(rec.dataCompleteness)}`}
                          style={{ width: `${rec.dataCompleteness}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{rec.dataCompleteness}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
