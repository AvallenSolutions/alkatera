'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Users } from 'lucide-react';
import { useWizardContext } from '../WizardContext';

// ============================================================================
// AUDIENCE OPTIONS
// ============================================================================

const AUDIENCE_OPTIONS = [
  { value: 'internal', label: 'Internal teams (R&D, sustainability)' },
  { value: 'customers_b2b', label: 'Business customers (B2B)' },
  { value: 'customers_b2c', label: 'Consumers (B2C)' },
  { value: 'regulators', label: 'Regulators / Government bodies' },
  { value: 'investors', label: 'Investors / ESG analysts' },
  { value: 'auditors', label: 'Third-party auditors / verifiers' },
  { value: 'public', label: 'General public' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GoalStep() {
  const { formData, updateField } = useWizardContext();

  const handleAudienceChange = (value: string, checked: boolean) => {
    const current = formData.intendedAudience || [];
    const updated = checked
      ? [...current, value]
      : current.filter((v) => v !== value);
    updateField('intendedAudience', updated);
  };

  const isExternalAudience = formData.intendedAudience?.some((a) =>
    ['customers_b2b', 'customers_b2c', 'regulators', 'investors', 'public'].includes(a)
  );

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Goal & Purpose</h3>
        <p className="text-sm text-muted-foreground">
          Define why this Life Cycle Assessment is being conducted. This helps
          ensure the study is designed appropriately.
        </p>
      </div>

      {/* Intended Application */}
      <div className="space-y-2">
        <Label htmlFor="intendedApplication">
          Intended Application <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          How will the results of this LCA be used?
        </p>
        <Textarea
          id="intendedApplication"
          placeholder="e.g., Identify environmental hotspots for product improvement, support sustainability marketing claims, meet regulatory requirements..."
          value={formData.intendedApplication}
          onChange={(e) => updateField('intendedApplication', e.target.value)}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {formData.intendedApplication.length}/500 characters
        </p>
      </div>

      {/* Reasons for Study */}
      <div className="space-y-2">
        <Label htmlFor="reasonsForStudy">
          Reasons for the Study <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Why is this LCA being conducted now?
        </p>
        <Textarea
          id="reasonsForStudy"
          placeholder="e.g., New product launch, customer request for environmental data, regulatory compliance deadline, corporate sustainability targets..."
          value={formData.reasonsForStudy}
          onChange={(e) => updateField('reasonsForStudy', e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Intended Audience */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Label>
            Intended Audience <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Who will use the results? Select all that apply.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AUDIENCE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`audience-${option.value}`}
                checked={formData.intendedAudience?.includes(option.value)}
                onCheckedChange={(checked) =>
                  handleAudienceChange(option.value, checked === true)
                }
              />
              <Label
                htmlFor={`audience-${option.value}`}
                className="text-sm font-normal"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
        {formData.intendedAudience.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {formData.intendedAudience.map((audience) => {
              const option = AUDIENCE_OPTIONS.find((o) => o.value === audience);
              return (
                <Badge key={audience} variant="secondary">
                  {option?.label || audience}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparative Assertion Warning */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="comparativeAssertion"
            checked={formData.isComparativeAssertion}
            onCheckedChange={(checked) =>
              updateField('isComparativeAssertion', checked === true)
            }
          />
          <Label htmlFor="comparativeAssertion" className="font-medium">
            This LCA will be used for comparative assertions
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          A comparative assertion is a public environmental claim that your
          product is better than a competitor&apos;s. This requires additional
          review.
        </p>

        {formData.isComparativeAssertion && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> ISO 14044 requires that LCAs used for
              comparative assertions publicly disclosed must undergo a panel
              critical review by independent experts. This will be addressed in
              the Critical Review step.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* External audience warning */}
      {isExternalAudience && !formData.isComparativeAssertion && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Since this LCA will be shared externally, consider whether you may
            need independent critical review to support your claims.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
