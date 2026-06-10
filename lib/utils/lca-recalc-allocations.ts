/**
 * Reconstruct calculator-ready facility allocations from a PCF's stored
 * `draft_data.facilityAllocations`.
 *
 * This is a pure mirror of the mapping in
 * components/lca/EnhancedComplianceWizard/steps/CalculationStep.tsx — it MUST
 * stay in lock-step so a batch re-run reproduces the same facility/processing
 * inputs as the original wizard calculation. Kept in its own dependency-free
 * module so it can be unit-tested without pulling in the browser/org context.
 */
export function toValidAllocations(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => {
      const mode = a?.dataCollectionMode ?? 'primary';
      return mode === 'primary'
        ? a?.productionVolume && a?.facilityTotalProduction
        : a?.productionVolume && a?.archetypeId;
    })
    .map((a: any) => ({
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
}
