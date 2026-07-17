'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useWizardContext } from './WizardContext';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';

// ============================================================================
// TYPES
// ============================================================================

interface TermExplanation {
  term: string;
  explanation: string;
}

// ============================================================================
// STEP-SPECIFIC HELP CONTENT
// ============================================================================
//
// Static, per-step tips and a term glossary. This is NOT a second assistant:
// the ambient Rosa drawer is the one assistant. The old Rosa-suggestions
// fetch panel (POST /api/lca/[pcfId]/ai-suggestions) has been removed. This
// content now lives as a quiet HELP aside AND is handed to Rosa's page
// context (see WizardStepHelpRosaBridge) so Rosa can answer from it.

export const STEP_HELP: Record<string, { tips: string[]; terms: TermExplanation[] }> = {
  'guide': {
    tips: [
      'Read through each section to understand the LCA process',
      'Note the data you will need to collect before starting',
      'You can skip this guide in future by ticking the checkbox below',
    ],
    terms: [
      { term: 'LCA', explanation: 'Lifecycle Assessment: a standardised method (ISO 14040/14044) for measuring the environmental impact of a product across its entire life' },
      { term: 'ISO 14044', explanation: 'The international standard specifying the requirements and guidelines for lifecycle assessment studies' },
      { term: 'ISO 14067', explanation: 'The standard for quantifying and reporting the carbon footprint of products, based on the LCA methodology' },
      { term: 'Functional Unit', explanation: 'A quantified description of the product function (e.g., "1 litre of beer at 5% ABV delivered to retailer")' },
      { term: 'System Boundary', explanation: 'Defines which life cycle stages are included: from cradle-to-gate (manufacturing) through to cradle-to-grave (full lifecycle)' },
      { term: 'kg CO₂e', explanation: 'Kilograms of carbon dioxide equivalent, the standard unit for expressing greenhouse gas emissions' },
    ],
  },
  'materials': {
    tips: [
      'We match every material to an emission factor for you when you open this step',
      'Check anything that looks wrong, and use "Not right? Choose yourself." to change it',
      'Where we cannot find an exact match, we use a conservative stand-in and flag it for our team',
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
      'Product weight is auto-calculated from your materials; adjust if the total shipped weight differs',
      'Use Ship mode for intercontinental routes; using Truck overestimates emissions by ~6×',
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
      { term: 'Biogenic CO₂', explanation: 'CO₂ from biological sources (e.g., fermentation, dissolved gas), treated differently from fossil CO₂ in LCA' },
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
      { term: 'Avoided Burden', explanation: 'Recycling credits that offset emissions by displacing virgin material production, shown as negative values' },
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
// ROSA PAGE-CONTEXT BRIDGE
// ============================================================================

/**
 * Hands the current step's static tips and glossary to the ambient Rosa
 * drawer so the one assistant can answer wizard questions without a second
 * on-screen assistant. Mount exactly once inside the wizard shell.
 */
export function WizardStepHelpRosaBridge() {
  const { progress, getStepId } = useWizardContext();
  const currentStepId = getStepId(progress.currentStep);
  const stepHelp = STEP_HELP[currentStepId] || { tips: [], terms: [] };

  const slice = useMemo(
    () => ({
      id: 'lca-wizard-step-help',
      label: `LCA wizard help for the ${currentStepId} step`,
      priority: 7,
      data: {
        current_step: currentStepId,
        tips: stepHelp.tips,
        glossary: stepHelp.terms.map((t) => ({ term: t.term, meaning: t.explanation })),
      },
    }),
    [currentStepId, stepHelp.tips, stepHelp.terms],
  );

  useRosaPageContext(slice);
  return null;
}

// ============================================================================
// TERMS GLOSSARY
// ============================================================================

function TermsGlossary({ terms }: { terms: TermExplanation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (terms.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
        Key terms
      </div>
      <div>
        {terms.map((term) => (
          <Collapsible
            key={term.term}
            open={expanded === term.term}
            onOpenChange={(open) => setExpanded(open ? term.term : null)}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 border-b border-studio-hairline py-2 text-left text-sm transition-colors hover:text-foreground">
              <span className="font-display font-semibold">{term.term}</span>
              {expanded === term.term ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-studio-dim" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-studio-dim" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="border-b border-studio-hairline py-2">
              <p className="text-sm text-studio-dim">{term.explanation}</p>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN HELP ASIDE (quiet static content, no assistant)
// ============================================================================

export function WizardSidebar({ className }: { className?: string }) {
  const { progress, getStepId } = useWizardContext();
  const currentStepId = getStepId(progress.currentStep);
  const stepHelp = STEP_HELP[currentStepId] || { tips: [], terms: [] };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
        Help
      </div>

      {/* Tips for the current step */}
      {stepHelp.tips.length > 0 && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            For this step
          </div>
          <ul className="space-y-2 pt-1">
            {stepHelp.tips.map((tip, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-studio-dim">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-studio-dim/50" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key terms glossary */}
      <TermsGlossary terms={stepHelp.terms} />

      {/* ISO compliance note, as a quiet tone row */}
      <div className="border-t border-studio-hairline pt-4">
        <p className="text-xs text-studio-dim">
          This wizard ensures your LCA report meets{' '}
          <span className="font-medium text-foreground">ISO 14044</span> and{' '}
          <span className="font-medium text-foreground">ISO 14067</span> requirements
          for product carbon footprints.
        </p>
      </div>
    </div>
  );
}
