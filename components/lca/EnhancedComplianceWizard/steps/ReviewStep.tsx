'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Shield,
  Users,
  UserCheck,
  Building,
} from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';
import type { CriticalReviewType } from '@/lib/types/lca';

// ============================================================================
// REVIEW TYPE OPTIONS
// ============================================================================

interface ReviewTypeOption {
  value: CriticalReviewType;
  label: string;
  description: string;
  icon: React.ElementType;
  requirement: string;
  audience: string[];
}

const REVIEW_TYPE_OPTIONS: ReviewTypeOption[] = [
  {
    value: 'none',
    label: 'No Critical Review',
    description: 'For internal use only, no external disclosure',
    icon: Building,
    requirement: 'No formal review required',
    audience: ['internal'],
  },
  {
    value: 'internal',
    label: 'Internal Review',
    description: 'Review by qualified internal expert',
    icon: UserCheck,
    requirement: 'Internal LCA specialist or qualified staff',
    audience: ['internal', 'customers_b2b'],
  },
  {
    value: 'external_expert',
    label: 'External Single Expert',
    description: 'Independent third-party expert review',
    icon: Shield,
    requirement: 'Qualified external LCA practitioner',
    audience: ['customers_b2b', 'customers_b2c', 'regulators', 'investors'],
  },
  {
    value: 'external_panel',
    label: 'External Panel Review',
    description: 'Review by panel of independent experts',
    icon: Users,
    requirement: 'Panel of 3+ qualified experts (required for comparative assertions)',
    audience: ['public', 'regulators', 'comparative assertions'],
  },
];

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

function getRecommendedReviewType(
  audience: string[],
  isComparative: boolean
): CriticalReviewType {
  if (isComparative) return 'external_panel';

  const externalAudiences = ['public', 'regulators', 'investors', 'customers_b2c'];
  const hasExternalAudience = audience.some((a) => externalAudiences.includes(a));

  if (hasExternalAudience) return 'external_expert';
  if (audience.includes('customers_b2b')) return 'internal';
  return 'none';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReviewStep() {
  const { formData, updateField } = useWizardContext();

  const recommendedType = getRecommendedReviewType(
    formData.intendedAudience,
    formData.isComparativeAssertion
  );

  const selectedOption = REVIEW_TYPE_OPTIONS.find(
    (opt) => opt.value === formData.criticalReviewType
  );

  const isRecommended = formData.criticalReviewType === recommendedType;
  const isBelowRecommended =
    REVIEW_TYPE_OPTIONS.findIndex(
      (opt) => opt.value === formData.criticalReviewType
    ) <
    REVIEW_TYPE_OPTIONS.findIndex((opt) => opt.value === recommendedType);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Critical Review</h3>
        <p className="text-sm text-muted-foreground">
          Determine the appropriate level of critical review for your LCA. The
          review type depends on how the results will be used and disclosed.
        </p>
      </div>

      {/* Recommendation */}
      <Alert
        variant={formData.isComparativeAssertion ? 'destructive' : 'default'}
      >
        {formData.isComparativeAssertion ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Info className="h-4 w-4" />
        )}
        <AlertTitle>Recommendation</AlertTitle>
        <AlertDescription>
          Based on your intended audience
          {formData.isComparativeAssertion && ' and comparative assertion use'}
          , we recommend:{' '}
          <strong>
            {REVIEW_TYPE_OPTIONS.find((o) => o.value === recommendedType)?.label}
          </strong>
        </AlertDescription>
      </Alert>

      {/* Review Type Selection */}
      <div className="space-y-3">
        <Label>
          Critical Review Type <span className="text-destructive">*</span>
        </Label>

        <RadioGroup
          value={formData.criticalReviewType}
          onValueChange={(value) =>
            updateField('criticalReviewType', value as CriticalReviewType)
          }
          className="grid gap-3"
        >
          {REVIEW_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isThisRecommended = option.value === recommendedType;

            return (
              <div key={option.value}>
                <RadioGroupItem
                  value={option.value}
                  id={`review-${option.value}`}
                  className="peer sr-only"
                  disabled={
                    formData.isComparativeAssertion &&
                    option.value !== 'external_panel'
                  }
                />
                <Label
                  htmlFor={`review-${option.value}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                    'hover:bg-muted/50',
                    'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5',
                    'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
                    isThisRecommended && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{option.label}</p>
                      {isThisRecommended && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Requirement:</strong> {option.requirement}
                    </p>
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* Warning if below recommendation */}
      {isBelowRecommended && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Review Level Warning</AlertTitle>
          <AlertDescription>
            The selected review level is less rigorous than recommended for your
            intended audience. This may limit how you can use or disclose the
            results. Consider upgrading to{' '}
            <strong>
              {REVIEW_TYPE_OPTIONS.find((o) => o.value === recommendedType)?.label}
            </strong>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Justification */}
      <div className="space-y-2">
        <Label htmlFor="reviewJustification">
          Justification{' '}
          {formData.criticalReviewType !== recommendedType && (
            <span className="text-destructive">*</span>
          )}
        </Label>
        <p className="text-xs text-muted-foreground">
          {formData.criticalReviewType !== recommendedType
            ? 'Please explain why you are selecting a different review level than recommended.'
            : 'Optionally provide additional context for your review choice.'}
        </p>
        <Textarea
          id="reviewJustification"
          placeholder="e.g., Results will only be used internally for product development. No public disclosure planned."
          value={formData.criticalReviewJustification}
          onChange={(e) =>
            updateField('criticalReviewJustification', e.target.value)
          }
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Review status indicator */}
      {selectedOption && (
        <Card className="bg-muted/30">
          <CardContent className="flex items-center gap-3 p-4">
            {isRecommended ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <p className="font-medium">
                {selectedOption.label} Selected
              </p>
              <p className="text-sm text-muted-foreground">
                {isRecommended
                  ? 'This matches the recommended review level for your use case.'
                  : 'This differs from the recommended review level. Ensure this is appropriate for your disclosure plans.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ISO Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>ISO 14044 Section 6:</strong> Critical review ensures that
          methods are consistent with the standard, data is appropriate, and
          conclusions are supported by the findings. Comparative assertions
          disclosed to the public require panel review.
        </AlertDescription>
      </Alert>
    </div>
  );
}
