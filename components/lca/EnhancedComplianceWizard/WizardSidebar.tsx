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

const STEP_HELP: Record<string, { tips: string[]; terms: TermExplanation[] }> = {
  'guide': {
    tips: [
      'Read through each section to understand the LCA process',
      'Note the data you will need to collect before starting',
      'You can skip this guide in future by ticking the checkbox below',
    ],
    terms: [
      { term: 'LCA', explanation: 'Lifecycle Assessment — a standardised method (ISO 14040/14044) for measuring the environmental impact of a product across its entire life' },
      { term: 'ISO 14044', explanation: 'The international standard specifying the requirements and guidelines for lifecycle assessment studies' },
      { term: 'ISO 14067', explanation: 'The standard for quantifying and reporting the carbon footprint of products, based on the LCA methodology' },
      { term: 'Functional Unit', explanation: 'A quantified description of the product function (e.g., "1 litre of beer at 5% ABV delivered to retailer")' },
      { term: 'System Boundary', explanation: 'Defines which life cycle stages are included: from cradle-to-gate (manufacturing) through to cradle-to-grave (full lifecycle)' },
      { term: 'kg CO₂e', explanation: 'Kilograms of carbon dioxide equivalent — the standard unit for expressing greenhouse gas emissions' },
    ],
  },
  'materials': {
    tips: [
      'All materials need verified emission factors',
      'Click "Fix" to search and assign missing factors',
      'Proxy factors can be used if an exact match is not available',
    ],
    terms: [
      { term: 'Emission Factor', explanation: 'A coefficient that quantifies the environmental impact per unit of a material (e.g., kg CO₂e per kg of barley)' },
      { term: 'Data Quality Tag', explanation: 'Indicates the reliability of the emission data: Primary (measured), Regional (averages), or Secondary (modelled)' },
    ],
  },
  'facilities': {
    tips: [
      'Enter the product volume manufactured at each facility',
      'Total facility production is used to calculate your product\'s share of emissions',
      'Select a reporting session to auto-fill facility totals',
    ],
    terms: [
      { term: 'Attribution', explanation: 'The proportion of a facility\'s total emissions allocated to your product, based on production volume share' },
    ],
  },
  'calculate': {
    tips: [
      'All materials must be validated before calculating',
      'The calculation typically takes 10-30 seconds',
      'Results will be saved as a new carbon footprint record',
    ],
    terms: [
      { term: 'Lifecycle Assessment', explanation: 'A comprehensive method to evaluate the environmental impact of a product across its lifecycle stages' },
    ],
  },
  'goal': {
    tips: [
      'Be specific about why this LCA is being conducted',
      'Consider who will use the results',
      'If comparing products, additional review may be required',
    ],
    terms: [
      { term: 'Intended Application', explanation: 'How the LCA results will be used (e.g., product improvement, marketing claims, regulatory compliance)' },
      { term: 'Comparative Assertion', explanation: 'A public claim that your product is environmentally better than a competitor. Requires third-party review.' },
    ],
  },
  'boundary': {
    tips: [
      'The functional unit should be measurable and relevant',
      'System boundary defines what is included in the assessment',
      'Wider boundaries (Shelf, Consumer, Grave) require additional configuration steps',
    ],
    terms: [
      { term: 'Functional Unit', explanation: 'A quantified description of the product function (e.g., "1 litre of beer at 5% ABV delivered to retailer")' },
      { term: 'System Boundary', explanation: 'Defines which life cycle stages are included: from cradle-to-gate (manufacturing) through to cradle-to-grave (full lifecycle)' },
    ],
  },
  'distribution': {
    tips: [
      'Select a scenario preset to auto-fill typical distribution routes',
      'Add multiple transport legs for multi-stage distribution (e.g. factory to warehouse, then warehouse to retail)',
      'Product weight is auto-calculated from your materials — adjust if the total shipped weight differs',
      'Use Ship mode for intercontinental routes — using Truck overestimates emissions by ~6×',
    ],
    terms: [
      { term: 'Distribution Leg', explanation: 'A single segment of the outbound transport chain, defined by transport mode (truck, train, ship, air) and distance' },
      { term: 'Tonne-km', explanation: 'The standard unit for freight transport: weight (tonnes) multiplied by distance (km). Used with DEFRA emission factors to calculate transport CO₂e' },
      { term: 'Outbound Distribution', explanation: 'Transport from the factory gate to the point of sale (shelf) or consumer. Distinct from inbound transport (supplier to factory), which is already included in raw material impacts' },
    ],
  },
  'use-phase': {
    tips: [
      'Defaults are auto-detected from your product category',
      'Refrigeration energy is the largest use-phase contributor for beverages',
      'Retail chillers consume more energy than domestic fridges',
      'Carbonation CO₂ release is biogenic (not fossil)',
    ],
    terms: [
      { term: 'Use Phase', explanation: 'The lifecycle stage covering consumer use of the product, including storage, refrigeration, and consumption' },
      { term: 'Biogenic CO₂', explanation: 'CO₂ from biological sources (e.g., fermentation, dissolved gas) — treated differently from fossil CO₂ in LCA' },
    ],
  },
  'end-of-life': {
    tips: [
      'Regional defaults reflect published recycling rates for your region',
      'Pathway percentages must sum to 100% for each material',
      'Recycling credits reduce your total footprint (avoided burden method)',
      'Aluminium has the highest recycling credit due to energy-intensive virgin production',
    ],
    terms: [
      { term: 'Avoided Burden', explanation: 'Recycling credits that offset emissions by displacing virgin material production — shown as negative values' },
      { term: 'End of Life', explanation: 'The disposal phase: how materials are managed after consumer use (recycling, landfill, incineration, composting)' },
    ],
  },
  'cutoff': {
    tips: [
      'Document any materials or processes excluded',
      'Typical cut-off threshold is 1% of mass or impact',
      'Capital goods are often excluded from screening LCAs',
    ],
    terms: [
      { term: 'Cut-off Criteria', explanation: 'Rules for excluding minor inputs that have negligible impact on the results (e.g., materials <1% by mass)' },
      { term: 'Mass-based Cut-off', explanation: 'Excluding inputs below a percentage of total product mass' },
    ],
  },
  'data-quality': {
    tips: [
      'Higher quality data leads to more reliable results',
      'Primary data from your operations is preferred',
      'Document the age and source of all data used',
    ],
    terms: [
      { term: 'Pedigree Matrix', explanation: 'A standardised way to score data quality across 5 dimensions: reliability, completeness, temporal, geographical, and technological representativeness' },
      { term: 'Uncertainty', explanation: 'The range within which the true value is expected to lie, expressed as a percentage or confidence interval' },
    ],
  },
  'interpretation': {
    tips: [
      'Focus on the hotspots (biggest contributors)',
      'Consider sensitivity to key assumptions',
      'Check that results are consistent with the goal',
    ],
    terms: [
      { term: 'Contribution Analysis', explanation: 'Identifying which materials or processes contribute most to the total impact' },
      { term: 'Sensitivity Analysis', explanation: 'Testing how changes in key inputs affect the final results' },
    ],
  },
  'review': {
    tips: [
      'Internal review is sufficient for internal use',
      'Public claims require external review',
      'Panel review is required for comparative assertions',
    ],
    terms: [
      { term: 'Critical Review', explanation: 'An independent check that the LCA methodology is sound and compliant with ISO standards' },
      { term: 'Panel Review', explanation: 'Review by a panel of experts, required when making public comparative claims' },
    ],
  },
  'summary': {
    tips: [
      'Review all compliance fields before generating',
      'Toggle Rosa narratives for richer reports',
      'Download or regenerate your PDF at any time',
      'You can return to edit any step later',
    ],
    terms: [
      { term: 'Rosa Narratives', explanation: 'Rosa-generated executive summary, key findings, and recommendations included in the PDF report' },
    ],
  },
};

// ============================================================================
// ROSA SUGGESTION CARD
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
          <span className="text-sm font-medium text-primary">Rosa Suggestion</span>
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
  const { progress, pcfId, formData, updateField, getStepId } = useWizardContext();
  const { toast } = useToast();

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = progress.currentStep;
  const currentStepId = getStepId(currentStep);
  const stepHelp = STEP_HELP[currentStepId] || { tips: [], terms: [] };

  // Map step ID to field for AI suggestions
  const getFieldForStep = (stepId: string): string | null => {
    switch (stepId) {
      case 'goal':
        return 'intended_application';
      case 'boundary':
        return 'functional_unit';
      case 'cutoff':
        return 'cutoff_criteria';
      default:
        return null;
    }
  };

  const fetchAiSuggestion = useCallback(async () => {
    const field = getFieldForStep(currentStepId);
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
  }, [currentStepId, pcfId, formData]);

  const handleApplySuggestion = (value: string) => {
    const field = getFieldForStep(currentStepId);
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

  const canGenerateSuggestion = getFieldForStep(currentStepId) !== null;

  return (
    <div className="space-y-4">
      {/* Rosa Suggestions */}
      {canGenerateSuggestion && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Rosa
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
                  Get Rosa's suggestions for this step
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
