'use client';

import React, { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Search,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { validateMaterialsBeforeCalculation } from '@/lib/impact-waterfall-resolver';
import { toast } from 'sonner';
import { InlineIngredientSearch } from '@/components/lca/InlineIngredientSearch';
import type { DataSource } from '@/lib/types/lca';
import type { MaterialWithValidation } from '../types';
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

function getConfidenceColor(score: number) {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-blue-600 dark:text-blue-400';
  return 'text-slate-600 dark:text-slate-400';
}

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

  async function handleEmissionFactorSelect(
    materialId: string,
    selection: {
      name: string;
      data_source: DataSource;
      data_source_id?: string;
      supplier_product_id?: string;
      unit: string;
      carbon_intensity?: number;
    }
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
              dataQuality: r.data_quality_tag,
              confidenceScore: r.confidence_score,
              resolvedFactorName: updatedRow.matched_source_name || updatedRow.material_name,
              resolvedFactorSource: sourceLabel,
              resolvedPriority: r.data_priority,
              error: undefined,
            } as MaterialWithValidation;
          }
          const missing = validation.missingData[0];
          return {
            ...updatedRow,
            hasData: false,
            error: missing?.error || 'Validation failed',
          } as MaterialWithValidation;
        });

        const newMissing = updated.filter((m) => !m.hasData).length;
        return {
          ...prev,
          materials: updated,
          missingCount: newMissing,
          canCalculate: newMissing === 0,
          editingMaterialId: null,
          savingMaterialId: null,
        };
      });

      toast.success(`Emission factor assigned for ${updatedRow.material_name}`);
    } catch (error: any) {
      console.error('Error updating emission factor:', error);
      toast.error(error.message || 'Failed to update emission factor');
      setPreCalcState((prev) => ({ ...prev, savingMaterialId: null }));
    }
  }

  if (materialDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
        <p className="text-sm text-muted-foreground">
          Loading and validating materials...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Material Validation</h3>
        <p className="text-sm text-muted-foreground">
          All materials need verified emission data before calculating the
          lifecycle assessment. Review the table below and fix any missing data.
        </p>
      </div>

      {/* Status */}
      {!canCalculate && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Emission Data</AlertTitle>
          <AlertDescription>
            {missingCount} material{missingCount !== 1 ? 's are' : ' is'}{' '}
            missing emission factors. Click &quot;Fix&quot; next to each missing
            material to search and assign one.
          </AlertDescription>
        </Alert>
      )}
      {canCalculate && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">
            Ready to Calculate
          </AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            All {materials.length} materials have verified emission data.
          </AlertDescription>
        </Alert>
      )}

      {/* Proxy explanation note */}
      {materials.some(
        (m) =>
          m.hasData &&
          m.matched_source_name &&
          m.matched_source_name !== m.material_name
      ) && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
            <strong>Proxy factors in use.</strong> Some ingredients are
            calculated using a proxy emission factor (shown in the
            &quot;Calculation Factor&quot; column below). The proxy is the
            closest matching dataset from ecoinvent, AGRIBALYSE, or your
            supplier data. Both your ingredient name and the proxy used are
            shown in the final LCA report for full transparency.
          </AlertDescription>
        </Alert>
      )}

      {/* Materials Table */}
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

              // Determine what factor name is used for calculation
              const calcFactorName =
                material.resolvedFactorName ||
                material.matched_source_name ||
                material.material_name;
              const isProxy =
                material.hasData &&
                calcFactorName !== material.material_name;
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

                    {/* Column 2: What factor is actually used for calculation */}
                    <TableCell className="text-sm">
                      {material.hasData ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {isProxy && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 cursor-help">
                                    <FlaskConical className="h-2.5 w-2.5" />
                                    Proxy
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[220px] text-xs">
                                  <p>
                                    <strong>Proxy factor</strong> — the closest
                                    matching dataset for &ldquo;
                                    {material.material_name}&rdquo; found in the
                                    LCA database. This will be documented in
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
                          </div>
                          {factorSource && (
                            <span className="text-xs text-muted-foreground/70">
                              {factorSource}
                              {confidenceScore != null &&
                                ` · ${confidenceScore}% confidence`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          No factor assigned
                        </span>
                      )}
                    </TableCell>

                    {/* Column 3: Quantity */}
                    <TableCell className="text-right font-mono text-sm">
                      {material.quantity} {material.unit}
                    </TableCell>

                    {/* Column 4: Quality badge */}
                    <TableCell>
                      {material.hasData && badgeProps ? (
                        <Badge
                          variant={badgeProps.variant}
                          className={`${badgeProps.className} text-xs`}
                        >
                          {Icon && <Icon className="h-3 w-3 mr-1" />}
                          {material.dataQuality?.replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Missing
                        </Badge>
                      )}
                    </TableCell>

                    {/* Column 5: Status / Fix button */}
                    <TableCell>
                      {material.hasData ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-lime-500" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-lime-600 hover:text-lime-700 hover:bg-lime-50 dark:text-lime-400 dark:hover:text-lime-300 dark:hover:bg-lime-950/30"
                          onClick={() =>
                            setEditingMaterialId(isEditing ? null : material.id)
                          }
                        >
                          <Search className="h-3 w-3 mr-1" />
                          {isEditing ? 'Cancel' : 'Fix'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Inline search row for missing materials */}
                  {isEditing && !material.hasData && (
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
                            placeholder={`Search emission factor for ${material.material_name}...`}
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
  );
}
