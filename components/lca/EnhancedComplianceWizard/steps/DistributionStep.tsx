'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Plus, Trash2, Truck, Loader2, AlertTriangle } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import {
  getDefaultDistributionConfig,
  calculateDistributionEmissions,
  generateLegId,
  DISTRIBUTION_SCENARIOS,
  type DistributionConfig,
  type DistributionLeg,
  type DistributionResult,
} from '@/lib/distribution-factors';
import {
  formatTransportMode,
  getTransportModeWarning,
  type TransportMode,
} from '@/lib/utils/transport-emissions-calculator';

// ============================================================================
// HELPERS
// ============================================================================

const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
  { value: 'truck', label: 'Road (HGV)' },
  { value: 'train', label: 'Rail Freight' },
  { value: 'ship', label: 'Sea Freight' },
  { value: 'air', label: 'Air Freight' },
];

/**
 * Calculate total product weight from all materials.
 * Sums all material quantities, assuming they are in kg.
 */
function getProductWeightKg(materials: any[]): number {
  if (!materials || materials.length === 0) return 1;
  let totalKg = 0;
  for (const mat of materials) {
    const qty = Number(mat.quantity || 0);
    const unit = (mat.unit || 'kg').toLowerCase();
    if (unit === 'g') {
      totalKg += qty / 1000;
    } else if (unit === 'mg') {
      totalKg += qty / 1_000_000;
    } else if (unit === 'tonne' || unit === 't') {
      totalKg += qty * 1000;
    } else if (unit === 'ml') {
      totalKg += qty / 1000; // Approximate: 1 ml ≈ 1 g for liquids
    } else if (unit === 'l' || unit === 'litre' || unit === 'liter') {
      totalKg += qty; // Approximate: 1 L ≈ 1 kg for water-based beverages
    } else {
      totalKg += qty; // Default: assume kg
    }
  }
  return Math.max(totalKg, 0.001); // Minimum 1g to avoid division by zero
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DistributionStep() {
  const { formData, updateField, preCalcState } = useWizardContext();

  const [preview, setPreview] = useState<DistributionResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('custom');

  // Auto-detect product weight on mount if no config exists
  useEffect(() => {
    if (!formData.distributionConfig) {
      const weightKg = getProductWeightKg(preCalcState.materials || []);
      const defaults = getDefaultDistributionConfig(weightKg);
      updateField('distributionConfig', defaults);
    }
  }, [preCalcState.materials]);

  const config: DistributionConfig = formData.distributionConfig || {
    legs: [],
    productWeightKg: 1,
  };

  const updateConfig = useCallback(
    (partial: Partial<DistributionConfig>) => {
      updateField('distributionConfig', { ...config, ...partial });
    },
    [config, updateField]
  );

  // Live preview calculation (debounced)
  useEffect(() => {
    if (!config.legs || config.legs.length === 0 || config.productWeightKg <= 0) {
      setPreview(null);
      return;
    }

    // Check if we have at least one valid leg
    const hasValidLeg = config.legs.some(
      (leg) => leg.transportMode && leg.distanceKm > 0
    );
    if (!hasValidLeg) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await calculateDistributionEmissions(config);
        setPreview(result);
      } catch (err) {
        console.error('[DistributionStep] Preview calculation failed:', err);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [config]);

  // Scenario selection handler
  const handleScenarioChange = (scenarioKey: string) => {
    setSelectedScenario(scenarioKey);
    if (scenarioKey === 'custom') return;

    const scenario = DISTRIBUTION_SCENARIOS[scenarioKey];
    if (!scenario) return;

    const newLegs: DistributionLeg[] = scenario.legs.map((leg) => ({
      ...leg,
      id: generateLegId(),
    }));

    updateConfig({ legs: newLegs });
  };

  // Leg management
  const addLeg = () => {
    const newLeg: DistributionLeg = {
      id: generateLegId(),
      label: '',
      transportMode: 'truck',
      distanceKm: 0,
    };
    updateConfig({ legs: [...config.legs, newLeg] });
    setSelectedScenario('custom');
  };

  const removeLeg = (legId: string) => {
    updateConfig({ legs: config.legs.filter((l) => l.id !== legId) });
    setSelectedScenario('custom');
  };

  const updateLeg = (legId: string, partial: Partial<DistributionLeg>) => {
    const updatedLegs = config.legs.map((leg) =>
      leg.id === legId ? { ...leg, ...partial } : leg
    );
    updateConfig({ legs: updatedLegs });
    if (partial.transportMode || partial.distanceKm !== undefined) {
      setSelectedScenario('custom');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Outbound Distribution</h3>
        <p className="text-sm text-muted-foreground">
          Configure how your product is transported from the factory to the point
          of sale or consumer. Each transport segment (leg) contributes to the
          distribution emissions.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This covers <strong>outbound</strong> distribution only (factory →
          shelf/consumer). Inbound transport (supplier → factory) is already
          included in your raw material impacts.
        </AlertDescription>
      </Alert>

      {/* Product Weight */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-blue-500" />
          <Label className="text-sm font-medium">Shipped Product Weight</Label>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={0.001}
            step={0.1}
            value={config.productWeightKg || ''}
            onChange={(e) =>
              updateConfig({ productWeightKg: parseFloat(e.target.value) || 0 })
            }
            className="w-[180px]"
          />
          <span className="text-sm text-muted-foreground">kg per functional unit</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-calculated from your materials. Adjust if the total shipped weight
          (including secondary packaging) differs.
        </p>
      </div>

      {/* Scenario Presets */}
      <div className="rounded-lg border p-4 space-y-3">
        <Label className="text-sm font-medium">Distribution Scenario</Label>
        <Select value={selectedScenario} onValueChange={handleScenarioChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a scenario or customise" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            {Object.entries(DISTRIBUTION_SCENARIOS).map(([key, scenario]) => (
              <SelectItem key={key} value={key}>
                {scenario.label} — {scenario.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select a preset to auto-fill typical routes, or choose Custom to build your own.
        </p>
      </div>

      {/* Distribution Legs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Transport Legs</Label>
          <Button variant="outline" size="sm" onClick={addLeg}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Leg
          </Button>
        </div>

        {config.legs.length === 0 && (
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No transport legs defined. Add a leg or select a scenario preset above.
            </p>
          </div>
        )}

        {config.legs.map((leg, index) => {
          const warning = getTransportModeWarning(
            leg.transportMode,
            leg.distanceKm
          );
          return (
            <div
              key={leg.id}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Leg {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLeg(leg.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Label */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="e.g. Factory to port"
                    value={leg.label}
                    onChange={(e) =>
                      updateLeg(leg.id, { label: e.target.value })
                    }
                  />
                </div>

                {/* Transport Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Transport Mode</Label>
                  <Select
                    value={leg.transportMode}
                    onValueChange={(value) =>
                      updateLeg(leg.id, {
                        transportMode: value as TransportMode,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Distance */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Distance (km)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    placeholder="0"
                    value={leg.distanceKm || ''}
                    onChange={(e) =>
                      updateLeg(leg.id, {
                        distanceKm: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {/* Plausibility Warning */}
              {warning && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    {warning}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Preview */}
      {previewLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Calculating preview...</span>
        </div>
      )}

      {preview && !previewLoading && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-medium">Estimated Distribution Emissions</h4>

          {/* Per-leg breakdown */}
          {preview.perLeg.length > 1 && (
            <div className="space-y-1">
              {preview.perLeg.map((leg) => (
                <div
                  key={leg.legId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {leg.label || 'Unnamed leg'}{' '}
                    <span className="text-xs">
                      ({formatTransportMode(leg.mode)}, {leg.distanceKm.toLocaleString()} km)
                    </span>
                  </span>
                  <span className="font-medium">
                    {leg.emissions.toFixed(4)} kg CO₂e
                  </span>
                </div>
              ))}
              <div className="border-t pt-1 mt-1" />
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Distribution</span>
            <span className="font-semibold text-primary">
              {preview.total.toFixed(4)} kg CO₂e
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Per functional unit ({config.productWeightKg.toFixed(3)} kg shipped weight).
            Uses DEFRA 2025 freight emission factors.
          </p>
        </div>
      )}
    </div>
  );
}
