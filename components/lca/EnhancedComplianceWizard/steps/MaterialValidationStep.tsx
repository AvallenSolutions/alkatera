'use client';

import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
  TrendingUp,
  Database,
  FlaskConical,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { validateMaterialsBeforeCalculation } from '@/lib/impact-waterfall-resolver';
import { toast } from 'sonner';
import { InlineIngredientSearch } from '@/components/lca/InlineIngredientSearch';
import { MatchStatusBadge } from '@/components/products/MatchStatusBadge';
import { ProvenanceChip } from '@/components/studio/provenance-chip';
import { Eyebrow } from '@/components/studio/eyebrow';
import { provenanceFromEfSourceType } from '@/lib/provenance';
import { autoMatchEmissionFactor } from '@/lib/products/ef-auto-match';
import { autoApplyConservativeProxy } from '@/lib/factors/auto-proxy';
import type { DataSource } from '@/lib/types/lca';
import type { MaterialWithValidation } from '../types';
import { materialHasAssignedFactor } from '../types';
import { useWizardContext } from '../WizardContext';
import { cn } from '@/lib/utils';

// ============================================================================
// HELPERS
// ============================================================================

function getQualityBadgeProps(tag: string) {
  switch (tag) {
    case 'Primary_Verified':
      return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700', icon: Shield };
    case 'Regional_Standard':
      return { variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700', icon: TrendingUp };
    case 'Secondary_Modelled':
      return { variant: 'secondary' as const, className: '', icon: Database };
    default:
      return { variant: 'secondary' as const, className: '', icon: Info };
  }
}

/** How many search+write operations run at once during the silent auto-resolve pass. */
const AUTO_RESOLVE_CONCURRENCY = 3;

/** Shared "demoted picker" link styling, matching IngredientFormCard/PackagingFormCard. */
const CHOOSE_YOURSELF_LINK_CLASS =
  'shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-dim underline-offset-2 hover:text-foreground hover:underline';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MaterialValidationStep() {
  const { preCalcState, setPreCalcState, productId } = useWizardContext();

  const {
    materials,
    canCalculate,
    missingCount,
    editingMaterialId,
    savingMaterialId,
    product,
    materialDataLoading,
  } = preCalcState;

  const setEditingMaterialId = (id: string | null) => {
    setPreCalcState((prev) => ({ ...prev, editingMaterialId: id }));
  };

  // ── Silent auto-resolution (data-revolution Pillar 2) ──────────────────
  // Factor selection is not a user task any more: any material the resolver
  // couldn't assign a factor to gets a confident auto-match first, else a
  // conservative proxy, applied automatically as soon as materials finish
  // loading. Runs once per wizard mount.
  const autoResolveRanRef = useRef(false);
  const [autoResolveProgress, setAutoResolveProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingResolveIds, setPendingResolveIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (materialDataLoading) return;
    if (autoResolveRanRef.current) return;
    const targets = materials.filter((m) => m.validationStatus === 'missing');
    if (targets.length === 0) return;
    const organizationId = product?.organization_id;
    if (!organizationId) return;

    autoResolveRanRef.current = true;
    void resolveUnmatchedMaterials(targets, organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialDataLoading]);

  async function resolveUnmatchedMaterials(
    targets: MaterialWithValidation[],
    organizationId: string
  ) {
    setPendingResolveIds(new Set(targets.map((m) => m.id)));
    setAutoResolveProgress({ current: 0, total: targets.length });

    let completed = 0;
    let matchedCount = 0;
    let proxyCount = 0;
    let failedCount = 0;
    let cursor = 0;

    const markDone = (materialId: string) => {
      completed += 1;
      setAutoResolveProgress({ current: completed, total: targets.length });
      setPendingResolveIds((prev) => {
        if (!prev.has(materialId)) return prev;
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    };

    async function worker() {
      while (cursor < targets.length) {
        const material = targets[cursor];
        cursor += 1;

        const query = material.material_name?.trim();
        if (!query) {
          failedCount += 1;
          markDone(material.id);
          continue;
        }

        const materialType: 'ingredient' | 'packaging' =
          material.material_type === 'packaging' ? 'packaging' : 'ingredient';

        try {
          const confident = await autoMatchEmissionFactor({
            query,
            organizationId,
            materialType,
            packagingCategory: material.packaging_category,
          });

          if (confident) {
            await handleEmissionFactorSelect(
              material.id,
              {
                name: confident.matched_source_name,
                data_source: confident.data_source,
                data_source_id: confident.data_source_id,
                supplier_product_id: confident.supplier_product_id,
                unit: material.unit,
                carbon_intensity: confident.carbon_intensity,
                openlca_database: confident.openlca_database,
                ef_source: confident.ef_source,
                ef_source_type: confident.ef_source_type,
                ef_data_quality_grade: confident.ef_data_quality_grade,
                ef_uncertainty_percent: confident.ef_uncertainty_percent,
                auto_matched: true,
              },
              { silent: true }
            );
            matchedCount += 1;
          } else {
            const proxy = await autoApplyConservativeProxy({
              query,
              organizationId,
              materialType,
              packagingCategory: material.packaging_category,
            });
            await handleEmissionFactorSelect(
              material.id,
              {
                name: proxy.matched_source_name,
                data_source: proxy.data_source,
                data_source_id: proxy.data_source_id,
                supplier_product_id: proxy.supplier_product_id,
                unit: material.unit,
                carbon_intensity: proxy.carbon_intensity,
                openlca_database: proxy.openlca_database,
                ef_source: proxy.ef_source,
                ef_source_type: proxy.ef_source_type,
                ef_data_quality_grade: proxy.ef_data_quality_grade,
                ef_uncertainty_percent: proxy.ef_uncertainty_percent,
                auto_matched: true,
              },
              { silent: true }
            );
            proxyCount += 1;
          }
        } catch (error) {
          // Never block the step: a material that fails even the proxy
          // write (e.g. a transient network error) simply stays visibly
          // unresolved, reviewable via "Choose a factor" below.
          console.warn('[MaterialValidationStep] Auto-resolve failed for', material.material_name, error);
          failedCount += 1;
        } finally {
          markDone(material.id);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(AUTO_RESOLVE_CONCURRENCY, targets.length) }, () => worker())
    );

    setAutoResolveProgress(null);

    const summaryParts: string[] = [];
    if (matchedCount > 0) summaryParts.push(`${matchedCount} matched`);
    if (proxyCount > 0) summaryParts.push(`${proxyCount} estimated`);
    if (summaryParts.length > 0) {
      toast.success(`We matched your materials. ${summaryParts.join(', ')}.`);
    }
    if (failedCount > 0) {
      toast.error(
        `${failedCount} material${failedCount !== 1 ? 's' : ''} could not be matched automatically. Choose a factor for ${failedCount !== 1 ? 'them' : 'it'} below.`
      );
    }
  }

  /**
   * Confirm an auto-matched (or proxy) row as reviewed, without changing
   * which factor is used. Mirrors the "Looks right" affordance already
   * shipped in IngredientFormCard/PackagingFormCard (MatchStatusBadge).
   */
  async function handleConfirmMatch(materialId: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('product_materials')
      .update({ match_status: 'verified' })
      .eq('id', materialId);

    if (error) {
      console.error('[MaterialValidationStep] Confirm match failed:', error);
      toast.error('Could not confirm this match. Please try again.');
      return;
    }

    setPreCalcState((prev) => ({
      ...prev,
      materials: prev.materials.map((m) =>
        m.id === materialId ? { ...m, match_status: 'verified' } : m
      ),
    }));
  }

  async function handleEmissionFactorSelect(
    materialId: string,
    selection: {
      name: string;
      data_source: DataSource;
      data_source_id?: string;
      supplier_product_id?: string;
      unit: string;
      carbon_intensity?: number;
      openlca_database?: string;
      ef_source?: string;
      ef_source_type?: string;
      ef_data_quality_grade?: string;
      ef_uncertainty_percent?: number;
      /** True when software picked this (auto-match/proxy/AI proxy suggestion) rather than the user. */
      auto_matched?: boolean;
    },
    options?: { silent?: boolean }
  ) {
    const supabase = getSupabaseBrowserClient();
    setPreCalcState((prev) => ({ ...prev, savingMaterialId: materialId }));

    try {
      const material = materials.find((m) => m.id === materialId);
      const updateData: Record<string, any> = {
        data_source: selection.data_source,
        data_source_id: selection.data_source_id || null,
        supplier_product_id: null,
        matched_source_name:
          material && selection.name !== material.material_name
            ? selection.name
            : null,
        // Persist which OpenLCA database this factor comes from (ecoinvent/agribalyse)
        // so the resolver routes to the correct server on calculation
        openlca_database: selection.openlca_database || null,
        // Cache the CO2 factor as a last-resort fallback in case OpenLCA is unreachable
        cached_co2_factor: selection.carbon_intensity || null,
        // Provenance columns — same shape IngredientFormCard/PackagingFormCard
        // write (lib/products/ingredient-material-data.ts) so a proxy applied
        // here shows up in /admin-tools/factor-queue identically to one
        // applied from the recipe tab or by Rosa.
        ef_source: selection.ef_source || null,
        ef_source_type: selection.ef_source_type || null,
        ef_data_quality_grade: selection.ef_data_quality_grade || null,
        ef_uncertainty_percent: selection.ef_uncertainty_percent ?? null,
        match_status: selection.auto_matched ? 'auto_matched' : 'verified',
      };
      if (
        selection.data_source === 'supplier' &&
        selection.supplier_product_id
      ) {
        updateData.supplier_product_id = selection.supplier_product_id;
      }

      const { error: updateError } = await supabase
        .from('product_materials')
        .update(updateData)
        .eq('id', materialId);

      if (updateError) throw updateError;

      const { data: updatedRow, error: fetchError } = await supabase
        .from('product_materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (fetchError || !updatedRow)
        throw fetchError || new Error('Material not found');

      const validation = await validateMaterialsBeforeCalculation(
        [updatedRow],
        product.organization_id
      );

      setPreCalcState((prev) => {
        const updated = prev.materials.map((m) => {
          if (m.id !== materialId) return m;
          const valid = validation.validMaterials[0];
          if (valid) {
            const r = valid.resolved;
            // Determine human-readable source label from waterfall result
            const sourceLabel =
              r.data_priority === 1 ? 'Supplier verified'
              : r.is_hybrid_source ? `DEFRA + ${r.non_gwp_data_source || 'ecoinvent'}`
              : r.gwp_data_source || r.source_reference || 'Database';
            return {
              ...updatedRow,
              hasData: true,
              validationStatus: 'resolved' as const,
              dataQuality: r.data_quality_tag,
              confidenceScore: r.confidence_score,
              resolvedFactorName: updatedRow.matched_source_name || updatedRow.material_name,
              resolvedFactorSource: sourceLabel,
              resolvedPriority: r.data_priority,
              error: undefined,
            } as MaterialWithValidation;
          }

          // DB-column guard: we just saved the factor to DB, so if the
          // resolver failed transiently, check the DB columns before
          // marking as missing. The user DID pick a factor — don't lose it.
          if (materialHasAssignedFactor(updatedRow)) {
            return {
              ...updatedRow,
              hasData: true,
              validationStatus: 'assigned' as const,
              resolvedFactorName: updatedRow.matched_source_name || updatedRow.material_name,
              error: validation.missingData[0]?.error,
            } as MaterialWithValidation;
          }

          const missing = validation.missingData[0];
          return {
            ...updatedRow,
            hasData: false,
            validationStatus: 'missing' as const,
            error: missing?.error || 'Validation failed',
          } as MaterialWithValidation;
        });

        // Use validationStatus to determine truly missing count
        const newMissing = updated.filter((m) => m.validationStatus === 'missing').length;
        return {
          ...prev,
          materials: updated,
          missingCount: newMissing,
          canCalculate: newMissing === 0,
          editingMaterialId: null,
          savingMaterialId: null,
        };
      });

      if (!options?.silent) {
        toast.success(`Emission factor assigned for ${updatedRow.material_name}`);
      }
    } catch (error: any) {
      console.error('Error updating emission factor:', error);
      if (!options?.silent) {
        toast.error(error.message || 'Failed to update emission factor');
      }
      setPreCalcState((prev) => ({ ...prev, savingMaterialId: null }));
      if (options?.silent) throw error;
    }
  }

  if (materialDataLoading && materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Loading materials...
        </p>
      </div>
    );
  }

  const validatingCount = materials.filter(m => m.validationStatus === 'validating').length;
  const isAutoResolving = autoResolveProgress !== null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Your materials</h3>
        <p className="text-sm text-muted-foreground">
          {materialDataLoading || isAutoResolving
            ? 'We are matching your materials to emission data now.'
            : missingCount === 0
              ? 'We have matched everything. Check anything that looks wrong.'
              : `${missingCount} material${missingCount !== 1 ? 's' : ''} still ${missingCount !== 1 ? 'need' : 'needs'} a factor. Choose one for ${missingCount !== 1 ? 'them' : 'it'} below.`}
        </p>
      </div>

      {/* Quiet mono progress readout for the silent auto-resolve pass */}
      {isAutoResolving && (
        <Eyebrow tone="dim">
          Matching your materials. {autoResolveProgress!.current} of {autoResolveProgress!.total}.
        </Eyebrow>
      )}

      {/* Validating banner */}
      {materialDataLoading && validatingCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-400">
            Validating emission factors for {validatingCount} material{validatingCount !== 1 ? 's' : ''}...
          </AlertDescription>
        </Alert>
      )}

      {/* Status */}
      {!materialDataLoading && !isAutoResolving && !canCalculate && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>A few materials still need a factor</AlertTitle>
          <AlertDescription>
            {missingCount} material{missingCount !== 1 ? 's' : ''} still{' '}
            {missingCount !== 1 ? 'need' : 'needs'} an emission factor. Use
            &quot;Choose a factor&quot; next to each one below.
          </AlertDescription>
        </Alert>
      )}
      {!materialDataLoading && !isAutoResolving && canCalculate && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">
            Ready to Calculate
          </AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            All {materials.length} materials have emission data. Check anything that looks wrong below.
          </AlertDescription>
        </Alert>
      )}
      {materials.some((m) => m.validationStatus === 'assigned') && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            <strong>Some factors are assigned but could not be fully verified right now.</strong>{' '}
            This is usually temporary (database timeout or network issue). The
            calculation will attempt to resolve them again when it runs.
          </AlertDescription>
        </Alert>
      )}

      {/* Estimated-factor explanation note */}
      {materials.some((m) => m.ef_source_type === 'proxy') && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            <strong>Estimated factors in use.</strong> Where we could not find
            an exact match, we applied a conservative estimate so your
            calculation can proceed. Estimated materials are marked
            &quot;Estimated.&quot; below — both your material name and the
            estimate used are shown in the final report for full transparency.
            You can pick your own match any time with &quot;Not right? Choose
            yourself.&quot;
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {materials.map((material) => {
          const badgeProps = material.dataQuality
            ? getQualityBadgeProps(material.dataQuality)
            : null;
          const MobileIcon = badgeProps?.icon;
          const isEditing = editingMaterialId === material.id;
          const isSaving = savingMaterialId === material.id;
          const isPendingAutoResolve = pendingResolveIds.has(material.id);
          const calcFactorName =
            material.resolvedFactorName ||
            material.matched_source_name ||
            material.material_name;
          const isProxy = material.hasData && material.ef_source_type === 'proxy';

          return (
            <div key={material.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{material.material_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {material.material_type} · {material.quantity} {material.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {material.validationStatus === 'validating' || isSaving || (isPendingAutoResolve && !material.hasData) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : material.hasData ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : material.validationStatus === 'assigned' ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  ) : null}
                </div>
              </div>

              {material.hasData && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{calcFactorName}</span>
                  {isProxy && (
                    <ProvenanceChip provenance={provenanceFromEfSourceType(material.ef_source_type)} compact />
                  )}
                  <MatchStatusBadge
                    status={material.match_status}
                    onConfirm={() => handleConfirmMatch(material.id)}
                  />
                  {badgeProps && (
                    <Badge
                      variant={badgeProps.variant}
                      className={`${badgeProps.className} text-xs`}
                    >
                      {MobileIcon && <MobileIcon className="h-3 w-3 mr-1" />}
                      {material.dataQuality?.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              )}

              {material.validationStatus === 'validating' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Validating...</span>
                </div>
              )}
              {!material.hasData && isPendingAutoResolve && (
                <span className="text-xs text-muted-foreground">Matching…</span>
              )}
              {!material.hasData && material.validationStatus === 'assigned' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                    Assigned
                  </Badge>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {material.resolvedFactorName || material.matched_source_name || material.material_name}
                  </span>
                </div>
              )}
              {!material.hasData && !isPendingAutoResolve && material.validationStatus === 'missing' && (
                <Badge variant="destructive" className="text-xs">
                  Missing emission factor
                </Badge>
              )}

              {!isPendingAutoResolve && (
                <div className="pt-1">
                  {isEditing ? (
                    <InlineIngredientSearch
                      organizationId={product.organization_id}
                      value={material.material_name}
                      placeholder={`Search for an emission factor for ${material.material_name}...`}
                      materialType={
                        material.material_type as 'ingredient' | 'packaging'
                      }
                      onSelect={(selection) =>
                        handleEmissionFactorSelect(material.id, selection)
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingMaterialId(material.id)}
                      className={CHOOSE_YOURSELF_LINK_CLASS}
                    >
                      {material.hasData ? 'Not right? Choose yourself.' : 'Choose a factor.'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop materials table */}
      <div className="hidden md:block">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Your Ingredient / Material</TableHead>
                <TableHead>Calculation Factor</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const badgeProps = material.dataQuality
                  ? getQualityBadgeProps(material.dataQuality)
                  : null;
                const Icon = badgeProps?.icon;
                const isEditing = editingMaterialId === material.id;
                const isSaving = savingMaterialId === material.id;
                const isPendingAutoResolve = pendingResolveIds.has(material.id);

                // Determine what factor name is used for calculation
                const calcFactorName =
                  material.resolvedFactorName ||
                  material.matched_source_name ||
                  material.material_name;
                const isProxy = material.hasData && material.ef_source_type === 'proxy';
                const factorSource = material.resolvedFactorSource || null;
                const confidenceScore = material.confidenceScore;

                return (
                  <Fragment key={material.id}>
                    <TableRow>
                      {/* Column 1: User's ingredient name */}
                      <TableCell className="font-medium text-sm">
                        {material.material_name}
                        <div className="text-xs text-muted-foreground capitalize mt-0.5">
                          {material.material_type}
                        </div>
                      </TableCell>

                      {/* Column 2: What factor is actually used for calculation, review-first */}
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {material.hasData ? (
                              <>
                                {isProxy && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 cursor-help">
                                        <FlaskConical className="h-2.5 w-2.5" />
                                        Estimated
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-[220px] text-xs">
                                      <p>
                                        <strong>Estimated factor</strong>: the
                                        closest reasonable stand-in for &ldquo;
                                        {material.material_name}&rdquo; that we
                                        could find. This will be documented in
                                        the report.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <span
                                  className={cn(
                                    'text-xs leading-snug',
                                    isProxy
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {calcFactorName}
                                </span>
                                <ProvenanceChip
                                  provenance={provenanceFromEfSourceType(material.ef_source_type, {
                                    userAccepted: material.match_status === 'verified',
                                  })}
                                  compact
                                />
                                <MatchStatusBadge
                                  status={material.match_status}
                                  onConfirm={() => handleConfirmMatch(material.id)}
                                />
                              </>
                            ) : isPendingAutoResolve ? (
                              <span className="text-xs text-muted-foreground italic">
                                Matching…
                              </span>
                            ) : material.validationStatus === 'assigned' ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {material.resolvedFactorName || material.matched_source_name || material.material_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No factor yet
                              </span>
                            )}
                          </div>
                          {factorSource && material.hasData && (
                            <span className="text-xs text-muted-foreground/70">
                              {factorSource}
                              {confidenceScore != null &&
                                ` · ${confidenceScore}% confidence`}
                            </span>
                          )}
                          {!material.hasData && material.validationStatus === 'assigned' && (
                            <span className="text-xs text-muted-foreground/70 italic">
                              Factor assigned · verification pending
                            </span>
                          )}
                          {/* Decomposition transparency: show embedded transport/electricity % */}
                          {material.embeddedTransportPercent != null && material.embeddedTransportPercent > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] text-muted-foreground/50 cursor-help">
                                  Includes ~{material.embeddedTransportPercent.toFixed(0)}% transport
                                  {material.embeddedElectricityPercent != null && material.embeddedElectricityPercent > 0 &&
                                    `, ~${material.embeddedElectricityPercent.toFixed(0)}% electricity`}
                                  {material.embeddedElectricityGeography &&
                                    ` (${material.embeddedElectricityGeography})`}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                                <p>
                                  This cradle-to-gate factor includes generic upstream
                                  transport and processing electricity. If you specify
                                  your ingredient&apos;s origin and transport mode, your
                                  actual transport will replace this estimate during
                                  calculation.
                                </p>
                                {material.embeddedElectricityGeography && material.origin_country &&
                                  material.embeddedElectricityGeography !== (material as any).origin_country_code && (
                                  <p className="mt-1 text-amber-600 dark:text-amber-400">
                                    ⚠ Factor electricity uses {material.embeddedElectricityGeography} grid.
                                    Your ingredient origin ({material.origin_country}) may have a different
                                    grid intensity — this will be adjusted during calculation.
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Demoted picker: quiet link, not the search box itself */}
                          {!isPendingAutoResolve && !isEditing && (
                            <button
                              type="button"
                              onClick={() => setEditingMaterialId(material.id)}
                              className={cn(CHOOSE_YOURSELF_LINK_CLASS, 'w-fit')}
                            >
                              {material.hasData ? 'Not right? Choose yourself.' : 'Choose a factor.'}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 3: Quantity */}
                      <TableCell className="text-right font-mono text-sm">
                        {material.quantity} {material.unit}
                      </TableCell>

                      {/* Column 4: Quality badge */}
                      <TableCell>
                        {material.validationStatus === 'validating' ? (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Validating
                          </Badge>
                        ) : material.hasData && badgeProps ? (
                          <Badge
                            variant={badgeProps.variant}
                            className={`${badgeProps.className} text-xs`}
                          >
                            {Icon && <Icon className="h-3 w-3 mr-1" />}
                            {material.dataQuality?.replace(/_/g, ' ')}
                          </Badge>
                        ) : material.validationStatus === 'assigned' ? (
                          <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                            Assigned
                          </Badge>
                        ) : isPendingAutoResolve ? (
                          <Badge variant="secondary" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Matching
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Missing
                          </Badge>
                        )}
                      </TableCell>

                      {/* Column 5: Status icon (interaction lives in column 2 now) */}
                      <TableCell>
                        {material.validationStatus === 'validating' || isSaving || isPendingAutoResolve ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : material.hasData ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : material.validationStatus === 'assigned' ? (
                          <CheckCircle2 className="h-4 w-4 text-amber-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Inline search row, expanded from the "Choose yourself"/"Choose a factor" link */}
                    {isEditing && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="py-3">
                          <div className="max-w-lg">
                            <p className="text-xs text-muted-foreground mb-2">
                              Search for an emission factor for &quot;
                              {material.material_name}&quot;:
                            </p>
                            <InlineIngredientSearch
                              organizationId={product.organization_id}
                              value={material.material_name}
                              placeholder={`Search for an emission factor for ${material.material_name}...`}
                              materialType={
                                material.material_type as
                                  | 'ingredient'
                                  | 'packaging'
                              }
                              onSelect={(selection) =>
                                handleEmissionFactorSelect(material.id, selection)
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  );
}
