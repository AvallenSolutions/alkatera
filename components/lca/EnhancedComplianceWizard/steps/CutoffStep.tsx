'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, AlertTriangle, Lightbulb, Sparkles, RotateCcw } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import {
  generateAssumptions,
  type AssumptionContext,
} from '@/lib/lca-assumptions-generator';

// ============================================================================
// COMMON EXCLUSIONS
// ============================================================================

const COMMON_EXCLUSIONS = [
  {
    category: 'Capital Goods',
    items: [
      'Manufacturing equipment and machinery',
      'Buildings and infrastructure',
      'Vehicles and transport equipment',
    ],
  },
  {
    category: 'Employee Activities',
    items: [
      'Employee commuting',
      'Business travel',
      'Office supplies and consumables',
    ],
  },
  {
    category: 'Minor Inputs',
    items: [
      'Cleaning agents and lubricants',
      'Laboratory chemicals',
      'Maintenance materials',
    ],
  },
  {
    category: 'Packaging Components',
    items: [
      'Labels and printing inks',
      'Glues and adhesives',
      'Stretch wrap and tertiary packaging',
    ],
  },
];

// ============================================================================
// ASSUMPTION INPUT
// ============================================================================

interface AssumptionInputProps {
  assumptions: string[];
  onUpdate: (assumptions: string[]) => void;
}

function AssumptionInput({ assumptions, onUpdate }: AssumptionInputProps) {
  const [newAssumption, setNewAssumption] = useState('');

  const addAssumption = () => {
    if (newAssumption.trim()) {
      onUpdate([...assumptions, newAssumption.trim()]);
      setNewAssumption('');
    }
  };

  const removeAssumption = (index: number) => {
    onUpdate(assumptions.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAssumption();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newAssumption}
          onChange={(e) => setNewAssumption(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Average transport distances assumed for suppliers"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addAssumption}
          disabled={!newAssumption.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {assumptions.length > 0 && (
        <div className="space-y-2">
          {assumptions.map((assumption, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 p-2"
            >
              <span className="text-sm">{assumption}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => removeAssumption(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CutoffStep() {
  const { formData, updateField, preCalcState } = useWizardContext();
  const [selectedExclusions, setSelectedExclusions] = useState<Set<string>>(
    new Set()
  );
  const hasSeeded = useRef(false);

  // Build context for the assumption generator from wizard state
  const assumptionContext = useMemo((): AssumptionContext => {
    const materials = preCalcState.materials || [];
    const hasPackaging = materials.some((m) => {
      const mt = (m.material_type || '').toLowerCase();
      return mt === 'packaging' || mt === 'packaging_material';
    });
    const hasIngredients = materials.some((m) => {
      const mt = (m.material_type || '').toLowerCase();
      return mt !== 'packaging' && mt !== 'packaging_material';
    });

    return {
      productType: preCalcState.product?.product_type || undefined,
      systemBoundary: formData.systemBoundary || 'cradle-to-gate',
      materialCount: materials.length,
      hasFacilities: preCalcState.linkedFacilities.length > 0,
      facilityCount: preCalcState.linkedFacilities.length,
      usePhaseConfig: formData.usePhaseConfig,
      eolConfig: formData.eolConfig,
      referenceYear: formData.referenceYear || new Date().getFullYear(),
      hasPackaging,
      hasIngredients,
    };
  }, [
    preCalcState.materials,
    preCalcState.product,
    preCalcState.linkedFacilities,
    formData.systemBoundary,
    formData.usePhaseConfig,
    formData.eolConfig,
    formData.referenceYear,
  ]);

  // Auto-seed assumptions on first mount if the list is empty
  useEffect(() => {
    if (hasSeeded.current) return;
    if (formData.assumptions.length > 0) {
      hasSeeded.current = true;
      return;
    }

    const generated = generateAssumptions(assumptionContext);
    if (generated.length > 0) {
      updateField('assumptions', generated);
      hasSeeded.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assumptionContext]);

  const handleRegenerateAssumptions = () => {
    const generated = generateAssumptions(assumptionContext);
    updateField('assumptions', generated);
  };

  const handleExclusionToggle = (item: string, checked: boolean) => {
    const updated = new Set(selectedExclusions);
    if (checked) {
      updated.add(item);
    } else {
      updated.delete(item);
    }
    setSelectedExclusions(updated);

    // Update cutoff criteria text
    const exclusionsList = Array.from(updated).join('; ');
    if (exclusionsList) {
      const baseText = formData.cutoffCriteria.split('\n\nExcluded:')[0];
      updateField(
        'cutoffCriteria',
        `${baseText}\n\nExcluded: ${exclusionsList}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Cut-off Criteria</h3>
        <p className="text-sm text-muted-foreground">
          Specify what is excluded from your assessment and justify why. Cut-off
          criteria define the threshold below which inputs are considered
          negligible.
        </p>
      </div>

      {/* Cut-off Criteria Description */}
      <div className="space-y-2">
        <Label htmlFor="cutoffCriteria">
          Cut-off Criteria <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Describe the rules used to determine which inputs and outputs are
          excluded from the assessment.
        </p>
        <Textarea
          id="cutoffCriteria"
          placeholder="e.g., Materials contributing less than 1% of total mass are excluded. Energy inputs contributing less than 1% of total energy consumption are excluded."
          value={formData.cutoffCriteria}
          onChange={(e) => updateField('cutoffCriteria', e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Quick-select common exclusions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <Label className="font-medium">Common Exclusions</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select common items that are typically excluded from screening LCAs.
          These will be added to your cut-off criteria.
        </p>

        <div className="space-y-4">
          {COMMON_EXCLUSIONS.map((category) => (
            <div key={category.category} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {category.category}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {category.items.map((item) => (
                  <div key={item} className="flex items-center space-x-2">
                    <Checkbox
                      id={`exclusion-${item}`}
                      checked={selectedExclusions.has(item)}
                      onCheckedChange={(checked) =>
                        handleExclusionToggle(item, checked === true)
                      }
                    />
                    <Label
                      htmlFor={`exclusion-${item}`}
                      className="text-sm font-normal"
                    >
                      {item}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedExclusions.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-sm text-muted-foreground">Selected:</span>
            {Array.from(selectedExclusions).map((item) => (
              <Badge key={item} variant="outline" className="font-normal">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Assumptions & Limitations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Assumptions & Limitations <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerateAssumptions}
            className="h-7 text-xs gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Regenerate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          These assumptions are automatically generated based on your product
          configuration, system boundary, and the calculation methodology used.
          You can edit, remove, or add additional items as needed.
        </p>
        {formData.assumptions.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>
              {formData.assumptions.length} assumptions auto-filled from your
              calculation settings
            </span>
          </div>
        )}
        <AssumptionInput
          assumptions={formData.assumptions}
          onUpdate={(assumptions) => updateField('assumptions', assumptions)}
        />
      </div>

      {/* Warning about cut-offs */}
      {selectedExclusions.size > 5 && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have selected many exclusions. Ensure that the total excluded
            mass and impact remains below your stated cut-off threshold
            (typically 1-5%). Document justification for each exclusion.
          </AlertDescription>
        </Alert>
      )}

      {/* ISO reminder */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>ISO 14044 Requirement:</strong> The cumulative impact of
          excluded items should not exceed the cut-off threshold. All exclusions
          must be documented and justified.
        </AlertDescription>
      </Alert>
    </div>
  );
}
