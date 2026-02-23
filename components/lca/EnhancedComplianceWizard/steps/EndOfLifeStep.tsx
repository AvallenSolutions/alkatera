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

  // Build material rows — one row per packaging material so users can see
  // exactly which materials are in their product (e.g. "Glass Bottle 500ml").
  // Ingredients are grouped into a single "Organic Waste" row.
  const materialRows = useMemo((): MaterialRow[] => {
    const materials = preCalcState.materials || [];
    const rows: MaterialRow[] = [];
    let organicTotal = 0;
    let organicUnit = 'kg';

    for (const mat of materials) {
      const packagingCategory = (mat as any).packaging_category || '';
      const materialType = (mat.material_type || '').toLowerCase();
      const quantity = Number(mat.quantity || 0);
      if (quantity <= 0) continue;

      const isPackaging = materialType === 'packaging' || materialType === 'packaging_material';

      if (!isPackaging) {
        // Ingredients → aggregate into one "Organic Waste" row
        organicTotal += quantity;
        organicUnit = mat.unit || 'kg';
        continue;
      }

      const factorKey = getMaterialFactorKey(packagingCategory || 'other');

      // Use the material's actual name (e.g. "Glass Bottle 500ml")
      // with the factor type in parentheses for clarity
      const label = MATERIAL_TYPE_LABELS[factorKey] || factorKey;
      const displayName = mat.material_name
        ? `${mat.material_name}`
        : label;

      rows.push({
        id: mat.id || `${factorKey}-${rows.length}`,
        name: displayName,
        factorKey,
        quantity,
        unit: mat.unit || 'kg',
        pathways: getRegionalDefaults(config.region, factorKey),
      });
    }

    // Add aggregated organic waste row for ingredients
    if (organicTotal > 0) {
      rows.push({
        id: 'organic',
        name: 'Organic Waste (ingredients)',
        factorKey: 'organic',
        quantity: organicTotal,
        unit: organicUnit,
        pathways: getRegionalDefaults(config.region, 'organic'),
      });
    }

    return rows;
  }, [preCalcState.materials, config.region]);

  // Initialize pathways from regional defaults when region changes or on mount.
  // Keyed by material row ID so each material has its own overrides.
  useEffect(() => {
    const pathways: Record<string, RegionalDefaults> = {};
    for (const row of materialRows) {
      // Preserve existing overrides (try row ID first, then fall back to factorKey for backwards compat)
      const defaults = getRegionalDefaults(config.region, row.factorKey);
      const existingOverride = config.pathways[row.id] || config.pathways[row.factorKey];
      if (existingOverride) {
        // Merge with defaults to fill any missing fields (e.g. anaerobic_digestion)
        pathways[row.id] = { ...defaults, ...existingOverride };
      } else {
        pathways[row.id] = defaults;
      }
    }
    updateField('eolConfig', { ...config, pathways });
  }, [config.region, materialRows.length]);

  const updateRegion = (region: EoLRegion) => {
    // Reset all pathways to new region defaults
    const pathways: Record<string, RegionalDefaults> = {};
    for (const row of materialRows) {
      pathways[row.id] = getRegionalDefaults(region, row.factorKey);
    }
    updateField('eolConfig', { region, pathways });
  };

  const updatePathway = (
    rowId: string,
    factorKey: string,
    field: keyof RegionalDefaults,
    value: number
  ) => {
    const current = config.pathways[rowId] || getRegionalDefaults(config.region, factorKey);
    const updated = { ...current, [field]: value };
    updateField('eolConfig', {
      ...config,
      pathways: { ...config.pathways, [rowId]: updated },
    });
  };

  // Validation: check if all pathways sum to ~100%
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const row of materialRows) {
      const p = config.pathways[row.id];
      if (p) {
        const sum = p.recycling + p.landfill + p.incineration + p.composting + (p.anaerobic_digestion || 0);
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
      const pathwayOverrides = config.pathways[row.id];
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
                  <th className="text-center p-3 font-medium">AD %</th>
                  <th className="text-center p-3 font-medium">Sum</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row) => {
                  const p = config.pathways[row.id] ||
                    getRegionalDefaults(config.region, row.factorKey);
                  const sum =
                    p.recycling + p.landfill + p.incineration + p.composting + (p.anaerobic_digestion || 0);
                  const isValid = Math.abs(sum - 100) <= 1;

                  return (
                    <tr
                      key={row.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="p-3">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {MATERIAL_TYPE_LABELS[row.factorKey] || row.factorKey}
                        </div>
                      </td>
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
                              row.id,
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
                              row.id,
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
                              row.id,
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
                              row.id,
                              row.factorKey,
                              'composting',
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
                          value={p.anaerobic_digestion || 0}
                          onChange={(e) =>
                            updatePathway(
                              row.id,
                              row.factorKey,
                              'anaerobic_digestion',
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
