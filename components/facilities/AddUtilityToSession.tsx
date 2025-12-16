"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const UTILITY_TYPES = [
  { value: "electricity_grid", label: "Purchased Electricity", defaultUnit: "kWh" },
  { value: "heat_steam_purchased", label: "Purchased Heat / Steam", defaultUnit: "kWh" },
  { value: "natural_gas", label: "Natural Gas", defaultUnit: "m³" },
  { value: "lpg", label: "LPG (Propane/Butane)", defaultUnit: "Litres" },
  { value: "diesel_stationary", label: "Diesel (Generators/Stationary)", defaultUnit: "Litres" },
  { value: "heavy_fuel_oil", label: "Heavy Fuel Oil", defaultUnit: "Litres" },
  { value: "biomass_solid", label: "Biogas / Biomass", defaultUnit: "kg" },
  { value: "refrigerant_leakage", label: "Refrigerants (Leakage)", defaultUnit: "kg" },
  { value: "diesel_mobile", label: "Company Fleet (Diesel)", defaultUnit: "Litres" },
  { value: "petrol_mobile", label: "Company Fleet (Petrol/Gasoline)", defaultUnit: "Litres" },
];

interface UtilityEntry {
  utility_type: string;
  quantity: string;
  unit: string;
}

interface AddUtilityToSessionProps {
  sessionId: string;
  facilityId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  productionVolume: number;
  volumeUnit: string;
  onUtilityAdded: () => void;
}

export function AddUtilityToSession({
  sessionId,
  facilityId,
  organizationId,
  periodStart,
  periodEnd,
  productionVolume,
  volumeUnit,
  onUtilityAdded,
}: AddUtilityToSessionProps) {
  const [utilityEntries, setUtilityEntries] = useState<UtilityEntry[]>([
    { utility_type: "", quantity: "", unit: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addUtilityEntry = () => {
    setUtilityEntries([...utilityEntries, { utility_type: "", quantity: "", unit: "" }]);
  };

  const removeUtilityEntry = (index: number) => {
    setUtilityEntries(utilityEntries.filter((_, i) => i !== index));
  };

  const updateUtilityEntry = (index: number, field: string, value: string) => {
    const updated = [...utilityEntries];
    updated[index] = { ...updated[index], [field]: value };
    setUtilityEntries(updated);
  };

  const validateEntries = (): string | null => {
    const emptyEntries = utilityEntries.filter((e) => !e.utility_type && !e.quantity && !e.unit);
    const partialEntries = utilityEntries.filter(
      (e) =>
        (e.utility_type && (!e.quantity || !e.unit)) ||
        (e.quantity && (!e.utility_type || !e.unit)) ||
        (e.unit && (!e.utility_type || !e.quantity))
    );

    if (emptyEntries.length === utilityEntries.length) {
      return "Please add at least one utility entry";
    }

    if (partialEntries.length > 0) {
      return "Please complete all fields for each utility entry";
    }

    const validEntries = utilityEntries.filter((e) => e.utility_type || e.quantity || e.unit);
    const hasZeroQuantity = validEntries.some((e) => parseFloat(e.quantity) <= 0);
    if (hasZeroQuantity) {
      return "All quantities must be greater than zero";
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateEntries();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("User not authenticated");
      }

      const validEntries = utilityEntries.filter(
        (e) => e.utility_type && e.quantity && e.unit
      );

      const insertPromises = validEntries.map(async (entry) => {
        // Insert to utility_data_entries linked to session
        const utilityResult = await supabase
          .from("utility_data_entries")
          .insert({
            facility_id: facilityId,
            reporting_session_id: sessionId,
            utility_type: entry.utility_type,
            quantity: parseFloat(entry.quantity),
            unit: entry.unit,
            reporting_period_start: periodStart,
            reporting_period_end: periodEnd,
            data_quality: "actual",
            calculated_scope: "",
            created_by: userData.user.id,
          })
          .select();

        if (utilityResult.error) {
          return utilityResult;
        }

        // Determine scope and insert to activity_data for calculations
        const scope1Types = [
          "natural_gas",
          "lpg",
          "diesel_stationary",
          "heavy_fuel_oil",
          "biomass_solid",
          "refrigerant_leakage",
          "diesel_mobile",
          "petrol_mobile",
        ];
        const category = scope1Types.includes(entry.utility_type) ? "Scope 1" : "Scope 2";
        const utilityTypeName =
          UTILITY_TYPES.find((u) => u.value === entry.utility_type)?.label || entry.utility_type;

        const activityResult = await supabase.from("activity_data").insert({
          organization_id: organizationId,
          user_id: userData.user.id,
          name: `${utilityTypeName} - ${periodStart} to ${periodEnd}`,
          category,
          quantity: parseFloat(entry.quantity),
          unit: entry.unit,
          activity_date: periodEnd,
        });

        return activityResult;
      });

      const results = await Promise.all(insertPromises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || "Failed to save utility data");
      }

      // Update facility_emissions_aggregated with session reference
      await supabase
        .from("facility_emissions_aggregated")
        .upsert(
          {
            facility_id: facilityId,
            organization_id: organizationId,
            reporting_session_id: sessionId,
            reporting_period_start: periodStart,
            reporting_period_end: periodEnd,
            total_production_volume: productionVolume,
            volume_unit: volumeUnit,
            total_co2e: 0,
            data_source_type: "Primary",
            calculated_by: userData.user.id,
            results_payload: {
              method: "primary_verified_bills",
              utility_entries_count: validEntries.length,
              status: "awaiting_calculation",
            },
          },
          {
            onConflict: "facility_id,reporting_period_start,reporting_period_end",
          }
        );

      // Reset form
      setUtilityEntries([{ utility_type: "", quantity: "", unit: "" }]);
      toast.success(`${validEntries.length} utility entries added successfully`);

      // Trigger calculations
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const calculateUrl = `${supabaseUrl}/functions/v1/invoke-scope1-2-calculations`;

          await fetch(calculateUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              organization_id: organizationId,
            }),
          });

          toast.success("Emissions calculated successfully");
        }
      } catch (calcError) {
        console.error("Calculation trigger failed:", calcError);
        toast.info("Utility data saved. Manual calculation may be needed.");
      }

      onUtilityAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to add utility data");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Utility Consumption Data</CardTitle>
        <CardDescription>
          Add multiple utility entries for the {periodStart} to {periodEnd} period. Production volume: {productionVolume}{" "}
          {volumeUnit}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All entries are linked to this reporting session. Edit the session details if you need to change the period or production volume.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Utility Entries</Label>
            <Button variant="outline" size="sm" onClick={addUtilityEntry} disabled={isSubmitting}>
              <Plus className="h-4 w-4 mr-2" />
              Add Utility
            </Button>
          </div>

          {utilityEntries.map((entry, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div className="md:col-span-2">
                <Label>Utility Type</Label>
                <Select
                  value={entry.utility_type}
                  onValueChange={(value) => {
                    const utility = UTILITY_TYPES.find((u) => u.value === value);
                    updateUtilityEntry(index, "utility_type", value);
                    if (utility && !entry.unit) {
                      updateUtilityEntry(index, "unit", utility.defaultUnit);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UTILITY_TYPES.map((utility) => (
                      <SelectItem key={utility.value} value={utility.value}>
                        {utility.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={entry.quantity}
                  onChange={(e) => updateUtilityEntry(index, "quantity", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Unit</Label>
                  <Input
                    value={entry.unit}
                    onChange={(e) => updateUtilityEntry(index, "unit", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                {utilityEntries.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUtilityEntry(index)}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Saving..." : "Add Utility Data"}
        </Button>
      </CardContent>
    </Card>
  );
}
