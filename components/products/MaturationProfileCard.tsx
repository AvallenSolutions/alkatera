"use client";

import { useState, useMemo } from "react";
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
import { Trash2, Wine, Info, Calculator } from "lucide-react";
import { calculateMaturationImpacts } from "@/lib/maturation-calculator";
import type { MaturationProfile } from "@/lib/types/maturation";
import {
  ANGEL_SHARE_DEFAULTS,
  BARREL_TYPE_LABELS,
  BARREL_VOLUME_DEFAULTS,
  CLIMATE_ZONE_LABELS,
  ENERGY_SOURCE_LABELS,
  type BarrelType,
  type ClimateZone,
  type EnergySource,
} from "@/lib/types/maturation";

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
  warehouse_energy_kwh_per_barrel_year: number;
  warehouse_energy_source: EnergySource;
  allocation_method: 'cut_off' | 'avoided_burden';
  notes: string | null;
}

interface MaturationProfileCardProps {
  profile: MaturationProfile | null;
  organizationId: string;
  productId: string;
  onSave: (profile: MaturationFormData) => void;
  onRemove: () => void;
  saving?: boolean;
}

const DEFAULT_FORM: MaturationFormData = {
  barrel_type: 'american_oak_200',
  barrel_volume_litres: 200,
  barrel_use_number: 1,
  barrel_co2e_new: null,
  aging_duration_months: 36,
  angel_share_percent_per_year: 2.0,
  climate_zone: 'temperate',
  fill_volume_litres: 200,
  number_of_barrels: 1,
  warehouse_energy_kwh_per_barrel_year: 15,
  warehouse_energy_source: 'grid_electricity',
  allocation_method: 'cut_off',
  notes: null,
};

export function MaturationProfileCard({
  profile,
  organizationId,
  productId,
  onSave,
  onRemove,
  saving = false,
}: MaturationProfileCardProps) {
  const [form, setForm] = useState<MaturationFormData>(() => {
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
        warehouse_energy_kwh_per_barrel_year: profile.warehouse_energy_kwh_per_barrel_year,
        warehouse_energy_source: profile.warehouse_energy_source,
        allocation_method: profile.allocation_method,
        notes: profile.notes,
      };
    }
    return DEFAULT_FORM;
  });

  const [showForm, setShowForm] = useState(!!profile);

  const update = (updates: Partial<MaturationFormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  // Auto-set angel's share when climate zone changes
  const handleClimateZoneChange = (zone: ClimateZone) => {
    update({
      climate_zone: zone,
      angel_share_percent_per_year: ANGEL_SHARE_DEFAULTS[zone],
    });
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
      return calculateMaturationImpacts({
        ...form,
        id: '',
        product_id: parseInt(productId),
        organization_id: organizationId,
        created_at: '',
        updated_at: '',
      } as MaturationProfile);
    } catch {
      return null;
    }
  }, [form, showForm, productId, organizationId]);

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
            onClick={() => setShowForm(true)}
          >
            <Wine className="h-4 w-4 mr-1.5" />
            Add Maturation Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base">Maturation Profile</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {form.barrel_use_number === 1 ? 'New Barrel' : `${form.barrel_use_number}${form.barrel_use_number === 2 ? 'nd' : 'rd+'} Fill`}
              </Badge>
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

          {/* Barrel Volume & Fill */}
          <div className="grid grid-cols-3 gap-4">
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
          </div>

          {/* Aging Parameters */}
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
              <Label className="text-xs font-medium">Angel&apos;s Share (%/yr)</Label>
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

          {/* Warehouse Energy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Warehouse Energy (kWh/barrel/yr)</Label>
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

          {/* Impact Preview */}
          {impactPreview && (
            <Alert className="bg-amber-50 border-amber-200">
              <Calculator className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs space-y-1">
                <div className="font-medium text-amber-800 mb-1">Estimated Maturation Impact</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-amber-700">
                  <span>Barrel CO2e:</span>
                  <span className="font-mono">{impactPreview.barrel_total_co2e.toFixed(2)} kg</span>
                  <span>Warehouse CO2e:</span>
                  <span className="font-mono">{impactPreview.warehouse_co2e_total.toFixed(2)} kg</span>
                  <span>Total Climate:</span>
                  <span className="font-mono font-medium">{impactPreview.total_maturation_co2e.toFixed(2)} kg CO2e</span>
                  <span>Angel&apos;s Share Loss:</span>
                  <span className="font-mono">{impactPreview.angel_share_loss_percent_total.toFixed(1)}% ({impactPreview.angel_share_volume_loss_litres.toFixed(1)} L)</span>
                  <span>Output Volume:</span>
                  <span className="font-mono">{impactPreview.output_volume_litres.toFixed(1)} L</span>
                  <span>VOC Emissions:</span>
                  <span className="font-mono">{impactPreview.angel_share_voc_kg.toFixed(2)} kg NMVOC</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Info note about methodology */}
          <Alert variant="default" className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              Cut-off allocation: new barrels carry full manufacturing burden; reused barrels carry near-zero.
              Angel&apos;s share (ethanol evaporation) is classified as a VOC emission contributing to photochemical ozone formation, not direct GHG.
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
