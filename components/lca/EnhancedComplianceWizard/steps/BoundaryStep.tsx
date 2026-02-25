'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Info, AlertTriangle, Lock, Box, ArrowRight, Factory, Truck, Users, Trash2, Lightbulb } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { useSubscription, type TierName } from '@/hooks/useSubscription';
import { boundaryNeedsUsePhase, boundaryNeedsEndOfLife } from '@/lib/system-boundaries';
import { cn } from '@/lib/utils';

// ============================================================================
// SYSTEM BOUNDARY OPTIONS
// ============================================================================

const SYSTEM_BOUNDARY_OPTIONS = [
  {
    value: 'cradle-to-gate',
    label: 'Cradle-to-Gate',
    subtitle: 'Manufacturing only',
    description: 'Raw materials through to factory gate (most common for manufacturers)',
    icon: Factory,
    stages: ['Raw Materials', 'Processing', 'Packaging'],
    requiredTier: 'seed' as TierName,
  },
  {
    value: 'cradle-to-shelf',
    label: 'Cradle-to-Shelf',
    subtitle: 'Manufacturing + delivery to store',
    description: 'Includes distribution to point of sale',
    icon: Truck,
    stages: ['Raw Materials', 'Processing', 'Packaging', 'Distribution'],
    requiredTier: 'blossom' as TierName,
  },
  {
    value: 'cradle-to-consumer',
    label: 'Cradle-to-Consumer',
    subtitle: 'Including customer use',
    description: 'Includes consumer use phase (refrigeration, carbonation)',
    icon: Users,
    stages: ['Raw Materials', 'Processing', 'Packaging', 'Distribution', 'Use Phase'],
    requiredTier: 'canopy' as TierName,
  },
  {
    value: 'cradle-to-grave',
    label: 'Cradle-to-Grave',
    subtitle: 'Full lifecycle including disposal',
    description: 'Full lifecycle including end-of-life disposal & recycling credits',
    icon: Trash2,
    stages: ['Raw Materials', 'Processing', 'Packaging', 'Distribution', 'Use Phase', 'End of Life'],
    requiredTier: 'canopy' as TierName,
  },
];

const TIER_LEVELS: Record<TierName, number> = { seed: 1, blossom: 2, canopy: 3 };
const TIER_DISPLAY: Record<TierName, string> = { seed: 'Seed', blossom: 'Blossom', canopy: 'Canopy' };

// ============================================================================
// BOUNDARY VISUALIZATION
// ============================================================================

interface BoundaryVisualizationProps {
  selectedBoundary: string;
}

function BoundaryVisualization({ selectedBoundary }: BoundaryVisualizationProps) {
  const option = SYSTEM_BOUNDARY_OPTIONS.find((o) => o.value === selectedBoundary);
  if (!option) return null;

  const allStages = ['Raw Materials', 'Processing', 'Packaging', 'Distribution', 'Use Phase', 'End of Life'];

  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-4">
      <p className="mb-3 text-sm font-medium">Lifecycle Stages Included:</p>
      <div className="flex flex-wrap items-center gap-2">
        {allStages.map((stage, idx) => {
          const isIncluded = option.stages.includes(stage);
          return (
            <React.Fragment key={stage}>
              <div
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  isIncluded
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {stage}
              </div>
              {idx < allStages.length - 1 && (
                <ArrowRight
                  className={cn(
                    'h-4 w-4',
                    isIncluded && option.stages.includes(allStages[idx + 1])
                      ? 'text-primary'
                      : 'text-muted-foreground/30'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Map system boundary to a delivery point description for the functional unit
const BOUNDARY_DELIVERY_POINTS: Record<string, string> = {
  'cradle-to-gate': 'at factory gate',
  'cradle-to-shelf': 'delivered to retailer',
  'cradle-to-consumer': 'delivered to consumer',
  'cradle-to-grave': 'over full lifecycle including end-of-life',
};

/**
 * Compose a default functional unit string from product data.
 * e.g. "500 ml of Pale Ale at factory gate"
 */
function composeFunctionalUnit(product: any, systemBoundary: string): string {
  const parts: string[] = [];

  // Quantity: "500 ml" or "1 litre" etc.
  if (product.unit_size_value && product.unit_size_unit) {
    parts.push(`${product.unit_size_value} ${product.unit_size_unit}`);
  } else {
    parts.push('1 unit');
  }

  // Product name: "of Pale Ale"
  parts.push(`of ${product.name || 'product'}`);

  // Delivery point from system boundary
  const deliveryPoint = BOUNDARY_DELIVERY_POINTS[systemBoundary] || 'at factory gate';
  parts.push(deliveryPoint);

  return parts.join(' ');
}

// ============================================================================
// FUNCTIONAL UNIT HINT LOGIC
// ============================================================================

const UNIT_PATTERN = /\d+\s*(ml|l|litre|liter|kg|g|gram|oz|bottle|can|pack|unit|case|keg|cask)/i;

const PRODUCT_TYPE_EXAMPLES: Record<string, string> = {
  wine: '1 × 750ml bottle',
  beer: '1 × 330ml can',
  spirits: '1 × 700ml bottle',
  cider: '1 × 330ml bottle',
  'ready-to-drink': '1 × 250ml can',
  kombucha: '1 × 330ml bottle',
  'non-alcoholic': '1 × 330ml bottle',
};

function getFunctionalUnitHint(value: string, productType?: string): string | null {
  if (!value.trim()) return null;
  if (UNIT_PATTERN.test(value)) return null;
  const example = (productType && PRODUCT_TYPE_EXAMPLES[productType.toLowerCase()]) || '1 × 750ml bottle';
  return `Consider specifying a measurable quantity (e.g., '${example}')`;
}

export function BoundaryStep() {
  const { formData, updateField, preCalcState, pcfId } = useWizardContext();
  const { tierName } = useSubscription();
  const currentTierLevel = TIER_LEVELS[tierName] || 1;

  // Boundary change confirmation state
  const [pendingBoundary, setPendingBoundary] = useState<string | null>(null);
  const [showBoundaryWarning, setShowBoundaryWarning] = useState(false);

  // Track whether the functional unit was auto-generated (safe to update)
  // vs. manually edited by the user (don't overwrite).
  const isAutoGenerated = useRef(false);
  const prevBoundary = useRef(formData.systemBoundary);

  // Auto-fill functional unit from product data when the field is empty
  useEffect(() => {
    if (!preCalcState.product) return;
    if (formData.functionalUnit && !isAutoGenerated.current) return; // Don't overwrite user-entered text

    const defaultUnit = composeFunctionalUnit(preCalcState.product, formData.systemBoundary);
    updateField('functionalUnit', defaultUnit);
    isAutoGenerated.current = true;
  }, [preCalcState.product]); // Only on initial product load

  // Update the delivery point when the system boundary changes,
  // but only if the functional unit was auto-generated.
  useEffect(() => {
    if (prevBoundary.current === formData.systemBoundary) return;
    prevBoundary.current = formData.systemBoundary;

    if (!isAutoGenerated.current || !preCalcState.product) return;

    const updatedUnit = composeFunctionalUnit(preCalcState.product, formData.systemBoundary);
    updateField('functionalUnit', updatedUnit);
  }, [formData.systemBoundary]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">System Boundary</h3>
        <p className="text-sm text-muted-foreground">
          Define what is included in your assessment. The system boundary
          determines which lifecycle stages are analysed.
        </p>
      </div>

      {/* Functional Unit */}
      <div className="space-y-2">
        <Label htmlFor="functionalUnit">
          Functional Unit <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          A quantified description of the product function. This is the
          reference to which all inputs and outputs are related.
        </p>
        <Textarea
          id="functionalUnit"
          placeholder="e.g., 1 litre of packaged beer at 5% ABV delivered to retailer warehouse"
          value={formData.functionalUnit}
          onChange={(e) => {
            isAutoGenerated.current = false; // User is editing — stop auto-updating
            updateField('functionalUnit', e.target.value);
          }}
          rows={2}
          className="resize-none"
        />
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> A good functional unit includes:
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            <li>A measurable quantity (e.g., 1 litre, 330ml can, 1 kg)</li>
            <li>Product specifications (e.g., 5% ABV, sugar-free)</li>
            <li>The delivery point matching your system boundary</li>
          </ul>
        </div>

        {/* Functional unit validation hint */}
        {(() => {
          const hint = getFunctionalUnitHint(
            formData.functionalUnit,
            preCalcState.product?.product_type
          );
          if (!hint) return null;
          return (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                {hint}
              </AlertDescription>
            </Alert>
          );
        })()}
      </div>

      {/* System Boundary Selection */}
      <div className="space-y-3">
        <Label>
          System Boundary <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Select which lifecycle stages are included in your assessment.
        </p>

        <RadioGroup
          value={formData.systemBoundary}
          onValueChange={(value) => {
            // If a calculation already exists, confirm before changing
            if (pcfId && value !== formData.systemBoundary) {
              setPendingBoundary(value);
              setShowBoundaryWarning(true);
            } else {
              updateField('systemBoundary', value);
            }
          }}
          className="grid gap-3"
        >
          {SYSTEM_BOUNDARY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const requiredLevel = TIER_LEVELS[option.requiredTier];
            const isLocked = currentTierLevel < requiredLevel;
            return (
              <div key={option.value}>
                <RadioGroupItem
                  value={option.value}
                  id={`boundary-${option.value}`}
                  className="peer sr-only"
                  disabled={isLocked}
                />
                <Label
                  htmlFor={`boundary-${option.value}`}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 transition-colors',
                    isLocked
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-muted/50',
                    !isLocked && 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5'
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{option.label}</p>
                      <span className="text-xs text-muted-foreground">
                        — {option.subtitle}
                      </span>
                      {isLocked && (
                        <Badge variant="secondary" className="text-xs font-normal gap-1">
                          <Lock className="h-3 w-3" />
                          {TIER_DISPLAY[option.requiredTier]}+
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {/* Boundary change confirmation dialog */}
        <AlertDialog open={showBoundaryWarning} onOpenChange={setShowBoundaryWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change System Boundary?</AlertDialogTitle>
              <AlertDialogDescription>
                Changing to{' '}
                <strong>
                  {SYSTEM_BOUNDARY_OPTIONS.find((o) => o.value === pendingBoundary)?.label || pendingBoundary}
                </strong>{' '}
                will require re-validating steps after the Calculate step (Goal,
                Cut-off, Data Quality, Interpretation, Review, and Report).
                Your calculation data will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingBoundary(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingBoundary) {
                    updateField('systemBoundary', pendingBoundary);
                  }
                  setPendingBoundary(null);
                  setShowBoundaryWarning(false);
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Visualization */}
        <BoundaryVisualization selectedBoundary={formData.systemBoundary} />
      </div>

      {/* Reference Year */}
      <div className="space-y-2">
        <Label htmlFor="referenceYear">
          Reference Year <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          The year to which the data in this study refers.
        </p>
        <Select
          value={formData.referenceYear.toString()}
          onValueChange={(value) => updateField('referenceYear', parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(
              (year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Info note */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Cradle-to-Gate</strong> is the most common boundary for
          manufacturers. Wider boundaries (Shelf, Consumer, Grave) include
          additional lifecycle stages and may require extra configuration
          steps in this wizard.
        </AlertDescription>
      </Alert>

      {/* Boundary-specific requirement warnings — shown when a wider boundary is selected */}
      {(boundaryNeedsUsePhase(formData.systemBoundary) || boundaryNeedsEndOfLife(formData.systemBoundary)) && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <strong>Additional steps required for this boundary:</strong>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm">
              {boundaryNeedsUsePhase(formData.systemBoundary) && (
                <li>
                  <strong>Use Phase</strong> — you will need to configure refrigeration
                  and carbonation assumptions for your product. These will appear as an
                  extra step after this one. The wizard auto-detects defaults from your
                  product category, but you must confirm them before the calculation is
                  accepted. An incorrect use-phase configuration will directly affect
                  the reported carbon footprint.
                </li>
              )}
              {boundaryNeedsEndOfLife(formData.systemBoundary) && (
                <li>
                  <strong>End of Life</strong> — you will need to select the disposal
                  region (EU / UK / US) and can optionally specify recycling pathway
                  percentages per packaging material. Recycling credits can make a
                  significant difference to the total (e.g. aluminium gives a large
                  avoided-burden credit). Defaults are based on regional statistics but
                  primary data from waste contractors is preferred.
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
