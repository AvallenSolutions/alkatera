'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  BarChart3,
  TrendingUp,
  FileCheck,
  RefreshCw,
  Lightbulb,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import type { LcaInterpretationResult, MaterialContribution } from '@/lib/types/lca';

// ============================================================================
// CONTRIBUTION CHART (uses real MaterialContribution shape)
// ============================================================================

interface ContributionChartProps {
  contributions: MaterialContribution[];
  unit: string;
}

function ContributionChart({ contributions, unit }: ContributionChartProps) {
  const colors = [
    'bg-primary',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
  ];

  // Show top 5 + aggregate "Other" if more than 5
  const top = contributions.slice(0, 5);
  const rest = contributions.slice(5);
  const otherAbsolute = rest.reduce((sum, c) => sum + c.absolute_value, 0);
  const otherPct = rest.reduce((sum, c) => sum + c.percentage_contribution, 0);

  const items = [...top];
  if (rest.length > 0) {
    items.push({
      material: 'Other',
      material_type: 'mixed',
      stage: 'mixed',
      absolute_value: otherAbsolute,
      percentage_contribution: otherPct,
      is_significant: false,
      is_dominant: false,
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.material} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span>{item.material}</span>
              {item.is_significant && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  significant
                </Badge>
              )}
            </div>
            <span className="font-medium">
              {item.percentage_contribution < 1 && item.percentage_contribution > 0
                ? '<1'
                : Math.round(item.percentage_contribution)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all',
                colors[idx] || 'bg-gray-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, item.percentage_contribution))}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {item.absolute_value.toFixed(item.absolute_value < 0.01 ? 4 : 2)}{' '}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function InterpretationStep() {
  const { formData, updateField, pcfId } = useWizardContext();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [interpretation, setInterpretation] =
    useState<LcaInterpretationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // LOAD EXISTING INTERPRETATION ON MOUNT
  // ============================================================================

  useEffect(() => {
    if (!pcfId) {
      setInitialLoading(false);
      return;
    }

    async function loadExisting() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setInitialLoading(false);
          return;
        }

        const response = await fetch(`/api/lca/${pcfId}/interpretation`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data: LcaInterpretationResult = await response.json();
          setInterpretation(data);
          if (!formData.hasInterpretation) {
            updateField('hasInterpretation', true);
            updateField('interpretationId', data.id);
          }
        }
        // 404 = no interpretation yet — show Generate button
      } catch (err) {
        console.error('[InterpretationStep] Failed to load:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcfId]);

  // ============================================================================
  // GENERATE INTERPRETATION (POST)
  // ============================================================================

  const generateInterpretation = async () => {
    if (!pcfId) {
      setError('No LCA calculation found. Please run the calculation step first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated. Please refresh the page and try again.');
      }

      const response = await fetch(`/api/lca/${pcfId}/interpretation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 401) {
          throw new Error('Your session has expired. Please refresh the page and sign in again.');
        } else if (response.status === 404) {
          throw new Error('LCA calculation not found. Please run the calculation step first.');
        } else {
          throw new Error(err.error || `Server error (${response.status}). Please try again.`);
        }
      }

      const data: LcaInterpretationResult = await response.json();
      setInterpretation(data);
      updateField('hasInterpretation', true);
      updateField('interpretationId', data.id);
    } catch (err: any) {
      console.error('[InterpretationStep] Error:', err);
      setError(err.message || 'Failed to generate interpretation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // DERIVED VALUES FROM REAL DATA
  // ============================================================================

  const climateData = interpretation?.contribution_analysis?.climate;
  const contributions = climateData?.contributions || [];
  const totalClimate = climateData?.total_impact || 0;
  const climateUnit = climateData?.unit || 'kg CO₂eq';

  // Dominant phase from top contributor
  const dominantStage = (() => {
    if (contributions.length === 0) return 'Unknown';
    const topStage = contributions[0]?.stage;
    if (topStage === 'packaging') return 'Packaging';
    return 'Raw Materials';
  })();

  // Completeness
  const coverageByStage = interpretation?.data_coverage_by_stage || {};
  const stageKeys = Object.keys(coverageByStage);
  const avgCoverage =
    stageKeys.length > 0
      ? Math.round(
          stageKeys.reduce((sum, k) => sum + (coverageByStage[k] || 0), 0) /
            stageKeys.length
        )
      : 0;
  const missingItems = Object.values(
    interpretation?.missing_data_flags || {}
  ).flat();

  // Consistency
  const consistencyPassed =
    interpretation?.methodology_consistent === true &&
    (interpretation?.consistency_issues || []).length === 0;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Interpretation</h3>
        <p className="text-sm text-muted-foreground">
          Review the interpretation of your LCA results. ISO 14044 requires
          contribution analysis, sensitivity analysis, and completeness checks.
        </p>
      </div>

      {/* Initial loading */}
      {initialLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading interpretation data...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generate button if no interpretation exists */}
      {!interpretation && !loading && !initialLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 text-lg font-medium">
              Generate Interpretation Analysis
            </h4>
            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
              We&apos;ll analyse your LCA results to identify hotspots, test
              sensitivity to key parameters, and verify data completeness.
            </p>
            {!pcfId && (
              <p className="mb-4 text-sm text-destructive">
                Please run the calculation step first.
              </p>
            )}
            <Button
              onClick={generateInterpretation}
              disabled={loading || !pcfId}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Generate Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analysing your LCA results...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Running contribution, sensitivity, and completeness checks
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              This usually takes about 5 seconds
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ================================================================== */}
      {/* INTERPRETATION RESULTS                                             */}
      {/* ================================================================== */}
      {interpretation && !loading && (
        <div className="space-y-4">
          {/* Contribution Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Contribution Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contributions.length > 0 ? (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    <strong>{dominantStage}</strong> is the dominant lifecycle
                    phase, contributing most to the overall carbon footprint of{' '}
                    <strong>
                      {totalClimate.toFixed(2)} {climateUnit}
                    </strong>
                    .
                  </p>
                  <ContributionChart
                    contributions={contributions}
                    unit={climateUnit}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No contribution data available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sensitivity Analysis */}
          {interpretation.sensitivity_results &&
            interpretation.sensitivity_results.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Sensitivity Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    How changes in key parameters affect your results:
                  </p>
                  <div className="space-y-3">
                    {interpretation.sensitivity_results.map((param, idx) => {
                      const rangeMin = param.variation_range?.min ?? 0;
                      const rangeMax = param.variation_range?.max ?? 0;
                      const resultMin = param.result_range?.min ?? 0;
                      const resultMax = param.result_range?.max ?? 0;
                      const variationPct = Math.round(
                        ((rangeMax - rangeMin) /
                          Math.max(param.baseline_result, 0.001)) *
                          50
                      );
                      return (
                        <div
                          key={`${param.parameter}-${idx}`}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-medium">
                              {param.material_name || param.parameter || 'Unknown parameter'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Range: {resultMin.toFixed(3)} –{' '}
                              {resultMax.toFixed(3)} {climateUnit}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'font-medium',
                                  param.is_highly_sensitive
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                                )}
                              >
                                ±{variationPct}%
                              </span>
                              {param.is_highly_sensitive && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-500/30"
                                >
                                  sensitive
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              impact change
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Completeness Check */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck className="h-4 w-4" />
                Completeness Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Data Coverage</span>
                <span className="font-medium">{avgCoverage}%</span>
              </div>
              <Progress value={avgCoverage} className="h-2" />

              {/* Per-stage breakdown */}
              {stageKeys.length > 0 && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {stageKeys.map((stage) => (
                    <div
                      key={stage}
                      className="flex items-center justify-between rounded border px-2 py-1"
                    >
                      <span className="text-muted-foreground capitalize">
                        {stage.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={cn(
                          'font-medium',
                          coverageByStage[stage] >= 80
                            ? 'text-green-600'
                            : coverageByStage[stage] >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        )}
                      >
                        {coverageByStage[stage]}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {missingItems.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Data gaps identified:
                  </p>
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {missingItems.slice(0, 5).map((item, idx) => (
                      <li key={`missing-${idx}`}>{item}</li>
                    ))}
                    {missingItems.length > 5 && (
                      <li className="text-muted-foreground/60">
                        ...and {missingItems.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consistency Check */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {consistencyPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                Consistency Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consistencyPassed ? (
                <p className="text-sm text-green-600">
                  All consistency checks passed. Data sources and methodology
                  are applied consistently across the study.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-yellow-600">
                    Some consistency issues detected:
                  </p>
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {(interpretation.consistency_issues || []).map((issue, idx) => (
                      <li key={`issue-${idx}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Findings */}
          {interpretation.key_findings &&
            interpretation.key_findings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4" />
                    Key Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {interpretation.key_findings.map((finding, idx) => (
                      <li key={`finding-${idx}`}>{finding}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

          {/* Limitations */}
          {interpretation.limitations &&
            interpretation.limitations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4" />
                    Limitations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {interpretation.limitations.map((limitation, idx) => (
                      <li key={`limitation-${idx}`}>{limitation}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

          {/* Recommendations */}
          {interpretation.recommendations &&
            interpretation.recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {interpretation.recommendations.map((rec, idx) => (
                      <li key={`rec-${idx}`}>{rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

          {/* Uncertainty Statement */}
          {interpretation.uncertainty_statement && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Uncertainty Assessment:</strong>{' '}
                {interpretation.uncertainty_statement}
              </AlertDescription>
            </Alert>
          )}

          {/* Regenerate button */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm text-muted-foreground">
              Analysis generated:{' '}
              {(() => {
                const ts = interpretation.updated_at || interpretation.created_at;
                if (!ts) return 'just now';
                const d = new Date(ts);
                return isNaN(d.getTime()) ? 'just now' : d.toLocaleDateString();
              })()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInterpretation}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* ISO Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>ISO 14044 Section 4.5:</strong> Interpretation shall include
          identification of significant issues, evaluation (completeness,
          sensitivity, consistency checks), and conclusions/recommendations.
        </AlertDescription>
      </Alert>
    </div>
  );
}
