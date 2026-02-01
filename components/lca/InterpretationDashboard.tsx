'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RefreshCw,
  Shield,
  Target,
  TrendingUp,
  XCircle,
  Activity,
  Lightbulb,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { LcaInterpretationResult, ContributionAnalysis, SensitivityAnalysis } from '@/lib/types/lca';

interface InterpretationDashboardProps {
  pcfId: string;
}

export default function InterpretationDashboard({ pcfId }: InterpretationDashboardProps) {
  const [interpretation, setInterpretation] = useState<LcaInterpretationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('contribution');

  const fetchInterpretation = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('lca_interpretation_results')
      .select('*')
      .eq('product_carbon_footprint_id', pcfId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setInterpretation(data);
    }
    setLoading(false);
  }, [pcfId]);

  useEffect(() => {
    fetchInterpretation();
  }, [fetchInterpretation]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/lca/${pcfId}/interpretation`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate');
      }
      const data = await res.json();
      setInterpretation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!interpretation) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Target className="h-12 w-12 text-muted-foreground/40" />
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Life Cycle Interpretation</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Generate an ISO 14044 compliant interpretation including contribution analysis,
              sensitivity analysis, completeness checks, and auto-generated conclusions.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate Interpretation'}
          </Button>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const contributionAnalysis = interpretation.contribution_analysis as Record<string, ContributionAnalysis>;
  const climateContrib = contributionAnalysis?.climate;
  const sensitivityResults = (interpretation.sensitivity_results || []) as SensitivityAnalysis[];

  return (
    <div className="space-y-4">
      {/* Header with regenerate */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            Life Cycle Interpretation
          </h2>
          <p className="text-sm text-muted-foreground">ISO 14044 Section 4.5</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate
        </Button>
      </div>

      {/* Guide banner */}
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            This section shows the results of your ISO 14044 interpretation analysis. <strong>Contribution analysis</strong> shows which materials matter most. <strong>Sensitivity analysis</strong> shows which inputs, if changed, would most affect results. <strong>Completeness checks</strong> verify your data covers all lifecycle stages. Review the conclusions at the bottom and edit if needed.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Completeness</p>
            <p className="text-2xl font-bold">{interpretation.completeness_score?.toFixed(0) || 0}%</p>
          </CardContent>
        </Card>
        <Card className={`border ${interpretation.methodology_consistent ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-semibold">Consistency</p>
            <p className="text-2xl font-bold">{interpretation.methodology_consistent ? 'Pass' : 'Issues'}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Sensitive Params</p>
            <p className="text-2xl font-bold">{interpretation.highly_sensitive_parameters?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className={`border ${interpretation.mass_balance_valid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs font-semibold">Mass Balance</p>
            <p className="text-2xl font-bold">{interpretation.mass_balance_valid ? 'Valid' : 'Check'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Contribution Analysis */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('contribution')}
        >
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Contribution Analysis
              <Badge variant="outline" className="text-xs">4.5.2</Badge>
            </div>
            {expandedSection === 'contribution' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>Identifies which materials/processes contribute most to each impact category</CardDescription>
        </CardHeader>
        {expandedSection === 'contribution' && climateContrib && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Climate Change — Top Contributors</h4>
              {climateContrib.contributions.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="w-8 text-center text-xs font-bold text-muted-foreground">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.material}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{c.absolute_value.toFixed(3)} kg CO₂eq</span>
                        <Badge variant={c.is_dominant ? 'destructive' : c.is_significant ? 'default' : 'secondary'} className="text-xs">
                          {c.percentage_contribution.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${c.is_dominant ? 'bg-red-500' : c.is_significant ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(c.percentage_contribution, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Significant Issues */}
            {interpretation.significant_issues && interpretation.significant_issues.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Significant Issues
                </h4>
                <ul className="space-y-1">
                  {interpretation.significant_issues.map((issue, i) => (
                    <li key={i} className="text-xs text-amber-800 dark:text-amber-200">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Sensitivity Analysis */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('sensitivity')}
        >
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Sensitivity Analysis
              <Badge variant="outline" className="text-xs">4.5.3</Badge>
            </div>
            {expandedSection === 'sensitivity' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>±10% variation applied to top 3 contributing materials</CardDescription>
        </CardHeader>
        {expandedSection === 'sensitivity' && (
          <CardContent>
            {sensitivityResults.length > 0 ? (
              <div className="space-y-3">
                {sensitivityResults.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{s.material_name || s.parameter}</p>
                        <p className="text-xs text-muted-foreground">{s.parameter}</p>
                      </div>
                      <Badge variant={s.is_highly_sensitive ? 'destructive' : 'secondary'} className="text-xs">
                        {s.is_highly_sensitive ? 'Highly Sensitive' : 'Low Sensitivity'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Baseline</p>
                        <p className="font-semibold">{s.baseline_result.toFixed(3)} kg CO₂eq</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Result Range (±10%)</p>
                        <p className="font-semibold">{s.result_range.min.toFixed(3)} – {s.result_range.max.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sensitivity Ratio</p>
                        <p className="font-semibold">{s.sensitivity_ratio.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sensitivity results available.</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Completeness & Consistency */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('completeness')}
        >
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-600" />
              Completeness & Consistency Checks
              <Badge variant="outline" className="text-xs">4.5.3</Badge>
            </div>
            {expandedSection === 'completeness' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {expandedSection === 'completeness' && (
          <CardContent className="space-y-4">
            {/* Data Coverage by Stage */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data Coverage by Lifecycle Stage</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(interpretation.data_coverage_by_stage || {}).map(([stage, pct]) => (
                  <div key={stage} className="p-2 rounded-lg border flex items-center gap-2">
                    {Number(pct) > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium capitalize">{stage.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{Number(pct).toFixed(0)}% coverage</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Data Flags */}
            {interpretation.missing_data_flags && Object.keys(interpretation.missing_data_flags).length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2">Missing Data</h4>
                {Object.entries(interpretation.missing_data_flags).map(([stage, flags]) => (
                  <div key={stage} className="mb-1">
                    <p className="text-xs font-medium capitalize">{stage.replace(/_/g, ' ')}</p>
                    {(flags as string[]).map((flag, i) => (
                      <p key={i} className="text-xs text-amber-800 dark:text-amber-200 ml-2">• {flag}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Consistency Issues */}
            {interpretation.consistency_issues && interpretation.consistency_issues.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">Consistency Issues</h4>
                {interpretation.consistency_issues.map((issue, i) => (
                  <p key={i} className="text-xs text-blue-800 dark:text-blue-200">• {issue}</p>
                ))}
              </div>
            )}

            {/* Mass Balance */}
            <div className="p-3 rounded-lg border">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" /> Mass Balance Validation
              </h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Input Mass</p>
                  <p className="font-semibold">{Number(interpretation.mass_balance_input_kg || 0).toFixed(3)} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Output Mass</p>
                  <p className="font-semibold">{Number(interpretation.mass_balance_output_kg || 0).toFixed(3)} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Variance</p>
                  <p className="font-semibold">{Number(interpretation.mass_balance_variance_pct || 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Conclusions & Recommendations */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => toggleSection('conclusions')}
        >
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              Conclusions & Recommendations
              <Badge variant="outline" className="text-xs">4.5.4</Badge>
            </div>
            {expandedSection === 'conclusions' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {expandedSection === 'conclusions' && (
          <CardContent className="space-y-4">
            {/* Key Findings */}
            {interpretation.key_findings && interpretation.key_findings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Key Findings
                </h4>
                <ul className="space-y-1">
                  {interpretation.key_findings.map((finding, i) => (
                    <li key={i} className="text-sm text-foreground/80 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-emerald-500">
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Limitations */}
            {interpretation.limitations && interpretation.limitations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Limitations
                </h4>
                <ul className="space-y-1">
                  {interpretation.limitations.map((lim, i) => (
                    <li key={i} className="text-sm text-foreground/80 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-amber-500">
                      {lim}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {interpretation.recommendations && interpretation.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Lightbulb className="h-3.5 w-3.5" /> Recommendations
                </h4>
                <ul className="space-y-1">
                  {interpretation.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-foreground/80 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-blue-500">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Uncertainty Statement */}
            {interpretation.uncertainty_statement && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border">
                <h4 className="text-xs font-semibold mb-1">Uncertainty Statement</h4>
                <p className="text-xs text-muted-foreground">{interpretation.uncertainty_statement}</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
