'use client';

import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Pin } from 'lucide-react';
import { type OperationStep } from '@/components/ui/operation-progress';
import { PillButton } from '@/components/studio/pill-button';
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
          // When the total falls back to the product volume, its unit is the
          // product volume's unit by construction.
          facilityTotalProductionUnit: a.facilityTotalProduction
            ? (a.facilityTotalProductionUnit || a.productionVolumeUnit)
            : a.productionVolumeUnit,
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

  // The active theatrical step label, reused as the quiet progress line's text.
  const activeCalcStep = calcSteps.find((s) => s.status === 'active');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
          Calculate
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Run the lifecycle assessment.
        </h3>
        <p className="text-sm text-studio-dim">
          This creates an ISO 14067 compliant carbon footprint from your
          materials and facility data.
        </p>
      </div>

      {/* Validation in progress */}
      {preCalcState.materialDataLoading && (
        <p className="text-sm text-studio-dim">
          <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
            Validating
          </span>
          Material validation is still running. The calculate button enables once complete.
        </p>
      )}

      {/* Summary as quiet fact rows on hairlines */}
      <div className="space-y-1">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          Calculation summary
        </div>
        <dl>
          <div className="flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3 text-sm">
            <dt className="text-studio-dim">Materials</dt>
            <dd className="font-display font-semibold text-foreground">{materials.length} validated</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3 text-sm">
            <dt className="text-studio-dim">Facilities</dt>
            <dd className="font-display font-semibold text-foreground">
              {linkedFacilities.length > 0
                ? `${linkedFacilities.length} linked`
                : 'None (materials only)'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3 text-sm">
            <dt className="text-studio-dim">System boundary</dt>
            <dd className="font-display font-semibold text-foreground">{getBoundaryLabel(formData.systemBoundary)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-studio-hairline py-3 text-sm">
            <dt className="text-studio-dim">Reference year</dt>
            <dd className="font-display font-semibold text-foreground">{formData.referenceYear}</dd>
          </div>
        </dl>

        {/* Pinned-mode toggle: re-use factors from previous calculation */}
        {previousPcfId && (
          <div className="flex items-start gap-3 rounded-[6px] border border-studio-hairline bg-studio-paper p-3">
            <Switch
              checked={usePinnedFactors}
              onCheckedChange={setUsePinnedFactors}
              id="pinned-factors"
            />
            <label htmlFor="pinned-factors" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5 text-studio-dim" />
                <span className="text-sm font-medium text-foreground">Use pinned emission factors</span>
              </div>
              <p className="mt-0.5 text-xs text-studio-dim">
                Re-use the exact same emission factor values from the previous calculation
                for deterministic comparison. Useful for verifying that results are
                consistent when no data has changed.
              </p>
            </label>
          </div>
        )}
      </div>

      {!canCalculate && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-foreground">
            <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-stale">
              Blocked
            </span>
            Some materials are missing emission factors.
          </span>
          <button
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent underline underline-offset-4"
            onClick={() => goToStep(materialsStepNumber)}
          >
            Go to materials
          </button>
        </div>
      )}

      {hasFacilitiesMissingVolumes && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-foreground">
            <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-stale">
              Blocked
            </span>
            Production volumes are missing for some linked facilities.
          </span>
          <button
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent underline underline-offset-4"
            onClick={() => goToStep(facilitiesStepNumber)}
          >
            Go to facilities
          </button>
        </div>
      )}

      {/* Calculate action */}
      <div className="flex justify-center pt-2">
        <PillButton
          variant="room"
          onClick={handleCalculate}
          disabled={!canCalculate || calculating || hasFacilitiesMissingVolumes}
          className="min-w-[220px]"
        >
          {calculating ? 'Calculating' : 'Start calculation'}
        </PillButton>
      </div>

      {/* One quiet progress line (replaces the theatrical step overlay) */}
      {calculating && (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <div className="flex items-baseline justify-between gap-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            <span>{activeCalcStep?.label ?? 'Creating lifecycle assessment'}</span>
            <span className="tabular-nums text-room-accent">{Math.round(calcProgress)}%</span>
          </div>
          <div className="h-px w-full bg-studio-hairline">
            <div
              className="h-px bg-room-accent transition-all duration-300 ease-studio"
              style={{ width: `${calcProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
