'use client';

import React, { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Recycle, AlertCircle } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import {
  type EoLRegion,
  type EoLConfig,
  type RegionalDefaults,
  getRegionalDefaults,
  getMaterialFactorKey,
  MATERIAL_TYPE_LABELS,
  REGION_LABELS,
  calculateMaterialEoL,
} from '@/lib/end-of-life-factors';

// ============================================================================
// TYPES
// ============================================================================

interface MaterialRow {
  id: string;
  name: string;
  factorKey: string;
  quantity: number;
  unit: string;
  pathways: RegionalDefaults;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EndOfLifeStep() {
  const { formData, updateField, preCalcState } = useWizardContext();

  const config: EoLConfig = formData.eolConfig || {
    region: 'eu',
    pathways: {},
  };

  // Build material rows from pre-calc materials data
  const materialRows = useMemo((): MaterialRow[] => {
    const materials = preCalcState.materials || [];
    // Group by factor key to avoid duplicates
    const grouped = new Map<string, MaterialRow>();

    for (const mat of materials) {
      const packagingCategory = (mat as any).packaging_category || '';
      const materialType = (mat.material_type || '').toLowerCase();
      const factorKey = getMaterialFactorKey(
        packagingCategory ||
          (materialType === 'packaging' || materialType === 'packaging_material'
            ? 'other'
            : 'organic')
      );

      const existing = grouped.get(factorKey);
      if (existing) {
        existing.quantity += Number(mat.quantity || 0);
      } else {
        grouped.set(factorKey, {
          id: factorKey,
          name: MATERIAL_TYPE_LABELS[factorKey] || factorKey,
          factorKey,
          quantity: Number(mat.quantity || 0),
          unit: mat.unit || 'kg',
          pathways: getRegionalDefaults(config.region, factorKey),
        });
      }
    }

    return Array.from(grouped.values()).filter((r) => r.quantity > 0);
  }, [preCalcState.materials, config.region]);

  // Initialize pathways from regional defaults when region changes or on mount
  useEffect(() => {
    const pathways: Record<string, RegionalDefaults> = {};
    for (const row of materialRows) {
      const existingOverride = config.pathways[row.factorKey];
      if (existingOverride) {
        pathways[row.factorKey] = existingOverride;
      } else {
        pathways[row.factorKey] = getRegionalDefaults(config.region, row.factorKey);
      }
    }
    updateField('eolConfig', { ...config, pathways });
  }, [config.region, materialRows.length]);

  const updateRegion = (region: EoLRegion) => {
    // Reset all pathways to new region defaults
    const pathways: Record<string, RegionalDefaults> = {};
    for (const row of materialRows) {
      pathways[row.factorKey] = getRegionalDefaults(region, row.factorKey);
    }
    updateField('eolConfig', { region, pathways });
  };

  const updatePathway = (
    factorKey: string,
    field: keyof RegionalDefaults,
    value: number
  ) => {
    const current = config.pathways[factorKey] || getRegionalDefaults(config.region, factorKey);
    const updated = { ...current, [field]: value };
    updateField('eolConfig', {
      ...config,
      pathways: { ...config.pathways, [factorKey]: updated },
    });
  };

  // Validation: check if all pathways sum to ~100%
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const row of materialRows) {
      const p = config.pathways[row.factorKey];
      if (p) {
        const sum = p.recycling + p.landfill + p.incineration + p.composting;
        if (Math.abs(sum - 100) > 1) {
          errors.push(
            `${row.name}: pathways sum to ${sum}% (should be 100%)`
          );
        }
      }
    }
    return errors;
  }, [config.pathways, materialRows]);

  // Live preview
  const preview = useMemo(() => {
    let totalNet = 0;
    let totalAvoided = 0;
    let totalGross = 0;

    for (const row of materialRows) {
      const pathwayOverrides = config.pathways[row.factorKey];
      const result = calculateMaterialEoL(
        row.quantity,
        row.factorKey,
        config.region,
        pathwayOverrides
      );
      totalNet += result.net;
      totalAvoided += result.avoided;
      totalGross += result.gross;
    }

    return { net: totalNet, avoided: totalAvoided, gross: totalGross };
  }, [materialRows, config]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">End of Life</h3>
        <p className="text-sm text-muted-foreground">
          Configure disposal pathway assumptions for all materials. Regional
          defaults are based on published recycling rates.
        </p>
      </div>

      {/* Region Selector */}
      <div className="space-y-2">
        <Label>Region</Label>
        <Select
          value={config.region}
          onValueChange={(value) => updateRegion(value as EoLRegion)}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(REGION_LABELS) as [EoLRegion, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Determines default recycling, landfill, and incineration rates
        </p>
      </div>

      {/* Material Pathways Table */}
      {materialRows.length > 0 ? (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Material</th>
                  <th className="text-left p-3 font-medium">Mass (kg)</th>
                  <th className="text-center p-3 font-medium">
                    <span className="flex items-center justify-center gap-1">
                      <Recycle className="h-3 w-3" /> Recycling %
                    </span>
                  </th>
                  <th className="text-center p-3 font-medium">Landfill %</th>
                  <th className="text-center p-3 font-medium">
                    Incineration %
                  </th>
                  <th className="text-center p-3 font-medium">Composting %</th>
                  <th className="text-center p-3 font-medium">Sum</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row) => {
                  const p = config.pathways[row.factorKey] ||
                    getRegionalDefaults(config.region, row.factorKey);
                  const sum =
                    p.recycling + p.landfill + p.incineration + p.composting;
                  const isValid = Math.abs(sum - 100) <= 1;

                  return (
                    <tr
                      key={row.factorKey}
                      className="border-b last:border-b-0"
                    >
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {row.quantity.toFixed(2)}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={p.recycling}
                          onChange={(e) =>
                            updatePathway(
                              row.factorKey,
                              'recycling',
                              Number(e.target.value)
                            )
                          }
                          className="h-8 w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={p.landfill}
                          onChange={(e) =>
                            updatePathway(
                              row.factorKey,
                              'landfill',
                              Number(e.target.value)
                            )
                          }
                          className="h-8 w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={p.incineration}
                          onChange={(e) =>
                            updatePathway(
                              row.factorKey,
                              'incineration',
                              Number(e.target.value)
                            )
                          }
                          className="h-8 w-20 mx-auto text-center"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={p.composting}
                          onChange={(e) =>
                            updatePathway(
                              row.factorKey,
                              'composting',
                              Number(e.target.value)
                            )
                          }
                          className="h-8 w-20 mx-auto text-center"
                        />
                      </td>
                      <td
                        className={`p-3 text-center font-medium ${
                          isValid
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {sum}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            No materials found. Please ensure materials are loaded in the
            Materials step.
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Pathway percentages must sum to 100%:</p>
            <ul className="list-disc list-inside text-xs">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Live Preview */}
      {materialRows.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <h4 className="text-sm font-medium">
            Estimated End-of-Life Emissions
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Gross Emissions</p>
              <p className="font-medium">{preview.gross.toFixed(4)} kg CO₂e</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recycling Credits</p>
              <p className="font-medium text-green-600 dark:text-green-400">
                {preview.avoided.toFixed(4)} kg CO₂e
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Net Total</p>
              <p
                className={`font-semibold ${
                  preview.net < 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-primary'
                }`}
              >
                {preview.net.toFixed(4)} kg CO₂e
              </p>
            </div>
          </div>
          {preview.net < 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Net negative — recycling credits exceed disposal emissions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
