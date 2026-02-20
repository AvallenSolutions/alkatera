'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles,
  Lightbulb,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useWizardContext } from './WizardContext';
import { WIZARD_STEPS } from './WizardProgress';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

interface AiSuggestion {
  field: string;
  suggestion: string;
  reasoning?: string;
  alternatives?: string[];
}

interface TermExplanation {
  term: string;
  explanation: string;
}

// ============================================================================
// STEP-SPECIFIC HELP CONTENT
// ============================================================================

const STEP_HELP: Record<number, { tips: string[]; terms: TermExplanation[] }> = {
  1: {
    tips: [
      'All materials need verified emission factors',
      'Click "Fix" to search and assign missing factors',
      'Proxy factors can be used if an exact match is not available',
    ],
    terms: [
      {
        term: 'Emission Factor',
        explanation: 'A coefficient that quantifies the environmental impact per unit of a material (e.g., kg CO₂e per kg of barley)',
      },
      {
        term: 'Data Quality Tag',
        explanation: 'Indicates the reliability of the emission data: Primary (measured), Regional (averages), or Secondary (modelled)',
      },
    ],
  },
  2: {
    tips: [
      'Enter the product volume manufactured at each facility',
      'Total facility production is used to calculate your product\'s share of emissions',
      'Select a reporting session to auto-fill facility totals',
    ],
    terms: [
      {
        term: 'Attribution',
        explanation: 'The proportion of a facility\'s total emissions allocated to your product, based on production volume share',
      },
    ],
  },
  3: {
    tips: [
      'All materials must be validated before calculating',
      'The calculation typically takes 10-30 seconds',
      'Results will be saved as a new carbon footprint record',
    ],
    terms: [
      {
        term: 'Lifecycle Assessment',
        explanation: 'A comprehensive method to evaluate the environmental impact of a product across its lifecycle stages',
      },
    ],
  },
  4: {
    tips: [
      'Be specific about why this LCA is being conducted',
      'Consider who will use the results',
      'If comparing products, additional review may be required',
    ],
    terms: [
      {
        term: 'Intended Application',
        explanation: 'How the LCA results will be used (e.g., product improvement, marketing claims, regulatory compliance)',
      },
      {
        term: 'Comparative Assertion',
        explanation: 'A public claim that your product is environmentally better than a competitor. Requires third-party review.',
      },
    ],
  },
  5: {
    tips: [
      'The functional unit should be measurable and relevant',
      'System boundary defines what is included in the assessment',
      'Cradle-to-gate is most common for manufacturing',
    ],
    terms: [
      {
        term: 'Functional Unit',
        explanation: 'A quantified description of the product function (e.g., "1 litre of beer at 5% ABV delivered to retailer")',
      },
      {
        term: 'System Boundary',
        explanation: 'Defines which life cycle stages are included: cradle-to-gate (materials to factory gate), cradle-to-grave (includes use and disposal)',
      },
    ],
  },
  6: {
    tips: [
      'Document any materials or processes excluded',
      'Typical cut-off threshold is 1% of mass or impact',
      'Capital goods are often excluded from screening LCAs',
    ],
    terms: [
      {
        term: 'Cut-off Criteria',
        explanation: 'Rules for excluding minor inputs that have negligible impact on the results (e.g., materials <1% by mass)',
      },
      {
        term: 'Mass-based Cut-off',
        explanation: 'Excluding inputs below a percentage of total product mass',
      },
    ],
  },
  7: {
    tips: [
      'Higher quality data leads to more reliable results',
      'Primary data from your operations is preferred',
      'Document the age and source of all data used',
    ],
    terms: [
      {
        term: 'Pedigree Matrix',
        explanation: 'A standardised way to score data quality across 5 dimensions: reliability, completeness, temporal, geographical, and technological representativeness',
      },
      {
        term: 'Uncertainty',
        explanation: 'The range within which the true value is expected to lie, expressed as a percentage or confidence interval',
      },
    ],
  },
  8: {
    tips: [
      'Focus on the hotspots (biggest contributors)',
      'Consider sensitivity to key assumptions',
      'Check that results are consistent with the goal',
    ],
    terms: [
      {
        term: 'Contribution Analysis',
        explanation: 'Identifying which materials or processes contribute most to the total impact',
      },
      {
        term: 'Sensitivity Analysis',
        explanation: 'Testing how changes in key inputs affect the final results',
      },
    ],
  },
  9: {
    tips: [
      'Internal review is sufficient for internal use',
      'Public claims require external review',
      'Panel review is required for comparative assertions',
    ],
    terms: [
      {
        term: 'Critical Review',
        explanation: 'An independent check that the LCA methodology is sound and compliant with ISO standards',
      },
      {
        term: 'Panel Review',
        explanation: 'Review by a panel of experts, required when making public comparative claims',
      },
    ],
  },
  10: {
    tips: [
      'Review all steps before completing',
      'Ensure all mandatory fields are filled',
      'You can return to edit any step later',
    ],
    terms: [],
  },
};

// ============================================================================
// AI SUGGESTION CARD
// ============================================================================

interface AiSuggestionCardProps {
  suggestion: AiSuggestion;
  onApply: (value: string) => void;
  loading?: boolean;
}

function AiSuggestionCard({ suggestion, onApply, loading }: AiSuggestionCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(suggestion.suggestion);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">AI Suggestion</span>
        </div>

        <p className="mb-3 text-sm leading-relaxed">{suggestion.suggestion}</p>

        {suggestion.reasoning && (
          <p className="mb-3 text-xs text-muted-foreground italic">
            {suggestion.reasoning}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onApply(suggestion.suggestion)}
            disabled={loading}
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={loading}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {suggestion.alternatives && suggestion.alternatives.length > 0 && (
          <Collapsible className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                <span>See alternatives</span>
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {suggestion.alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 rounded bg-background p-2 text-xs"
                >
                  <span>{alt}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => onApply(alt)}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TIPS SECTION
// ============================================================================

interface TipsSectionProps {
  tips: string[];
}

function TipsSection({ tips }: TipsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Tips for this step
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {tips.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="text-muted-foreground">{tip}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TERMS GLOSSARY
// ============================================================================

interface TermsGlossaryProps {
  terms: TermExplanation[];
}

function TermsGlossary({ terms }: TermsGlossaryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (terms.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          Key Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {terms.map((term) => (
            <Collapsible
              key={term.term}
              open={expanded === term.term}
              onOpenChange={(open) => setExpanded(open ? term.term : null)}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <span className="font-medium">{term.term}</span>
                {expanded === term.term ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2 pt-1">
                <p className="text-sm text-muted-foreground">
                  {term.explanation}
                </p>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN SIDEBAR
// ============================================================================

export function WizardSidebar() {
  const { progress, pcfId, formData, updateField } = useWizardContext();
  const { toast } = useToast();

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = progress.currentStep;
  const stepHelp = STEP_HELP[currentStep] || { tips: [], terms: [] };

  // Map step number to field for AI suggestions (only for post-calc steps)
  const getFieldForStep = (step: number): string | null => {
    switch (step) {
      case 4:
        return 'intended_application';
      case 5:
        return 'functional_unit';
      case 6:
        return 'cutoff_criteria';
      default:
        return null;
    }
  };

  const fetchAiSuggestion = useCallback(async () => {
    const field = getFieldForStep(currentStep);
    if (!field) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/lca/${pcfId}/ai-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Cookies are sent automatically — no need for manual token
        },
        body: JSON.stringify({
          field,
          context: {
            functionalUnit: formData.functionalUnit,
            systemBoundary: formData.systemBoundary,
            isComparativeAssertion: formData.isComparativeAssertion,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestion');
      }

      const data = await response.json();
      setAiSuggestion({
        field,
        suggestion: data.suggestion,
        reasoning: data.reasoning,
        alternatives: data.alternatives,
      });
    } catch (err: any) {
      console.error('[WizardSidebar] AI suggestion error:', err);
      setError('Could not generate suggestion. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentStep, pcfId, formData]);

  const handleApplySuggestion = (value: string) => {
    const field = getFieldForStep(currentStep);
    if (!field) return;

    // Map API field names to form field names
    const fieldMap: Record<string, keyof typeof formData> = {
      intended_application: 'intendedApplication',
      functional_unit: 'functionalUnit',
      cutoff_criteria: 'cutoffCriteria',
    };

    const formField = fieldMap[field];
    if (formField) {
      updateField(formField, value);
      toast({ title: 'Suggestion applied' });
    }
  };

  const canGenerateSuggestion = getFieldForStep(currentStep) !== null;

  return (
    <div className="space-y-4">
      {/* AI Suggestions */}
      {canGenerateSuggestion && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Assistant
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAiSuggestion}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : aiSuggestion ? (
              <AiSuggestionCard
                suggestion={aiSuggestion}
                onApply={handleApplySuggestion}
                loading={loading}
              />
            ) : (
              <div className="text-center">
                <p className="mb-3 text-sm text-muted-foreground">
                  Get AI-powered suggestions for this step
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAiSuggestion}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate Suggestion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips for current step */}
      {stepHelp.tips.length > 0 && <TipsSection tips={stepHelp.tips} />}

      {/* Key terms glossary */}
      {stepHelp.terms.length > 0 && <TermsGlossary terms={stepHelp.terms} />}

      {/* ISO compliance note */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />
          <p className="text-xs text-muted-foreground">
            This wizard ensures your LCA report meets{' '}
            <strong>ISO 14044</strong> and <strong>ISO 14067</strong> requirements
            for product carbon footprints.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
