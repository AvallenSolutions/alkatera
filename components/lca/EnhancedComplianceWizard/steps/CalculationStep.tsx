'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Loader2,
  Calculator,
  Info,
} from 'lucide-react';
import {
  OperationOverlay,
  type OperationStep,
} from '@/components/ui/operation-progress';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { getBoundaryLabel } from '@/lib/system-boundaries';
import { toast } from 'sonner';
import { useWizardContext, getStepIdsForBoundary } from '../WizardContext';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CalculationStep() {
  const {
    productId,
    preCalcState,
    setPreCalcState,
    onCalculationComplete,
    formData,
    goToStep,
    showGuide,
  } = useWizardContext();

  // Compute step numbers for navigation links
  const stepIds = getStepIdsForBoundary(formData.systemBoundary || 'cradle-to-gate', showGuide);
  const materialsStepNumber = stepIds.indexOf('materials') + 1;
  const facilitiesStepNumber = stepIds.indexOf('facilities') + 1;

  const {
    materials,
    canCalculate,
    linkedFacilities,
    facilityAllocations,
    calculating,
    calcSteps,
    calcProgress,
    product,
  } = preCalcState;

  const hasFacilitiesMissingVolumes =
    linkedFacilities.length > 0 &&
    facilityAllocations.some(
      (a) => !a.productionVolume || !a.facilityTotalProduction
    );

  const handleCalculate = async () => {
    if (!canCalculate) {
      toast.error(
        'Cannot calculate: some materials are missing emission data'
      );
      return;
    }

    if (hasFacilitiesMissingVolumes) {
      toast.error(
        'Please enter production volumes for all linked facilities'
      );
      return;
    }

    setPreCalcState((prev) => ({
      ...prev,
      calculating: true,
      calcSteps: [
        { label: 'Loading product data', status: 'active' },
        {
          label: `Resolving impact factors for ${materials.length} materials`,
          status: 'pending',
        },
        { label: 'Processing facility allocations', status: 'pending' },
        { label: 'Aggregating lifecycle impacts', status: 'pending' },
        { label: 'Generating interpretation report', status: 'pending' },
      ],
      calcProgress: 0,
    }));

    try {
      const validAllocations = facilityAllocations
        .filter((a) => a.productionVolume && a.facilityTotalProduction)
        .map((a) => ({
          facilityId: a.facilityId,
          facilityName: a.facilityName,
          operationalControl: a.operationalControl,
          reportingPeriodStart: a.reportingPeriodStart,
          reportingPeriodEnd: a.reportingPeriodEnd,
          productionVolume: parseFloat(a.productionVolume),
          productionVolumeUnit: a.productionVolumeUnit,
          facilityTotalProduction: parseFloat(a.facilityTotalProduction),
        }));

      // Map boundary value to calculator format (lowercase with hyphens)
      const boundaryValue = (formData.systemBoundary || 'cradle-to-gate') as
        | 'cradle-to-gate'
        | 'cradle-to-shelf'
        | 'cradle-to-consumer'
        | 'cradle-to-grave';

      const result = await calculateProductLCA({
        productId,
        functionalUnit: `1 ${product?.unit || 'unit'} of ${product?.name || 'product'}`,
        systemBoundary: boundaryValue,
        referenceYear: new Date().getFullYear(),
        facilityAllocations:
          validAllocations.length > 0 ? validAllocations : undefined,
        usePhaseConfig: formData.usePhaseConfig,
        eolConfig: formData.eolConfig,
        distributionConfig: formData.distributionConfig,
        onProgress: (step: string, percent: number) => {
          setPreCalcState((prev) => ({
            ...prev,
            calcProgress: percent,
            calcSteps: prev.calcSteps.map(
              (s: OperationStep, i: number) => {
                if (percent >= 90)
                  return {
                    ...s,
                    status:
                      i <= 4
                        ? i < 4
                          ? 'completed'
                          : 'active'
                        : 'pending',
                  };
                if (percent >= 75)
                  return {
                    ...s,
                    status:
                      i <= 3
                        ? i < 3
                          ? 'completed'
                          : 'active'
                        : 'pending',
                  };
                if (percent >= 50)
                  return {
                    ...s,
                    status:
                      i <= 2
                        ? i < 2
                          ? 'completed'
                          : 'active'
                        : 'pending',
                  };
                if (percent >= 20)
                  return {
                    ...s,
                    status:
                      i <= 1
                        ? i < 1
                          ? 'completed'
                          : 'active'
                        : 'pending',
                  };
                return { ...s, status: i === 0 ? 'active' : 'pending' };
              }
            ),
          }));
        },
      });

      if (!result.success)
        throw new Error(result.error || 'Calculation failed');

      setPreCalcState((prev) => ({
        ...prev,
        calcSteps: prev.calcSteps.map((s) => ({
          ...s,
          status: 'completed' as const,
        })),
        calcProgress: 100,
      }));

      toast.success('Carbon footprint calculated!');

      // Brief pause to show 100% before advancing
      await new Promise((resolve) => setTimeout(resolve, 500));

      setPreCalcState((prev) => ({ ...prev, calculating: false }));
      onCalculationComplete(result.pcfId!);
    } catch (error: any) {
      console.error('Calculation error:', error);
      toast.error(error.message || 'Failed to calculate impact');
      setPreCalcState((prev) => ({ ...prev, calculating: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Calculate LCA</h3>
        <p className="text-sm text-muted-foreground">
          Run the lifecycle assessment calculation. This will create an ISO
          14067 compliant carbon footprint analysis based on your materials
          and facility data.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-medium">Calculation Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Materials</p>
            <p className="font-medium">{materials.length} validated</p>
          </div>
          <div>
            <p className="text-muted-foreground">Facilities</p>
            <p className="font-medium">
              {linkedFacilities.length > 0
                ? `${linkedFacilities.length} linked`
                : 'None (materials only)'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">System Boundary</p>
            <p className="font-medium">{getBoundaryLabel(formData.systemBoundary)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reference Year</p>
            <p className="font-medium">{new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      {!canCalculate && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Some materials are missing emission factors.
            </span>
            <Button
              variant="link"
              className="h-auto p-0 text-destructive-foreground underline"
              onClick={() => goToStep(materialsStepNumber)}
            >
              Go to Materials step →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {hasFacilitiesMissingVolumes && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Production volumes are missing for some linked facilities.
            </span>
            <Button
              variant="link"
              className="h-auto p-0 text-destructive-foreground underline"
              onClick={() => goToStep(facilitiesStepNumber)}
            >
              Go to Facilities step →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Calculate button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleCalculate}
          disabled={
            !canCalculate || calculating || hasFacilitiesMissingVolumes
          }
          size="lg"
          className="min-w-[220px] bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold"
        >
          {calculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Start Calculation
            </>
          )}
        </Button>
      </div>

      {/* Calculation progress overlay */}
      <OperationOverlay
        open={calculating}
        title="Creating Lifecycle Assessment"
        steps={calcSteps}
        progress={calcProgress}
        message="ISO 14067 compliant lifecycle assessment · usually takes 5–10 seconds"
      />
    </div>
  );
}
