'use client';

import React from 'react';
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
import { Info, Box, ArrowRight, Factory, Truck, Users, Trash2 } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';

// ============================================================================
// SYSTEM BOUNDARY OPTIONS
// ============================================================================

const SYSTEM_BOUNDARY_OPTIONS = [
  {
    value: 'Cradle-to-gate',
    label: 'Cradle-to-Gate',
    description: 'Raw materials through to factory gate (most common for manufacturers)',
    icon: Factory,
    stages: ['Raw Materials', 'Processing', 'Manufacturing'],
    enabled: true,
  },
  {
    value: 'Cradle-to-shelf',
    label: 'Cradle-to-Shelf',
    description: 'Includes distribution to retail',
    icon: Truck,
    stages: ['Raw Materials', 'Processing', 'Manufacturing', 'Distribution'],
    enabled: false,
  },
  {
    value: 'Cradle-to-consumer',
    label: 'Cradle-to-Consumer',
    description: 'Includes consumer use phase',
    icon: Users,
    stages: ['Raw Materials', 'Processing', 'Manufacturing', 'Distribution', 'Use'],
    enabled: false,
  },
  {
    value: 'Cradle-to-grave',
    label: 'Cradle-to-Grave',
    description: 'Full lifecycle including end-of-life',
    icon: Trash2,
    stages: ['Raw Materials', 'Processing', 'Manufacturing', 'Distribution', 'Use', 'End of Life'],
    enabled: false,
  },
];

// ============================================================================
// BOUNDARY VISUALIZATION
// ============================================================================

interface BoundaryVisualizationProps {
  selectedBoundary: string;
}

function BoundaryVisualization({ selectedBoundary }: BoundaryVisualizationProps) {
  const option = SYSTEM_BOUNDARY_OPTIONS.find((o) => o.value === selectedBoundary);
  if (!option) return null;

  const allStages = ['Raw Materials', 'Processing', 'Manufacturing', 'Distribution', 'Use', 'End of Life'];

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

export function BoundaryStep() {
  const { formData, updateField } = useWizardContext();

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
          onChange={(e) => updateField('functionalUnit', e.target.value)}
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
          onValueChange={(value) => updateField('systemBoundary', value)}
          className="grid gap-3"
        >
          {SYSTEM_BOUNDARY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isDisabled = !option.enabled;
            return (
              <div key={option.value}>
                <RadioGroupItem
                  value={option.value}
                  id={`boundary-${option.value}`}
                  className="peer sr-only"
                  disabled={isDisabled}
                />
                <Label
                  htmlFor={`boundary-${option.value}`}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-4 transition-colors',
                    isDisabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-muted/50',
                    !isDisabled && 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5'
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{option.label}</p>
                      {isDisabled && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Coming Soon
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
          manufacturers. It covers all impacts from raw material extraction
          through to your factory gate, but excludes distribution, use, and
          disposal phases which are often outside your control.
        </AlertDescription>
      </Alert>
    </div>
  );
}
