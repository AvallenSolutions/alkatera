"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Wine, Info, Calculator, Lock, Unlock, ChevronDown, ChevronRight } from "lucide-react";
import { calculateMaturationImpacts } from "@/lib/maturation-calculator";
import type { MaturationProfile } from "@/lib/types/maturation";
import {
  ANGEL_SHARE_DEFAULTS,
  BARREL_TYPE_LABELS,
  BARREL_VOLUME_DEFAULTS,
  CLIMATE_ZONE_LABELS,
  ENERGY_SOURCE_LABELS,
  getSpiritTypeDefaults,
  type BarrelType,
  type ClimateZone,
  type EnergySource,
} from "@/lib/types/maturation";
import { COUNTRIES } from "@/lib/countries";

export interface MaturationFormData {
  barrel_type: BarrelType;
  barrel_volume_litres: number;
  barrel_use_number: number;
  barrel_co2e_new: number | null;
  aging_duration_months: number;
  angel_share_percent_per_year: number;
  climate_zone: ClimateZone;
  fill_volume_litres: number;
  number_of_barrels: number;
  cask_fill_abv_percent: number | null;
  warehouse_energy_kwh_per_barrel_year: number;
  warehouse_energy_source: EnergySource;
  warehouse_country_code: string | null;
  allocation_method: 'cut_off' | 'avoided_burden';
  bottles_produced: number | null;
  notes: string | null;
}

interface MaturationProfileCardProps {
  profile: MaturationProfile | null;
  organizationId: string;
  productId: string;
  productCategory?: string | null;
  productAbvPercent?: number | null;
  productBottleSizeMl?: number | null;
  primaryFacilityCountryCode?: string | null;
  onSave: (profile: MaturationFormData) => void;
  onRemove: () => void;
  saving?: boolean;
}

const GENERIC_DEFAULT_FORM: MaturationFormData = {
  barrel_type: 'american_oak_200',
  barrel_volume_litres: 200,
  barrel_use_number: 1,
  barrel_co2e_new: null,
  aging_duration_months: 36,
  angel_share_percent_per_year: 2.0,
  climate_zone: 'temperate',
  fill_volume_litres: 200,
  number_of_barrels: 1,
  cask_fill_abv_percent: 63,
  warehouse_energy_kwh_per_barrel_year: 15,
  warehouse_energy_source: 'grid_electricity',
  warehouse_country_code: null,
  allocation_method: 'cut_off',
  bottles_produced: null,
  notes: null,
};

export function MaturationProfileCard({
  profile,
  organizationId,
  productId,
  productCategory,
  productAbvPercent,
  productBottleSizeMl,
  primaryFacilityCountryCode,
  onSave,
  onRemove,
  saving = false,
}: MaturationProfileCardProps) {
  // Seed form either from an existing profile or from category-driven defaults
  const buildInitialForm = (): MaturationFormData => {
    if (profile) {
      return {
        barrel_type: profile.barrel_type,
        barrel_volume_litres: profile.barrel_volume_litres,
        barrel_use_number: profile.barrel_use_number,
        barrel_co2e_new: profile.barrel_co2e_new,
        aging_duration_months: profile.aging_duration_months,
        angel_share_percent_per_year: profile.angel_share_percent_per_year,
        climate_zone: profile.climate_zone,
        fill_volume_litres: profile.fill_volume_litres,
        number_of_barrels: profile.number_of_barrels,
        cask_fill_abv_percent: profile.cask_fill_abv_percent ?? null,
        warehouse_energy_kwh_per_barrel_year: profile.warehouse_energy_kwh_per_barrel_year,
        warehouse_energy_source: profile.warehouse_energy_source,
        warehouse_country_code: profile.warehouse_country_code ?? null,
        allocation_method: profile.allocation_method,
        bottles_produced: profile.bottles_produced ?? null,
        notes: profile.notes,
      };
    }
    const d = getSpiritTypeDefaults(productCategory);
    const barrelVol = BARREL_VOLUME_DEFAULTS[d.barrel_type] ?? 200;
    return {
      ...GENERIC_DEFAULT_FORM,
      barrel_type: d.barrel_type,
      barrel_volume_litres: barrelVol,
      fill_volume_litres: barrelVol,
      barrel_use_number: d.barrel_use_number,
      aging_duration_months: d.aging_months,
      climate_zone: d.climate_zone,
      angel_share_percent_per_year: ANGEL_SHARE_DEFAULTS[d.climate_zone],
      cask_fill_abv_percent: d.cask_fill_abv_percent,
      warehouse_country_code: primaryFacilityCountryCode ?? null,
    };
  };

  const [form, setForm] = useState<MaturationFormData>(buildInitialForm);
  const [showForm, setShowForm] = useState(!!profile);
  const [angelShareLocked, setAngelShareLocked] = useState(false);

  // Advanced section auto-opens only when an existing profile relies on batch
  // fields (multiple barrels, partial fills, bottles_produced override, or
  // custom barrel CO2e). New profiles and simple 1-barrel existing ones keep it
  // hidden so the user never sees fields that do not affect per-bottle output.
  const initiallyAdvancedOpen = !!profile && (
    profile.number_of_barrels > 1 ||
    profile.bottles_produced != null ||
    profile.barrel_co2e_new != null ||
    profile.fill_volume_litres !== profile.barrel_volume_litres
  );
  const [advancedOpen, setAdvancedOpen] = useState(initiallyAdvancedOpen);

  // Re-seed defaults if the category arrives asynchronously (e.g. product load
  // finished after the card mounted) for a NEW profile only.
  const hasSeededRef = useRef(!!profile);
  useEffect(() => {
    if (profile || hasSeededRef.current) return;
    if (!productCategory && !primaryFacilityCountryCode) return;
    hasSeededRef.current = true;
    setForm(buildInitialForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCategory, primaryFacilityCountryCode]);

  const update = (updates: Partial<MaturationFormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  // Auto-set angel's share when climate zone changes, unless the user has
  // locked the field to pin their measured value.
  const handleClimateZoneChange = (zone: ClimateZone) => {
    setForm(prev => ({
      ...prev,
      climate_zone: zone,
      angel_share_percent_per_year: angelShareLocked
        ? prev.angel_share_percent_per_year
        : ANGEL_SHARE_DEFAULTS[zone],
    }));
  };

  // Auto-set barrel volume when barrel type changes
  const handleBarrelTypeChange = (type: BarrelType) => {
    const volume = BARREL_VOLUME_DEFAULTS[type] ?? form.barrel_volume_litres;
    update({
      barrel_type: type,
      barrel_volume_litres: volume,
      fill_volume_litres: volume,
    });
  };

  // Calculate preview impacts
  const impactPreview = useMemo(() => {
    if (!showForm || !form.fill_volume_litres || !form.number_of_barrels) return null;
    try {
      return calculateMaturationImpacts(
        {
          ...form,
          id: '',
          product_id: parseInt(productId),
          organization_id: organizationId,
          created_at: '',
          updated_at: '',
        } as MaturationProfile,
        {
          warehouseCountryCode: form.warehouse_country_code ?? primaryFacilityCountryCode ?? null,
          caskFillAbvPercent: form.cask_fill_abv_percent ?? undefined,
          bottleAbvPercent: productAbvPercent ?? undefined,
        }
      );
    } catch {
      return null;
    }
  }, [form, showForm, productId, organizationId, primaryFacilityCountryCode, productAbvPercent]);

  const handleSave = () => {
    if (!form.fill_volume_litres || form.fill_volume_litres <= 0) return;
    if (!form.number_of_barrels || form.number_of_barrels <= 0) return;
    if (!form.aging_duration_months || form.aging_duration_months <= 0) return;
    onSave(form);
  };

  if (!showForm) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25">
        <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
          <Wine className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">No maturation profile</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add barrel aging details if this product is matured in oak casks
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(buildInitialForm());
              setShowForm(true);
            }}
          >
            <Wine className="h-4 w-4 mr-1.5" />
            Add Maturation Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Preview derivations for the per-bottle copy
  const bottleSizeMl = productBottleSizeMl ?? 700;
  const bottleSizeLitres = bottleSizeMl / 1000;
  const caskAbv = form.cask_fill_abv_percent ?? 63;
  const bottleAbv = productAbvPercent ?? caskAbv;
  const retention = Math.pow(1 - form.angel_share_percent_per_year / 100, form.aging_duration_months / 12);
  const dilution = bottleAbv > 0 ? caskAbv / bottleAbv : 1;
  const bottlesPerBarrel =
    bottleSizeLitres > 0
      ? (form.barrel_volume_litres * retention * dilution) / bottleSizeLitres
      : 0;
  const batchTotalBottles = bottlesPerBarrel * form.number_of_barrels;
  const perBottleBarrel =
    impactPreview && batchTotalBottles > 0
      ? impactPreview.barrel_total_co2e / batchTotalBottles
      : 0;
  const perBottleWarehouse =
    impactPreview && batchTotalBottles > 0
      ? impactPreview.warehouse_co2e_total / batchTotalBottles
      : 0;
  const perBottleTotal = perBottleBarrel + perBottleWarehouse;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base">Maturation Profile</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {form.barrel_use_number === 1
                  ? 'New Barrel'
                  : `${form.barrel_use_number}${form.barrel_use_number === 2 ? 'nd' : 'rd+'} Fill`}
              </Badge>
              {!profile && productCategory && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Smart defaults from {productCategory}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setShowForm(false);
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barrel Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Barrel Type</Label>
              <Select
                value={form.barrel_type}
                onValueChange={(v) => handleBarrelTypeChange(v as BarrelType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BARREL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Barrel Use</Label>
              <Select
                value={String(form.barrel_use_number)}
                onValueChange={(v) => update({ barrel_use_number: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">New (1st Fill)</SelectItem>
                  <SelectItem value="2">2nd Fill</SelectItem>
                  <SelectItem value="3">3rd+ Fill (Refill)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Aging & climate */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Aging Duration (months)</Label>
              <Input
                type="number"
                min={1}
                value={form.aging_duration_months}
                onChange={(e) => update({ aging_duration_months: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Climate Zone</Label>
              <Select
                value={form.climate_zone}
                onValueChange={(v) => handleClimateZoneChange(v as ClimateZone)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIMATE_ZONE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Angel&apos;s Share (%/yr)
                <button
                  type="button"
                  onClick={() => setAngelShareLocked(prev => !prev)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={angelShareLocked ? 'Unlock to auto-update with climate zone' : 'Lock to keep this value when changing climate'}
                >
                  {angelShareLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </Label>
              <Input
                type="number"
                min={0}
                max={25}
                step={0.1}
                value={form.angel_share_percent_per_year}
                onChange={(e) => update({ angel_share_percent_per_year: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Cask strength (drives dilution math) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cask Fill ABV (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 63.5"
                value={form.cask_fill_abv_percent ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  update({ cask_fill_abv_percent: v ? parseFloat(v) || null : null });
                }}
              />
              <p className="text-[10px] text-muted-foreground">Strength at cask fill, before dilution at bottling.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Bottle ABV</Label>
              <div className="flex h-9 items-center px-3 rounded-md border border-input bg-muted/30 text-xs text-muted-foreground">
                {productAbvPercent != null
                  ? `${productAbvPercent}% (from product)`
                  : 'Not set on product'}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {productAbvPercent != null
                  ? `Dilution: ${(caskAbv / (productAbvPercent || caskAbv)).toFixed(2)}× water addition`
                  : 'Set alcohol_content_abv on the product for accurate bottle count.'}
              </p>
            </div>
          </div>

          {/* Warehouse */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Warehouse Country</Label>
              <Select
                value={form.warehouse_country_code ?? '__none__'}
                onValueChange={(v) => update({ warehouse_country_code: v === '__none__' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Not specified</span>
                  </SelectItem>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Energy (kWh/barrel/yr)</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.warehouse_energy_kwh_per_barrel_year}
                onChange={(e) => update({ warehouse_energy_kwh_per_barrel_year: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Energy Source</Label>
              <Select
                value={form.warehouse_energy_source}
                onValueChange={(v) => update({ warehouse_energy_source: v as EnergySource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENERGY_SOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Per-bottle preview */}
          {impactPreview && (
            <Alert className="bg-amber-50 border-amber-200">
              <Calculator className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800 space-y-1">
                <div>
                  Each barrel yields ~<strong>{Math.floor(bottlesPerBarrel)}</strong> bottles of {bottleSizeMl}ml at{' '}
                  {bottleAbv}% ABV
                  <span className="text-amber-700">
                    {' '}(after {((1 - retention) * 100).toFixed(1)}% angel&apos;s share
                    {dilution > 1.001 ? ` and ${dilution.toFixed(2)}× cask→bottle dilution` : ''})
                  </span>
                </div>
                <div>
                  Per-bottle impact:{' '}
                  <span className="font-mono">{perBottleBarrel.toFixed(3)}</span> kg barrel +{' '}
                  <span className="font-mono">{perBottleWarehouse.toFixed(3)}</span> kg warehouse ={' '}
                  <strong className="font-mono">{perBottleTotal.toFixed(3)} kg CO2e</strong>
                </div>
                <div className="text-amber-700">
                  Angel&apos;s share loss: {impactPreview.angel_share_voc_kg.toFixed(2)} kg NMVOC (photochemical ozone, not counted in climate total).
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Advanced: batch totals (cancel out of per-bottle math but useful for batch footprint) */}
          <div className="border rounded-md">
            <button
              type="button"
              onClick={() => setAdvancedOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {advancedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Advanced: batch totals
              </span>
              <span className="text-muted-foreground font-normal">
                {form.number_of_barrels > 1 || form.bottles_produced != null || form.barrel_co2e_new != null
                  ? 'customised'
                  : 'defaults'}
              </span>
            </button>

            {advancedOpen && (
              <div className="p-3 border-t space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  These fields describe the full batch. Per-bottle impact does not depend on batch size,
                  but total batch CO2e scales with number of barrels.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Barrel Volume (L)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.barrel_volume_litres}
                      onChange={(e) => update({
                        barrel_volume_litres: parseFloat(e.target.value) || 0,
                        fill_volume_litres: parseFloat(e.target.value) || 0,
                      })}
                      disabled={form.barrel_type !== 'custom'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Fill Volume (L)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={form.barrel_volume_litres}
                      value={form.fill_volume_litres}
                      onChange={(e) => update({ fill_volume_litres: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Number of Barrels</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.number_of_barrels}
                      onChange={(e) => update({ number_of_barrels: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Bottles Produced <span className="text-muted-foreground font-normal">(override)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Auto from volume"
                      value={form.bottles_produced ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        update({ bottles_produced: val ? parseInt(val) || null : null });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Custom Barrel CO2e <span className="text-muted-foreground font-normal">(kg/barrel, override)</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder={`Default: ${form.barrel_type === 'american_oak_200' ? 40 : form.barrel_type === 'french_oak_225' ? 55 : form.barrel_type === 'american_oak_500' ? 65 : 40}`}
                    value={form.barrel_co2e_new ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      update({ barrel_co2e_new: v ? parseFloat(v) || null : null });
                    }}
                  />
                </div>

                {impactPreview && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground pt-1 border-t">
                    <span>Batch barrel CO2e:</span>
                    <span className="font-mono text-right">{impactPreview.barrel_total_co2e.toFixed(1)} kg</span>
                    <span>Batch warehouse CO2e:</span>
                    <span className="font-mono text-right">{impactPreview.warehouse_co2e_total.toFixed(1)} kg</span>
                    <span>Batch bottled volume:</span>
                    <span className="font-mono text-right">{impactPreview.output_volume_bottled_litres.toFixed(1)} L</span>
                    <span>Batch total bottles:</span>
                    <span className="font-mono text-right">
                      {form.bottles_produced
                        ? `${form.bottles_produced} (override)`
                        : `~${Math.floor(batchTotalBottles)}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info note about methodology */}
          <Alert variant="default" className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              Cut-off allocation: new barrels carry full manufacturing burden; reused barrels carry near-zero.
              Angel&apos;s share is classified as a VOC contributing to photochemical ozone formation, not direct GHG.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !form.fill_volume_litres || !form.aging_duration_months}
              size="sm"
            >
              {saving ? "Saving..." : profile ? "Update Maturation" : "Save Maturation"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
