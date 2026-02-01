'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  evaluateCompliance,
  type ComplianceResult,
  type ComplianceSection,
  type ComplianceItem,
  type PcfComplianceData,
} from '@/lib/lca-compliance-checker';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ComplianceTrackerProps {
  pcfId: string;
  lcaData: any;
  onNavigateToTab?: (tab: string) => void;
  onOpenWizard?: () => void;
}

const SECTION_TAB_MAP: Record<string, string> = {
  goal: 'goal-scope',
  scope: 'goal-scope',
  data_quality: 'goal-scope',
  inventory: 'impact',
  impact: 'impact',
  interpretation: 'interpretation',
  review: 'review',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  complete: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  incomplete: <AlertCircle className="h-4 w-4 text-amber-500" />,
  not_started: <Circle className="h-4 w-4 text-slate-300" />,
};

export default function ComplianceTracker({ pcfId, lcaData, onNavigateToTab, onOpenWizard }: ComplianceTrackerProps) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const fetchComplianceData = useCallback(async () => {
    setLoading(true);

    // Fetch interpretation data
    const { data: interpRow } = await supabase
      .from('lca_interpretation_results')
      .select('completeness_score, methodology_consistent, key_findings, sensitivity_results')
      .eq('product_carbon_footprint_id', pcfId)
      .maybeSingle();

    // Fetch review data
    let reviewRow = null;
    try {
      const res = await fetch(`/api/lca/${pcfId}/review`);
      if (res.ok) {
        reviewRow = await res.json();
      }
    } catch {
      // no review
    }

    const complianceData: PcfComplianceData = {
      intended_application: lcaData?.intended_application,
      reasons_for_study: lcaData?.reasons_for_study,
      intended_audience: lcaData?.intended_audience,
      is_comparative_assertion: lcaData?.is_comparative_assertion,
      assumptions_limitations: lcaData?.assumptions_limitations,
      data_quality_requirements: lcaData?.data_quality_requirements,
      critical_review_type: lcaData?.critical_review_type,
      critical_review_justification: lcaData?.critical_review_justification,
      functional_unit: lcaData?.functional_unit,
      system_boundary: lcaData?.system_boundary,
      reference_year: lcaData?.reference_year,
      aggregated_impacts: lcaData?.aggregated_impacts,
      dqi_score: lcaData?.dqi_score,
      hasMaterials: (lcaData?.materials?.length || 0) > 0,
      hasInterpretation: !!interpRow,
      interpretationData: interpRow || null,
      hasReview: !!reviewRow,
      reviewData: reviewRow || null,
    };

    setResult(evaluateCompliance(complianceData));
    setLoading(false);
  }, [pcfId, lcaData]);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const scoreColor =
    result.overallScore >= 80 ? 'text-emerald-600' :
    result.overallScore >= 50 ? 'text-amber-600' :
    'text-red-600';

  const scoreBg =
    result.overallScore >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' :
    result.overallScore >= 50 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
    'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';

  return (
    <Card className={`border-2 ${scoreBg}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {result.overallScore}%
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">ISO 14044 Compliance</CardTitle>
              <p className="text-xs text-muted-foreground">
                {result.completedSections}/{result.totalSections} sections complete
                {result.requiredActionCount > 0 && (
                  <> &middot; <span className="text-amber-600 font-medium">{result.requiredActionCount} actions needed</span></>
                )}
              </p>
            </div>
          </div>
          {onOpenWizard && result.overallScore < 100 && (
            <Button size="sm" onClick={onOpenWizard} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Complete Guide
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              result.overallScore >= 80 ? 'bg-emerald-500' :
              result.overallScore >= 50 ? 'bg-amber-500' :
              'bg-red-500'
            }`}
            style={{ width: `${result.overallScore}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-1 pt-0">
        {result.sections.map((section) => (
          <div key={section.id} className="rounded-lg border bg-background/50">
            <button
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              {STATUS_ICON[section.status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{section.title}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{section.isoRef}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{section.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{section.completedItems}/{section.totalItems}</span>
                {expandedSection === section.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {expandedSection === section.id && (
              <div className="px-3 pb-3 space-y-1.5">
                {section.items.map((item) => (
                  <ComplianceItemRow key={item.id} item={item} />
                ))}
                {onNavigateToTab && SECTION_TAB_MAP[section.id] && section.status !== 'complete' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs gap-1.5 text-blue-600 hover:text-blue-700"
                    onClick={() => onNavigateToTab(SECTION_TAB_MAP[section.id])}
                  >
                    Go to {section.title} <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ComplianceItemRow({ item }: { item: ComplianceItem }) {
  return (
    <div className="flex items-start gap-2 pl-7 py-1">
      {item.complete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
      ) : (
        <Circle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${item.required ? 'text-amber-400' : 'text-slate-300'}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs ${item.complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {item.label}
          </span>
          {item.required && !item.complete && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-300">Required</Badge>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{item.hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
