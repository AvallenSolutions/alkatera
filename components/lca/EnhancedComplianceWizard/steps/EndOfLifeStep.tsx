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
  /** True when defaults were seeded from the material's stored circularity fields (reuse_trips, end_of_life_pathway, recyclability_percent) rather than regional averages. */
  fromCircularity?: boolean;
  circularityLabel?: string;
}

// Build pathway defaults from a material's stored circularity fields.
// Returns null if nothing is set on the row.
function circularityPathways(
  storedPathway: string | null | undefined,
  recyclabilityPct: number | null,
  regional: RegionalDefaults,
): RegionalDefaults | null {
  if (!storedPathway && recyclabilityPct == null) return null;

  // Base: either 100% of the stored pathway, or the regional default.
  const base: RegionalDefaults = storedPathway
    ? (() => {
        const map: Record<string, RegionalDefaults> = {
          recycling: { recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          reuse: { recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          landfill: { recycling: 0, landfill: 100, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          incineration: { recycling: 0, landfill: 0, incineration: 100, composting: 0, anaerobic_digestion: 0 },
          composting: { recycling: 0, landfill: 0, incineration: 0, composting: 100, anaerobic_digestion: 0 },
        };
        return map[storedPathway] ?? { ...regional };
      })()
    : { ...regional };

  // Apply recyclability cap on recycling share and redistribute by regional
  // landfill/incineration ratio.
  if (recyclabilityPct != null && base.recycling > recyclabilityPct) {
    const excess = base.recycling - recyclabilityPct;
    const lf = regional.landfill ?? 0;
    const inc = regional.incineration ?? 0;
    const lfShare = lf + inc > 0 ? lf / (lf + inc) : 0.7;
    base.recycling = recyclabilityPct;
    base.landfill = (base.landfill ?? 0) + excess * lfShare;
    base.incineration = (base.incineration ?? 0) + excess * (1 - lfShare);
  }

  return base;
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

      const factorKey = getMaterialFactorKey(packagingCategory || 'other', mat.material_name);

      // Use the material's actual name (e.g. "Glass Bottle 500ml")
      // with the factor type in parentheses for clarity
      const label = MATERIAL_TYPE_LABELS[factorKey] || factorKey;
      const displayName = mat.material_name
        ? `${mat.material_name}`
        : label;

      const regional = getRegionalDefaults(config.region, factorKey);
      const storedPathway = (mat as any).end_of_life_pathway as string | null | undefined;
      const rawRecyclability = (mat as any).recyclability_percent;
      const recyclabilityPct = Number.isFinite(Number(rawRecyclability))
        ? Math.max(0, Math.min(100, Number(rawRecyclability)))
        : null;
      const fromCirc = circularityPathways(storedPathway, recyclabilityPct, regional);

      const circParts: string[] = [];
      if (storedPathway) circParts.push(`${storedPathway} pathway`);
      if (recyclabilityPct != null) circParts.push(`${recyclabilityPct}% recyclable`);

      rows.push({
        id: mat.id || `${factorKey}-${rows.length}`,
        name: displayName,
        factorKey,
        quantity,
        unit: mat.unit || 'kg',
        pathways: fromCirc ?? regional,
        fromCircularity: !!fromCirc,
        circularityLabel: circParts.length > 0 ? circParts.join(' · ') : undefined,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preCalcState.materials]);

  // Seed pathways for any materials that don't yet have overrides (e.g. on
  // first mount or when new materials are added). Does NOT run on region
  // change — `updateRegion` handles that to avoid overwriting user edits.
  useEffect(() => {
    const existing = config.pathways;
    const pathways: Record<string, RegionalDefaults> = {};
    let changed = false;

    // Copy existing entries, ensuring anaerobic_digestion is always present
    for (const [key, val] of Object.entries(existing)) {
      pathways[key] = { anaerobic_digestion: 0, ...val };
    }

    for (const row of materialRows) {
      if (!pathways[row.id]) {
        // Try backwards-compat key (factorKey), then fall back to defaults.
        // Rows seeded from material circularity fields use row.pathways
        // directly so the stored pathway/recyclability wins over regional.
        const legacy = existing[row.factorKey];
        const defaults = row.fromCircularity
          ? row.pathways
          : getRegionalDefaults(config.region, row.factorKey);
        pathways[row.id] = legacy && !row.fromCircularity
          ? { ...defaults, ...legacy }
          : defaults;
        changed = true;
      }
    }

    if (changed) {
      updateField('eolConfig', { ...config, pathways });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialRows.length]);

  const updateRegion = (region: EoLRegion) => {
    // Reset all pathways to new region defaults, but preserve rows that were
    // seeded from material circularity fields — the user set reuse_trips /
    // recyclability on the packaging itself, which trumps regional averages.
    const pathways: Record<string, RegionalDefaults> = {};
    for (const row of materialRows) {
      if (row.fromCircularity) {
        const prior = config.pathways[row.id] || row.pathways;
        pathways[row.id] = { anaerobic_digestion: 0, ...prior };
      } else {
        pathways[row.id] = getRegionalDefaults(region, row.factorKey);
      }
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
                <tr className="bg-muted/50 border-b text-xs">
                  <th className="text-left p-2 font-medium">Material</th>
                  <th className="text-right p-2 font-medium">kg</th>
                  <th className="text-center p-2 font-medium">
                    <span className="flex items-center justify-center gap-0.5">
                      <Recycle className="h-3 w-3" /> Recycle
                    </span>
                  </th>
                  <th className="text-center p-2 font-medium">Landfill</th>
                  <th className="text-center p-2 font-medium">Incinerate</th>
                  <th className="text-center p-2 font-medium">Compost</th>
                  <th className="text-center p-2 font-medium">AD</th>
                  <th className="text-center p-2 font-medium">Sum</th>
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
                      <td className="p-2">
                        <div className="font-medium text-xs flex items-center gap-1.5 flex-wrap">
                          {row.name}
                          {row.fromCircularity && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-[#ccff00]/40 bg-[#ccff00]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#8da300] dark:text-[#ccff00]"
                              title={row.circularityLabel || 'Seeded from packaging circularity'}
                            >
                              <Recycle className="h-2.5 w-2.5" />
                              From packaging defaults
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {MATERIAL_TYPE_LABELS[row.factorKey] || row.factorKey}
                          {row.fromCircularity && row.circularityLabel && (
                            <> · {row.circularityLabel}</>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">
                        {row.quantity.toFixed(2)}
                      </td>
                      <td className="p-1">
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
                          className="h-7 w-14 mx-auto text-center text-xs"
                        />
                      </td>
                      <td className="p-1">
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
                          className="h-7 w-14 mx-auto text-center text-xs"
                        />
                      </td>
                      <td className="p-1">
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
                          className="h-7 w-14 mx-auto text-center text-xs"
                        />
                      </td>
                      <td className="p-1">
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
                          className="h-7 w-14 mx-auto text-center text-xs"
                        />
                      </td>
                      <td className="p-1">
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
                          className="h-7 w-14 mx-auto text-center text-xs"
                        />
                      </td>
                      <td
                        className={`p-2 text-center text-xs font-medium tabular-nums ${
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
