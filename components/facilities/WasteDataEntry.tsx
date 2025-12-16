"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

interface WasteDataEntryProps {
  facilityId: string;
  organizationId: string;
  sessionId?: string;
  periodStart: string;
  periodEnd: string;
  isThirdParty?: boolean;
  onEntryAdded?: () => void;
}

const WASTE_CATEGORIES = [
  { value: "waste_general", label: "General Waste", description: "Non-hazardous, mixed waste" },
  { value: "waste_hazardous", label: "Hazardous Waste", description: "Regulated hazardous materials" },
  { value: "waste_recycling", label: "Recycling Stream", description: "Materials sent for recycling" },
];

const WASTE_TYPES = [
  { value: "food_waste", label: "Food Waste" },
  { value: "packaging_waste", label: "Packaging Waste" },
  { value: "process_waste", label: "Process / Industrial Waste" },
  { value: "hazardous", label: "Hazardous Materials" },
  { value: "construction", label: "Construction & Demolition" },
  { value: "electronic", label: "Electronic Waste (WEEE)" },
  { value: "other", label: "Other" },
];

const TREATMENT_METHODS = [
  { value: "landfill", label: "Landfill", description: "Sent to landfill disposal" },
  { value: "recycling", label: "Recycling", description: "Material recovery and recycling" },
  { value: "composting", label: "Composting", description: "Organic waste composting" },
  { value: "incineration_with_recovery", label: "Incineration (Energy Recovery)", description: "Waste-to-energy" },
  { value: "incineration_without_recovery", label: "Incineration (No Recovery)", description: "Destruction only" },
  { value: "anaerobic_digestion", label: "Anaerobic Digestion", description: "Biogas production" },
  { value: "reuse", label: "Reuse", description: "Direct reuse without processing" },
  { value: "other", label: "Other", description: "Other treatment method" },
];

const HAZARD_CLASSIFICATIONS = [
  { value: "non_hazardous", label: "Non-Hazardous" },
  { value: "hazardous", label: "Hazardous" },
  { value: "unknown", label: "Unknown / Not Classified" },
];

const DISPOSAL_FACILITY_TYPES = [
  { value: "in_house", label: "In-House Treatment" },
  { value: "third_party_licensed", label: "Third-Party Licensed Facility" },
  { value: "unspecified", label: "Unspecified" },
];

const DATA_PROVENANCES = [
  { value: "primary_supplier_verified", label: "Supplier Verified", confidence: 95, color: "bg-green-500" },
  { value: "primary_measured_onsite", label: "Measured On-site", confidence: 90, color: "bg-green-400" },
  { value: "secondary_calculated_allocation", label: "Allocated from Facility Total", confidence: 70, color: "bg-amber-500" },
  { value: "secondary_modelled_industry_average", label: "Industry Average (Fallback)", confidence: 50, color: "bg-red-400" },
];

export function WasteDataEntry({
  facilityId,
  organizationId,
  sessionId,
  periodStart,
  periodEnd,
  isThirdParty = false,
  onEntryAdded,
}: WasteDataEntryProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    activity_category: "",
    quantity: "",
    unit: "kg",
    waste_category: "",
    waste_treatment_method: "",
    waste_recovery_percentage: "",
    hazard_classification: "non_hazardous",
    disposal_facility_type: "unspecified",
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
            waste_category: formData.waste_category || undefined,
            waste_treatment_method: formData.waste_treatment_method || undefined,
            waste_recovery_percentage: formData.waste_recovery_percentage ? parseFloat(formData.waste_recovery_percentage) : undefined,
            hazard_classification: formData.hazard_classification || undefined,
            disposal_facility_type: formData.disposal_facility_type || undefined,
            notes: formData.notes || undefined,
            reporting_session_id: sessionId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add waste entry");
      }

      toast.success("Waste data entry added successfully");
      setFormData({
        activity_category: "",
        quantity: "",
        unit: "kg",
        waste_category: "",
        waste_treatment_method: "",
        waste_recovery_percentage: "",
        hazard_classification: "non_hazardous",
        disposal_facility_type: "unspecified",
        data_provenance: isThirdParty ? "secondary_modelled_industry_average" : "primary_measured_onsite",
        allocation_basis: "none",
        brand_volume_reported: "",
        total_facility_volume_reported: "",
        notes: "",
      });
      onEntryAdded?.();
    } catch (error: unknown) {
      console.error("Error adding waste entry:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add waste entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-orange-500" />
          <CardTitle>Waste Data Entry</CardTitle>
        </div>
        <CardDescription>
          Record waste generation, recycling, or disposal data for this facility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="activity_category">Waste Stream Type *</Label>
              <Select
                value={formData.activity_category}
                onValueChange={(value) => setFormData({ ...formData, activity_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select waste stream" />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_CATEGORIES.map((cat) => (
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
              <Label htmlFor="waste_category">Waste Category</Label>
              <Select
                value={formData.waste_category}
                onValueChange={(value) => setFormData({ ...formData, waste_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select waste category" />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
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
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="tonnes">tonnes</SelectItem>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="L">Litres</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="waste_treatment_method">Treatment / Disposal Method</Label>
              <Select
                value={formData.waste_treatment_method}
                onValueChange={(value) => setFormData({ ...formData, waste_treatment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select treatment method" />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex flex-col">
                        <span>{method.label}</span>
                        <span className="text-xs text-muted-foreground">{method.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.waste_treatment_method === "recycling" || formData.waste_treatment_method === "reuse") && (
              <div className="space-y-2">
                <Label htmlFor="waste_recovery_percentage">Recovery Rate (%)</Label>
                <Input
                  id="waste_recovery_percentage"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.waste_recovery_percentage}
                  onChange={(e) => setFormData({ ...formData, waste_recovery_percentage: e.target.value })}
                  placeholder="0.0"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="hazard_classification">Hazard Classification</Label>
              <Select
                value={formData.hazard_classification}
                onValueChange={(value) => setFormData({ ...formData, hazard_classification: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAZARD_CLASSIFICATIONS.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value}>{cls.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disposal_facility_type">Disposal Facility</Label>
              <Select
                value={formData.disposal_facility_type}
                onValueChange={(value) => setFormData({ ...formData, disposal_facility_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSAL_FACILITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  Formula: (Brand Volume / Total Facility Volume) × Total Facility Waste
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional context about this waste data entry..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Waste Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
