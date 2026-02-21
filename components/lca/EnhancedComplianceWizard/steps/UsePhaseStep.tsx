'use client';

import React, { useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Thermometer, Droplets } from 'lucide-react';
import { useWizardContext } from '../WizardContext';
import {
  getDefaultUsePhaseConfig,
  calculateUsePhaseEmissions,
  type UsePhaseConfig,
} from '@/lib/use-phase-factors';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UsePhaseStep() {
  const { formData, updateField, preCalcState } = useWizardContext();

  const productCategory = preCalcState.product?.product_category || '';

  // Auto-detect defaults on mount if no config exists
  useEffect(() => {
    if (!formData.usePhaseConfig) {
      const defaults = getDefaultUsePhaseConfig(productCategory);
      updateField('usePhaseConfig', defaults);
    }
  }, [productCategory]);

  const config: UsePhaseConfig = formData.usePhaseConfig || {
    needsRefrigeration: false,
    refrigerationDays: 7,
    retailRefrigerationSplit: 0.5,
    isCarbonated: false,
  };

  const updateConfig = (partial: Partial<UsePhaseConfig>) => {
    updateField('usePhaseConfig', { ...config, ...partial });
  };

  // Get product volume for preview calculation
  const volumeLitres = useMemo(() => {
    const product = preCalcState.product;
    if (!product) return 0;
    const val = Number(product.unit_size_value || 0);
    const unit = (product.unit_size_unit || '').toLowerCase();
    if (unit === 'ml') return val / 1000;
    if (unit === 'l' || unit === 'litre' || unit === 'liter') return val;
    return val / 1000; // Default assume ml
  }, [preCalcState.product]);

  // Live preview
  const preview = useMemo(() => {
    if (volumeLitres <= 0) return null;
    return calculateUsePhaseEmissions(config, volumeLitres);
  }, [config, volumeLitres]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Use Phase Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure how consumers typically use this product. These parameters
          determine use-phase emissions from refrigeration and carbonation.
        </p>
      </div>

      {productCategory && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Defaults auto-detected from product category:{' '}
            <strong>{productCategory}</strong>. You can override below.
          </AlertDescription>
        </Alert>
      )}

      {/* Refrigeration */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-blue-500" />
            <Label className="text-sm font-medium">Requires Refrigeration</Label>
          </div>
          <Switch
            checked={config.needsRefrigeration}
            onCheckedChange={(checked) =>
              updateConfig({ needsRefrigeration: checked })
            }
          />
        </div>

        {config.needsRefrigeration && (
          <div className="space-y-4 pl-6 border-l-2 border-blue-200 dark:border-blue-800">
            {/* Storage Duration */}
            <div className="space-y-2">
              <Label className="text-xs">
                Average Storage Duration
              </Label>
              <Select
                value={String(config.refrigerationDays)}
                onValueChange={(value) =>
                  updateConfig({ refrigerationDays: parseInt(value) })
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days (typical)</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Average time the product is refrigerated before consumption
              </p>
            </div>

            {/* Retail/Domestic Split */}
            <div className="space-y-2">
              <Label className="text-xs">
                Retail vs Domestic Refrigeration Split
              </Label>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">
                  Retail {Math.round(config.retailRefrigerationSplit * 100)}%
                </span>
                <Slider
                  value={[config.retailRefrigerationSplit * 100]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={([value]) =>
                    updateConfig({ retailRefrigerationSplit: value / 100 })
                  }
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-16 text-right">
                  Home {Math.round((1 - config.retailRefrigerationSplit) * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Retail chillers use more energy than domestic fridges
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Consumer Market (Country) — MEDIUM FIX #19 */}
      {config.needsRefrigeration && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Primary Consumer Market</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            The electricity grid emission factor for the consumer&apos;s country affects
            refrigeration CO₂e. Defaults to the global average (0.490 kg CO₂e/kWh IEA 2023)
            if not specified.
          </p>
          <Select
            value={config.consumerCountryCode || '__global__'}
            onValueChange={(value) =>
              updateConfig({
                consumerCountryCode: value === '__global__' ? null : value,
              })
            }
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select consumer market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__global__">Global average (IEA 2023)</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="FR">France</SelectItem>
              <SelectItem value="IT">Italy</SelectItem>
              <SelectItem value="ES">Spain</SelectItem>
              <SelectItem value="NL">Netherlands</SelectItem>
              <SelectItem value="SE">Sweden</SelectItem>
              <SelectItem value="NO">Norway</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="JP">Japan</SelectItem>
              <SelectItem value="CN">China</SelectItem>
              <SelectItem value="IE">Ireland</SelectItem>
              <SelectItem value="BE">Belgium</SelectItem>
              <SelectItem value="DK">Denmark</SelectItem>
              <SelectItem value="AT">Austria</SelectItem>
              <SelectItem value="CH">Switzerland</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Carbonation */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-cyan-500" />
            <Label className="text-sm font-medium">Carbonated Beverage</Label>
          </div>
          <Switch
            checked={config.isCarbonated}
            onCheckedChange={(checked) =>
              updateConfig({ isCarbonated: checked })
            }
          />
        </div>

        {config.isCarbonated && (
          <div className="space-y-2 pl-6 border-l-2 border-cyan-200 dark:border-cyan-800">
            <Label className="text-xs">Carbonation Type</Label>
            <Select
              value={config.carbonationType || 'beer'}
              onValueChange={(value) =>
                updateConfig({
                  carbonationType: value as UsePhaseConfig['carbonationType'],
                })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beer">Beer / Cider</SelectItem>
                <SelectItem value="sparkling_wine">Sparkling Wine</SelectItem>
                <SelectItem value="soft_drink">Soft Drink / RTD</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dissolved CO₂ released when the beverage is opened (biogenic)
            </p>
          </div>
        )}
      </div>

      {/* Live Preview */}
      {preview && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <h4 className="text-sm font-medium">Estimated Use Phase Emissions</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Refrigeration</p>
              <p className="font-medium">
                {preview.refrigeration.toFixed(4)} kg CO₂e
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Carbonation</p>
              <p className="font-medium">
                {preview.carbonation.toFixed(4)} kg CO₂e
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-semibold text-primary">
                {preview.total.toFixed(4)} kg CO₂e
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Per functional unit ({volumeLitres.toFixed(2)}L)
          </p>
        </div>
      )}
    </div>
  );
}
