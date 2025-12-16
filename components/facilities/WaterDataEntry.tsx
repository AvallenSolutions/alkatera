"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Droplets, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface WaterDataEntryProps {
  facilityId: string;
  organizationId: string;
  sessionId?: string;
  periodStart: string;
  periodEnd: string;
  isThirdParty?: boolean;
  onEntryAdded?: () => void;
}

const WATER_CATEGORIES = [
  { value: "water_intake", label: "Water Intake", description: "Fresh water consumed" },
  { value: "water_discharge", label: "Wastewater Discharge", description: "Treated/untreated discharge" },
  { value: "water_recycled", label: "Recycled Water", description: "Water reused on-site" },
];

const WATER_SOURCES = [
  { value: "municipal", label: "Municipal Supply" },
  { value: "groundwater", label: "Groundwater / Borehole" },
  { value: "surface_water", label: "Surface Water (River/Lake)" },
  { value: "recycled", label: "Recycled / Reclaimed" },
  { value: "rainwater", label: "Rainwater Harvesting" },
  { value: "other", label: "Other Source" },
];

const WATER_CLASSIFICATIONS = [
  { value: "blue", label: "Blue Water", description: "Freshwater from surface or groundwater" },
  { value: "green", label: "Green Water", description: "Rainwater stored in soil" },
  { value: "grey", label: "Grey Water", description: "Wastewater from processes" },
];

const TREATMENT_METHODS = [
  { value: "primary_treatment", label: "Primary Treatment" },
  { value: "secondary_treatment", label: "Secondary Treatment" },
  { value: "tertiary_treatment", label: "Tertiary Treatment" },
  { value: "none", label: "No Treatment" },
  { value: "unknown", label: "Unknown" },
];

const DATA_PROVENANCES = [
  { value: "primary_supplier_verified", label: "Supplier Verified", confidence: 95, color: "bg-green-500" },
  { value: "primary_measured_onsite", label: "Measured On-site", confidence: 90, color: "bg-green-400" },
  { value: "secondary_calculated_allocation", label: "Allocated from Facility Total", confidence: 70, color: "bg-amber-500" },
  { value: "secondary_modelled_industry_average", label: "Industry Average (Fallback)", confidence: 50, color: "bg-red-400" },
];

export function WaterDataEntry({
  facilityId,
  organizationId,
  sessionId,
  periodStart,
  periodEnd,
  isThirdParty = false,
  onEntryAdded,
}: WaterDataEntryProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    activity_category: "",
    quantity: "",
    unit: "m³",
    water_source_type: "",
    water_classification: "",
    wastewater_treatment_method: "",
    water_recycling_rate_percent: "",
    water_stress_area_flag: false,
    data_provenance: isThirdParty ? "secondary_modelled_industry_average" : "primary_measured_onsite",
    allocation_basis: "none",
    brand_volume_reported: "",
    total_facility_volume_reported: "",
    notes: "",
  });

  const selectedProvenance = DATA_PROVENANCES.find(p => p.value === formData.data_provenance);
  const showAllocationFields = isThirdParty && formData.allocation_basis !== "none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.activity_category || !formData.quantity) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            facility_id: facilityId,
            organization_id: organizationId,
            activity_category: formData.activity_category,
            activity_date: periodStart,
            reporting_period_start: periodStart,
            reporting_period_end: periodEnd,
            quantity: parseFloat(formData.quantity),
            unit: formData.unit,
            data_provenance: formData.data_provenance,
            allocation_basis: formData.allocation_basis,
            brand_volume_reported: formData.brand_volume_reported ? parseFloat(formData.brand_volume_reported) : undefined,
            total_facility_volume_reported: formData.total_facility_volume_reported ? parseFloat(formData.total_facility_volume_reported) : undefined,
            water_source_type: formData.water_source_type || undefined,
            water_classification: formData.water_classification || undefined,
            wastewater_treatment_method: formData.wastewater_treatment_method || undefined,
            water_recycling_rate_percent: formData.water_recycling_rate_percent ? parseFloat(formData.water_recycling_rate_percent) : undefined,
            water_stress_area_flag: formData.water_stress_area_flag,
            notes: formData.notes || undefined,
            reporting_session_id: sessionId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add water entry");
      }

      toast.success("Water data entry added successfully");
      setFormData({
        activity_category: "",
        quantity: "",
        unit: "m³",
        water_source_type: "",
        water_classification: "",
        wastewater_treatment_method: "",
        water_recycling_rate_percent: "",
        water_stress_area_flag: false,
        data_provenance: isThirdParty ? "secondary_modelled_industry_average" : "primary_measured_onsite",
        allocation_basis: "none",
        brand_volume_reported: "",
        total_facility_volume_reported: "",
        notes: "",
      });
      onEntryAdded?.();
    } catch (error: unknown) {
      console.error("Error adding water entry:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add water entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          <CardTitle>Water Data Entry</CardTitle>
        </div>
        <CardDescription>
          Record water intake, discharge, or recycling data for this facility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity_category">Water Activity Type *</Label>
              <Select
                value={formData.activity_category}
                onValueChange={(value) => setFormData({ ...formData, activity_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select water activity" />
                </SelectTrigger>
                <SelectContent>
                  {WATER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex flex-col">
                        <span>{cat.label}</span>
                        <span className="text-xs text-muted-foreground">{cat.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="water_source_type">Water Source</Label>
              <Select
                value={formData.water_source_type}
                onValueChange={(value) => setFormData({ ...formData, water_source_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select water source" />
                </SelectTrigger>
                <SelectContent>
                  {WATER_SOURCES.map((src) => (
                    <SelectItem key={src.value} value={src.value}>{src.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <div className="flex gap-2">
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="L">Litres</SelectItem>
                    <SelectItem value="ML">Megalitres</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="water_classification">Water Classification (ISO 14046)</Label>
              <Select
                value={formData.water_classification}
                onValueChange={(value) => setFormData({ ...formData, water_classification: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  {WATER_CLASSIFICATIONS.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value}>
                      <div className="flex flex-col">
                        <span>{cls.label}</span>
                        <span className="text-xs text-muted-foreground">{cls.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.activity_category === "water_discharge" && (
              <div className="space-y-2">
                <Label htmlFor="wastewater_treatment_method">Treatment Method</Label>
                <Select
                  value={formData.wastewater_treatment_method}
                  onValueChange={(value) => setFormData({ ...formData, wastewater_treatment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select treatment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {TREATMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.activity_category === "water_recycled" && (
              <div className="space-y-2">
                <Label htmlFor="water_recycling_rate_percent">Recycling Rate (%)</Label>
                <Input
                  id="water_recycling_rate_percent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.water_recycling_rate_percent}
                  onChange={(e) => setFormData({ ...formData, water_recycling_rate_percent: e.target.value })}
                  placeholder="0.0"
                />
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Data Provenance (Glass Box)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_provenance">Data Source *</Label>
                <Select
                  value={formData.data_provenance}
                  onValueChange={(value) => setFormData({ ...formData, data_provenance: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_PROVENANCES.map((prov) => (
                      <SelectItem key={prov.value} value={prov.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${prov.color}`} />
                          <span>{prov.label}</span>
                          <span className="text-xs text-muted-foreground">({prov.confidence}%)</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProvenance && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${selectedProvenance.color}`} />
                    <span className="text-sm">Confidence Score: {selectedProvenance.confidence}%</span>
                  </div>
                )}
              </div>

              {isThirdParty && (
                <div className="space-y-2">
                  <Label htmlFor="allocation_basis">Allocation Method</Label>
                  <Select
                    value={formData.allocation_basis}
                    onValueChange={(value) => setFormData({ ...formData, allocation_basis: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Allocation (Direct Entry)</SelectItem>
                      <SelectItem value="physical_mass">Physical Allocation (Mass)</SelectItem>
                      <SelectItem value="volume_proportion">Volume Proportion</SelectItem>
                      <SelectItem value="production_volume_ratio">Production Volume Ratio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {showAllocationFields && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">Physical Allocation</span>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-500 mb-3">
                  Formula: (Brand Volume / Total Facility Volume) × Total Facility Water Usage
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your Brand Volume</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.brand_volume_reported}
                      onChange={(e) => setFormData({ ...formData, brand_volume_reported: e.target.value })}
                      placeholder="e.g., 5000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Facility Volume</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.total_facility_volume_reported}
                      onChange={(e) => setFormData({ ...formData, total_facility_volume_reported: e.target.value })}
                      placeholder="e.g., 50000"
                    />
                  </div>
                </div>
                {formData.brand_volume_reported && formData.total_facility_volume_reported && (
                  <div className="mt-3 text-sm">
                    <strong>Allocation: </strong>
                    {((parseFloat(formData.brand_volume_reported) / parseFloat(formData.total_facility_volume_reported)) * 100).toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.water_stress_area_flag}
              onCheckedChange={(checked) => setFormData({ ...formData, water_stress_area_flag: checked })}
            />
            <Label>Facility is in a water-stressed region (WRI Aqueduct)</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional context about this water data entry..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Water Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
