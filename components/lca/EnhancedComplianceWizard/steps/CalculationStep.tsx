'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  Loader2,
  Calculator,
  Info,
  Pin,
} from 'lucide-react';
import {
  OperationOverlay,
  type OperationStep,
} from '@/components/ui/operation-progress';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { getBoundaryLabel } from '@/lib/system-boundaries';
import { toast } from 'sonner';
import { useWizardContext, getStepIdsForBoundary } from '../WizardContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CalculationStep() {
  const {
    productId,
    pcfId,
    preCalcState,
    setPreCalcState,
    onCalculationComplete,
    formData,
    goToStep,
    showGuide,
  } = useWizardContext();

  // Pinned-mode state: re-use emission factors from a previous calculation
  const [usePinnedFactors, setUsePinnedFactors] = useState(false);
  const [previousPcfId, setPreviousPcfId] = useState<string | null>(null);

  // Check for a previous completed PCF for this product
  useEffect(() => {
    if (!productId) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('product_carbon_footprints')
      .select('id')
      .eq('product_id', productId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setPreviousPcfId(data.id);
      });
  }, [productId]);

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
        .filter((a) => {
          // Primary data requires both the client volume and facility total
          // for physical allocation. Proxy/hybrid modes only need the client
          // volume — the archetype supplies per-unit intensity directly.
          const mode = a.dataCollectionMode ?? 'primary';
          if (mode === 'primary') {
            return a.productionVolume && a.facilityTotalProduction;
          }
          return a.productionVolume && a.archetypeId;
        })
        .map((a) => ({
          facilityId: a.facilityId,
          facilityName: a.facilityName,
          operationalControl: a.operationalControl,
          reportingPeriodStart: a.reportingPeriodStart,
          reportingPeriodEnd: a.reportingPeriodEnd,
          productionVolume: parseFloat(a.productionVolume),
          productionVolumeUnit: a.productionVolumeUnit,
          facilityTotalProduction: parseFloat(a.facilityTotalProduction || a.productionVolume),
          dataCollectionMode: a.dataCollectionMode ?? 'primary',
          archetypeId: a.archetypeId ?? null,
          proxyJustification: a.proxyJustification,
          hybridOverrides: a.hybridOverrides,
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
        referenceYear: formData.referenceYear,
        facilityAllocations:
          validAllocations.length > 0 ? validAllocations : undefined,
        usePhaseConfig: formData.usePhaseConfig,
        eolConfig: formData.eolConfig,
        distributionConfig: formData.distributionConfig,
        productLossConfig: formData.productLossConfig,
        pinnedPcfId: usePinnedFactors && previousPcfId ? previousPcfId : undefined,
        draftPcfId: pcfId ?? undefined,
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

      {/* Validation in progress */}
      {preCalcState.materialDataLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800 p-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-400">
            Material validation is still running in the background. The calculate button will enable once complete.
          </p>
        </div>
      )}

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
            <p className="font-medium">{formData.referenceYear}</p>
          </div>
        </div>

        {/* Pinned-mode toggle: re-use factors from previous calculation */}
        {previousPcfId && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Switch
              checked={usePinnedFactors}
              onCheckedChange={setUsePinnedFactors}
              id="pinned-factors"
            />
            <label htmlFor="pinned-factors" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Use pinned emission factors</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Re-use the exact same emission factor values from the previous calculation
                for deterministic comparison. Useful for verifying that results are
                consistent when no data has changed.
              </p>
            </label>
          </div>
        )}
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
