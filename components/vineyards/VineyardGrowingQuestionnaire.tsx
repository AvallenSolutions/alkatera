'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Leaf,
  Droplets,
  Fuel,
  Sprout,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateViticultureImpacts } from '@/lib/viticulture-calculator';
import type {
  VineyardGrowingProfile,
  SoilManagement,
  FertiliserType,
  PesticideType,
  IrrigationEnergySource,
  ViticultureCalculatorInput,
  VineyardClimateZone,
  VineyardCertification,
} from '@/lib/types/viticulture';

interface QuestionnaireProps {
  vineyardId: string;
  vineyardName: string;
  vineyardHectares: number;
  vineyardClimateZone: VineyardClimateZone;
  vineyardCertification: VineyardCertification;
  vineyardCountryCode: string | null;
  existingProfile?: VineyardGrowingProfile | null;
  vintageYear?: number;
  copyFromData?: Record<string, any>;
  onComplete: (profile: VineyardGrowingProfile) => void;
  onCancel: () => void;
}

const PESTICIDE_TYPES: { value: PesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic / mixed products' },
  { value: 'copper_fungicide', label: 'Copper-based fungicide (e.g. Bordeaux mixture)' },
  { value: 'sulfur', label: 'Sulphur-based' },
  { value: 'synthetic_fungicide', label: 'Synthetic fungicide' },
];

const HERBICIDE_TYPES: { value: PesticideType; label: string }[] = [
  { value: 'generic', label: 'Generic herbicide' },
  { value: 'herbicide_glyphosate', label: 'Glyphosate-based' },
];

const STEPS = [
  { id: 'soil', label: 'Soil & Land', icon: Sprout },
  { id: 'inputs', label: 'Inputs', icon: Leaf },
  { id: 'machinery', label: 'Machinery & Fuel', icon: Fuel },
  { id: 'irrigation', label: 'Irrigation', icon: Droplets },
] as const;

const SOIL_PRACTICES: { value: SoilManagement; label: string; description: string }[] = [
  { value: 'conventional_tillage', label: 'Conventional tillage', description: 'Regular ploughing and mechanical soil disturbance' },
  { value: 'minimum_tillage', label: 'Minimum tillage', description: 'Reduced soil disturbance, shallow cultivation only' },
  { value: 'no_till', label: 'No-till', description: 'No mechanical soil disturbance, direct seeding' },
  { value: 'cover_cropping', label: 'Cover cropping (active)', description: 'Living ground cover between vine rows year-round' },
  { value: 'composting', label: 'Composting (active)', description: 'Regular compost application to vineyard soils' },
  { value: 'biochar_compost', label: 'Biochar + compost', description: 'Biochar-amended compost for enhanced carbon storage' },
  { value: 'regenerative_integrated', label: 'Regenerative integrated', description: 'Holistic approach combining cover crops, no-till, and organic inputs' },
];

const FERTILISER_TYPES: { value: FertiliserType; label: string }[] = [
  { value: 'none', label: 'None (no fertiliser applied)' },
  { value: 'synthetic_n', label: 'Synthetic nitrogen (e.g. ammonium nitrate)' },
  { value: 'organic_manure', label: 'Organic (manure)' },
  { value: 'organic_compost', label: 'Organic (compost)' },
  { value: 'mixed', label: 'Mixed (synthetic + organic)' },
];

export function VineyardGrowingQuestionnaire({
  vineyardId,
  vineyardName,
  vineyardHectares,
  vineyardClimateZone,
  vineyardCertification,
  vineyardCountryCode,
  existingProfile,
  vintageYear,
  copyFromData,
  onComplete,
  onCancel,
}: QuestionnaireProps) {
  const currentYear = new Date().getFullYear();
  const [selectedVintageYear, setSelectedVintageYear] = useState<number>(
    existingProfile?.vintage_year ?? vintageYear ?? currentYear
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Determine initial values: existingProfile > copyFromData > defaults
  const initSource = existingProfile ?? copyFromData;

  // Form state
  const [form, setForm] = useState({
    area_ha: initSource?.area_ha ?? vineyardHectares,
    soil_management: (initSource?.soil_management ?? 'conventional_tillage') as SoilManagement,
    pruning_residue_returned: initSource?.pruning_residue_returned ?? true,
    fertiliser_type: (initSource?.fertiliser_type ?? 'none') as FertiliserType,
    fertiliser_quantity_kg: initSource?.fertiliser_quantity_kg ?? 0,
    fertiliser_n_content_percent: initSource?.fertiliser_n_content_percent ?? 0,
    uses_pesticides: initSource?.uses_pesticides ?? false,
    pesticide_applications_per_year: initSource?.pesticide_applications_per_year ?? 0,
    pesticide_type: (initSource?.pesticide_type ?? 'generic') as PesticideType,
    uses_herbicides: initSource?.uses_herbicides ?? false,
    herbicide_applications_per_year: initSource?.herbicide_applications_per_year ?? 0,
    herbicide_type: (initSource?.herbicide_type ?? 'generic') as PesticideType,
    diesel_litres_per_year: initSource?.diesel_litres_per_year ?? 0,
    petrol_litres_per_year: initSource?.petrol_litres_per_year ?? 0,
    is_irrigated: initSource?.is_irrigated ?? false,
    water_m3_per_ha: initSource?.water_m3_per_ha ?? 0,
    irrigation_energy_source: (initSource?.irrigation_energy_source ?? 'none') as IrrigationEnergySource,
    grape_yield_tonnes: initSource?.grape_yield_tonnes ?? 0,
  });

  // Build vintage year options (current year down to current-10)
  const vintageYearOptions = Array.from({ length: 11 }, (_, i) => currentYear - i);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  function updateForm(updates: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave() {
    if (form.grape_yield_tonnes <= 0) {
      toast.error('Please enter the annual grape yield (tonnes)');
      return;
    }

    setSaving(true);
    try {
      const url = `/api/vineyards/${vineyardId}/growing-profile`;
      const method = existingProfile ? 'PATCH' : 'POST';

      const body = {
        ...(existingProfile ? { id: existingProfile.id } : {}),
        vintage_year: selectedVintageYear,
        area_ha: form.area_ha,
        soil_management: form.soil_management,
        pruning_residue_returned: form.pruning_residue_returned,
        fertiliser_type: form.fertiliser_type,
        fertiliser_quantity_kg: form.fertiliser_quantity_kg,
        fertiliser_n_content_percent: form.fertiliser_n_content_percent,
        uses_pesticides: form.uses_pesticides,
        pesticide_applications_per_year: form.pesticide_applications_per_year,
        pesticide_type: form.pesticide_type,
        uses_herbicides: form.uses_herbicides,
        herbicide_applications_per_year: form.herbicide_applications_per_year,
        herbicide_type: form.herbicide_type,
        diesel_litres_per_year: form.diesel_litres_per_year,
        petrol_litres_per_year: form.petrol_litres_per_year,
        is_irrigated: form.is_irrigated,
        water_m3_per_ha: form.water_m3_per_ha,
        irrigation_energy_source: form.irrigation_energy_source,
        grape_yield_tonnes: form.grape_yield_tonnes,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save growing profile');
      }

      const { data } = await res.json();
      toast.success('Growing profile saved');
      onComplete(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Preview calculation
  const previewResult = calculateViticultureImpacts({
    climate_zone: vineyardClimateZone,
    certification: vineyardCertification,
    location_country_code: vineyardCountryCode,
    area_ha: form.area_ha,
    soil_management: form.soil_management,
    pruning_residue_returned: form.pruning_residue_returned,
    fertiliser_type: form.fertiliser_type,
    fertiliser_quantity_kg: form.fertiliser_quantity_kg,
    fertiliser_n_content_percent: form.fertiliser_n_content_percent,
    uses_pesticides: form.uses_pesticides,
    pesticide_applications_per_year: form.pesticide_applications_per_year,
    pesticide_type: form.pesticide_type,
    uses_herbicides: form.uses_herbicides,
    herbicide_applications_per_year: form.herbicide_applications_per_year,
    herbicide_type: form.herbicide_type,
    diesel_litres_per_year: form.diesel_litres_per_year,
    petrol_litres_per_year: form.petrol_litres_per_year,
    is_irrigated: form.is_irrigated,
    water_m3_per_ha: form.water_m3_per_ha,
    irrigation_energy_source: form.irrigation_energy_source,
    grape_yield_tonnes: form.grape_yield_tonnes,
    soil_carbon_override_kg_co2e_per_ha: null,
  });

  return (
    <div className="space-y-4">
      {/* Vintage Year Selector */}
      <div className="flex items-center gap-3">
        <Label htmlFor="vintage-year" className="text-sm font-medium whitespace-nowrap">Vintage Year</Label>
        <Select
          value={String(selectedVintageYear)}
          onValueChange={(v) => setSelectedVintageYear(parseInt(v))}
        >
          <SelectTrigger id="vintage-year" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vintageYearOptions.map((yr) => (
              <SelectItem key={yr} value={String(yr)}>
                {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Grape growing questionnaire for <span className="text-foreground font-medium">{vineyardName}</span>
          </span>
          <span className="text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex gap-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  i === currentStep
                    ? 'bg-[#ccff00]/20 text-[#ccff00]'
                    : i < currentStep
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {i < currentStep ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Soil & Land */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Soil & Land Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  How you manage your vineyard soils affects carbon sequestration and N2O emissions.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="area">Area for this product (ha)</Label>
                    <Input
                      id="area"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.area_ha || ''}
                      onChange={(e) => updateForm({ area_ha: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Vineyard total: {vineyardHectares} ha. Enter the area used for this product.
                    </p>
                    {form.area_ha > vineyardHectares && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ Area exceeds vineyard total ({vineyardHectares} ha)
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="yield">Annual grape yield (tonnes) *</Label>
                    <Input
                      id="yield"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={form.grape_yield_tonnes || ''}
                      onChange={(e) => updateForm({ grape_yield_tonnes: parseFloat(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Total harvest from this area. UK average: 5-8 t/ha, warm climate: 8-15 t/ha.
                    </p>
                    {form.grape_yield_tonnes > 0 && form.area_ha > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Calculated yield: {(form.grape_yield_tonnes / form.area_ha).toFixed(1)} t/ha
                        </p>
                        {form.grape_yield_tonnes / form.area_ha > 25 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Yield above 25 t/ha is unusually high. Please check your figures.
                          </p>
                        )}
                        {form.grape_yield_tonnes / form.area_ha < 1 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Yield below 1 t/ha is very low. Is this a newly planted vineyard?
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Soil management practice</Label>
                  <div className="grid gap-2">
                    {SOIL_PRACTICES.map((practice) => (
                      <button
                        key={practice.value}
                        onClick={() => updateForm({ soil_management: practice.value })}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                          form.soil_management === practice.value
                            ? 'border-[#ccff00] bg-[#ccff00]/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          form.soil_management === practice.value
                            ? 'border-[#ccff00]'
                            : 'border-muted-foreground/30'
                        }`}>
                          {form.soil_management === practice.value && (
                            <div className="h-2 w-2 rounded-full bg-[#ccff00]" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{practice.label}</div>
                          <div className="text-xs text-muted-foreground">{practice.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Vine prunings returned to soil</Label>
                    <p className="text-xs text-muted-foreground">
                      Pruning residues left on or incorporated into the soil between rows
                    </p>
                  </div>
                  <Switch
                    checked={form.pruning_residue_returned}
                    onCheckedChange={(v) => updateForm({ pruning_residue_returned: v })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Inputs */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Fertiliser & Crop Protection</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Synthetic nitrogen fertiliser is typically the largest single emission source in viticulture.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Fertiliser type</Label>
                  <Select
                    value={form.fertiliser_type}
                    onValueChange={(v) => updateForm({ fertiliser_type: v as FertiliserType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FERTILISER_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.fertiliser_type !== 'none' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="fert-qty">
                        Total quantity applied (kg/year)
                      </Label>
                      <Input
                        id="fert-qty"
                        type="number"
                        min="0"
                        value={form.fertiliser_quantity_kg || ''}
                        onChange={(e) =>
                          updateForm({ fertiliser_quantity_kg: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 200"
                      />
                      {form.fertiliser_quantity_kg > 0 && form.area_ha > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {(form.fertiliser_quantity_kg / form.area_ha).toFixed(0)} kg/ha
                          {form.fertiliser_type === 'synthetic_n' && form.fertiliser_quantity_kg / form.area_ha > 200 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                              ⚠ High for vineyards (typical: 30-80 kg N/ha)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="n-content" className="flex items-center gap-1">
                              Nitrogen content (%)
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs text-xs">
                              Ammonium nitrate: 34.5%. Urea: 46%. Manure: 0.5-1%. Compost: 1-2%.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Input
                        id="n-content"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.fertiliser_n_content_percent || ''}
                        onChange={(e) =>
                          updateForm({ fertiliser_n_content_percent: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 34.5"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Pesticides (fungicides, insecticides)</Label>
                      <p className="text-xs text-muted-foreground">
                        Includes copper and sulphur treatments for organic vineyards
                      </p>
                    </div>
                    <Switch
                      checked={form.uses_pesticides}
                      onCheckedChange={(v) => updateForm({ uses_pesticides: v })}
                    />
                  </div>
                  {form.uses_pesticides && (
                    <div className="grid gap-3 pl-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pest-apps">Applications per year</Label>
                        <Input
                          id="pest-apps"
                          type="number"
                          min="0"
                          max="30"
                          value={form.pesticide_applications_per_year || ''}
                          onChange={(e) =>
                            updateForm({ pesticide_applications_per_year: parseInt(e.target.value) || 0 })
                          }
                          placeholder="e.g. 6"
                          className="w-32"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Pesticide type</Label>
                        <Select
                          value={form.pesticide_type}
                          onValueChange={(v) => updateForm({ pesticide_type: v as PesticideType })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PESTICIDE_TYPES.map((pt) => (
                              <SelectItem key={pt.value} value={pt.value}>
                                {pt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Herbicides</Label>
                      <p className="text-xs text-muted-foreground">
                        Chemical weed control (not applicable for organic)
                      </p>
                    </div>
                    <Switch
                      checked={form.uses_herbicides}
                      onCheckedChange={(v) => updateForm({ uses_herbicides: v })}
                    />
                  </div>
                  {form.uses_herbicides && (
                    <div className="grid gap-3 pl-4">
                      <div className="grid gap-2">
                        <Label htmlFor="herb-apps">Applications per year</Label>
                        <Input
                          id="herb-apps"
                          type="number"
                          min="0"
                          max="10"
                          value={form.herbicide_applications_per_year || ''}
                          onChange={(e) =>
                            updateForm({ herbicide_applications_per_year: parseInt(e.target.value) || 0 })
                          }
                          placeholder="e.g. 2"
                          className="w-32"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Herbicide type</Label>
                        <Select
                          value={form.herbicide_type}
                          onValueChange={(v) => updateForm({ herbicide_type: v as PesticideType })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HERBICIDE_TYPES.map((ht) => (
                              <SelectItem key={ht.value} value={ht.value}>
                                {ht.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Machinery & Fuel */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Machinery & Fuel</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Diesel consumption for tractors, sprayers, and harvesting equipment.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="diesel">Diesel consumption (litres/year)</Label>
                    <Input
                      id="diesel"
                      type="number"
                      min="0"
                      value={form.diesel_litres_per_year || ''}
                      onChange={(e) =>
                        updateForm({ diesel_litres_per_year: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="e.g. 500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total diesel for all vineyard operations. Sector average: 80-150 L/ha/yr.
                    </p>
                    {form.diesel_litres_per_year > 0 && form.area_ha > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(form.diesel_litres_per_year / form.area_ha).toFixed(0)} L/ha
                        {form.diesel_litres_per_year / form.area_ha > 300 && (
                          <span className="text-amber-600 dark:text-amber-400 ml-1">
                            ⚠ Above 300 L/ha is unusually high
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="petrol">Petrol consumption (litres/year)</Label>
                    <Input
                      id="petrol"
                      type="number"
                      min="0"
                      value={form.petrol_litres_per_year || ''}
                      onChange={(e) =>
                        updateForm({ petrol_litres_per_year: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="e.g. 50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Strimmers, chainsaws, ATVs, etc. Typical: 10-30 L/ha/yr.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Irrigation */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Irrigation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Water use and pumping energy for irrigation. Most UK vineyards are rainfed.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Vineyard is irrigated</Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle off if your vineyard is entirely rainfed
                    </p>
                  </div>
                  <Switch
                    checked={form.is_irrigated}
                    onCheckedChange={(v) => updateForm({ is_irrigated: v })}
                  />
                </div>

                {form.is_irrigated && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="water">Water applied (m3/ha/year)</Label>
                      <Input
                        id="water"
                        type="number"
                        min="0"
                        value={form.water_m3_per_ha || ''}
                        onChange={(e) =>
                          updateForm({ water_m3_per_ha: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="e.g. 200"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Pumping energy source</Label>
                      <Select
                        value={form.irrigation_energy_source}
                        onValueChange={(v) =>
                          updateForm({ irrigation_energy_source: v as IrrigationEnergySource })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid_electricity">Grid electricity</SelectItem>
                          <SelectItem value="diesel_pump">Diesel pump</SelectItem>
                          <SelectItem value="solar_pump">Solar pump</SelectItem>
                          <SelectItem value="gravity_fed">Gravity fed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Impact Preview */}
              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-3">Impact Preview</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Total emissions</div>
                    <div className="text-lg font-bold text-foreground">
                      {previewResult.total_emissions.toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">kg CO2e/year</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {previewResult.total_emissions_per_kg.toFixed(3)} kg CO2e per kg grapes
                    </div>
                  </div>
                  {previewResult.total_removals > 0 && (
                    <div className="rounded-lg border border-green-800/30 bg-green-950/20 p-3">
                      <div className="text-xs text-green-400/70 flex items-center gap-1">
                        Soil carbon removals
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                Under SBTi FLAG guidance, carbon removals from soil management
                                are reported separately from emissions and cannot be netted
                                against your total footprint.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        {previewResult.total_removals.toFixed(1)}
                        <span className="text-xs font-normal text-green-400/70 ml-1">kg CO2e removed/year</span>
                      </div>
                      <div className="text-xs text-green-400/50 mt-1">
                        {previewResult.flag_removals.methodology === 'practice_based_default'
                          ? 'Practice-based estimate'
                          : 'Verified measurement'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Fertiliser & N2O</div>
                    <div className="text-sm font-medium">
                      {(previewResult.flag_emissions.total_flag_co2e + previewResult.non_flag_emissions.fertiliser_production_co2e).toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Fuel</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.machinery_fuel_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Pesticides</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.pesticide_production_co2e.toFixed(0)} kg
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-muted/30">
                    <div className="text-xs text-muted-foreground">Irrigation</div>
                    <div className="text-sm font-medium">
                      {previewResult.non_flag_emissions.irrigation_energy_co2e.toFixed(0)} kg
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 0) onCancel();
            else setCurrentStep(currentStep - 1);
          }}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving || form.grape_yield_tonnes <= 0}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save Growing Profile
          </Button>
        )}
      </div>
    </div>
  );
}
