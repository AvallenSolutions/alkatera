'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  BarChart3,
  TrendingUp,
  FileCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface InterpretationResult {
  id: string;
  contributionAnalysis: {
    topContributors: Array<{
      name: string;
      percentage: number;
      impact: number;
    }>;
    phase: string;
  };
  sensitivityAnalysis: {
    parameters: Array<{
      name: string;
      variation: string;
      impactChange: number;
    }>;
  };
  completenessCheck: {
    score: number;
    missingData: string[];
    coveragePercentage: number;
  };
  consistencyCheck: {
    passed: boolean;
    issues: string[];
  };
  createdAt: string;
}

// ============================================================================
// MOCK DATA (replace with actual API call)
// ============================================================================

const MOCK_INTERPRETATION: InterpretationResult = {
  id: 'interp-001',
  contributionAnalysis: {
    topContributors: [
      { name: 'Glass Bottles', percentage: 45, impact: 0.89 },
      { name: 'Malt', percentage: 22, impact: 0.43 },
      { name: 'Electricity', percentage: 15, impact: 0.29 },
      { name: 'Transport', percentage: 10, impact: 0.20 },
      { name: 'Other', percentage: 8, impact: 0.16 },
    ],
    phase: 'Packaging',
  },
  sensitivityAnalysis: {
    parameters: [
      { name: 'Electricity grid mix', variation: '±20%', impactChange: 8 },
      { name: 'Transport distance', variation: '±50km', impactChange: 5 },
      { name: 'Glass recycled content', variation: '±10%', impactChange: 4 },
    ],
  },
  completenessCheck: {
    score: 85,
    missingData: ['Tap water treatment', 'Minor cleaning agents'],
    coveragePercentage: 98,
  },
  consistencyCheck: {
    passed: true,
    issues: [],
  },
  createdAt: new Date().toISOString(),
};

// ============================================================================
// CONTRIBUTION CHART
// ============================================================================

interface ContributionChartProps {
  contributors: InterpretationResult['contributionAnalysis']['topContributors'];
}

function ContributionChart({ contributors }: ContributionChartProps) {
  const colors = [
    'bg-primary',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
  ];

  return (
    <div className="space-y-3">
      {contributors.map((item, idx) => (
        <div key={item.name} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{item.name}</span>
            <span className="font-medium">{item.percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full transition-all', colors[idx] || 'bg-gray-500')}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {item.impact.toFixed(2)} kg CO₂e
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
  const [interpretation, setInterpretation] =
    useState<InterpretationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if interpretation exists
  useEffect(() => {
    if (formData.hasInterpretation && formData.interpretationId) {
      // In production, fetch from API
      // For now, use mock data
      setInterpretation(MOCK_INTERPRETATION);
    }
  }, [formData.hasInterpretation, formData.interpretationId]);

  const generateInterpretation = async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, call the interpretation API
      // const response = await fetch(`/api/lca/${pcfId}/interpretation`, {
      //   method: 'POST',
      // });
      // const data = await response.json();

      // For now, simulate API delay and use mock data
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setInterpretation(MOCK_INTERPRETATION);
      updateField('hasInterpretation', true);
      updateField('interpretationId', MOCK_INTERPRETATION.id);
    } catch (err: any) {
      console.error('[InterpretationStep] Error:', err);
      setError('Failed to generate interpretation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Generate button if no interpretation exists */}
      {!interpretation && !loading && (
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
            <Button onClick={generateInterpretation} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
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

      {/* Interpretation results */}
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
              <p className="mb-4 text-sm text-muted-foreground">
                <strong>{interpretation.contributionAnalysis.phase}</strong> is
                the dominant lifecycle phase, contributing most to the overall
                carbon footprint.
              </p>
              <ContributionChart
                contributors={interpretation.contributionAnalysis.topContributors}
              />
            </CardContent>
          </Card>

          {/* Sensitivity Analysis */}
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
                {interpretation.sensitivityAnalysis.parameters.map((param) => (
                  <div
                    key={param.name}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{param.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Variation: {param.variation}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          param.impactChange > 5
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        )}
                      >
                        ±{param.impactChange}%
                      </span>
                      <p className="text-xs text-muted-foreground">
                        impact change
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                <span className="font-medium">
                  {interpretation.completenessCheck.coveragePercentage}%
                </span>
              </div>
              <Progress
                value={interpretation.completenessCheck.coveragePercentage}
                className="h-2"
              />

              {interpretation.completenessCheck.missingData.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Minor data gaps (excluded via cut-off):
                  </p>
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {interpretation.completenessCheck.missingData.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consistency Check */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {interpretation.consistencyCheck.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                Consistency Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interpretation.consistencyCheck.passed ? (
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
                    {interpretation.consistencyCheck.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regenerate button */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm text-muted-foreground">
              Analysis generated:{' '}
              {new Date(interpretation.createdAt).toLocaleDateString()}
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
