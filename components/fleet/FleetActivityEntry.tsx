"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, Fuel, Zap, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface FleetActivityEntryProps {
  organizationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  fuel_type: string;
  calculated_scope: string;
}

const VEHICLE_CATEGORIES = [
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "hgv", label: "HGV / Truck" },
  { value: "motorcycle", label: "Motorcycle" },
];

const FUEL_TYPES = [
  { value: "diesel", label: "Diesel" },
  { value: "petrol", label: "Petrol" },
  { value: "electric", label: "Electric" },
  { value: "hybrid_diesel", label: "Hybrid (Diesel)" },
  { value: "hybrid_petrol", label: "Hybrid (Petrol)" },
  { value: "lpg", label: "LPG" },
];

const OWNERSHIP_TYPES = [
  { value: "company_owned", label: "Company Owned", scope: "Scope 1/2" },
  { value: "company_leased", label: "Company Leased", scope: "Scope 1/2" },
  { value: "employee_owned", label: "Employee Owned (Grey Fleet)", scope: "Scope 3" },
  { value: "rental", label: "Rental / Hired", scope: "Scope 3" },
];

const DATA_ENTRY_METHODS = [
  { value: "distance", label: "Distance (km)", icon: Car },
  { value: "volume", label: "Fuel Volume (litres)", icon: Fuel },
  { value: "consumption", label: "Electricity (kWh)", icon: Zap },
];

export function FleetActivityEntry({
  organizationId,
  onClose,
  onSuccess,
}: FleetActivityEntryProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [useRegisteredVehicle, setUseRegisteredVehicle] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    manual_vehicle_category: "car",
    manual_fuel_type: "petrol",
    manual_ownership_type: "company_owned",
    data_entry_method: "distance",
    distance_km: "",
    fuel_volume_litres: "",
    electricity_kwh: "",
    activity_date: new Date().toISOString().split("T")[0],
    purpose: "",
    driver_name: "",
    data_quality: "Secondary",
    data_source_notes: "",
  });

  useEffect(() => {
    if (organizationId) {
      fetchVehicles();
    }
  }, [organizationId]);

  const fetchVehicles = async () => {
    if (!organizationId) return;

    const { data } = await supabase
      .from("vehicles")
      .select("id, registration_number, make_model, fuel_type, calculated_scope")
      .eq("organization_id", organizationId)
      .eq("status", "active");

    if (data) {
      setVehicles(data);
    }
  };

  const getCalculatedScope = () => {
    if (useRegisteredVehicle && formData.vehicle_id) {
      const vehicle = vehicles.find((v) => v.id === formData.vehicle_id);
      return vehicle?.calculated_scope || "Scope 1";
    }

    const ownership = formData.manual_ownership_type;
    const fuel = formData.manual_fuel_type;

    if (ownership === "employee_owned" || ownership === "rental") {
      return "Scope 3 Cat 6";
    }

    if (fuel === "electric") {
      return "Scope 2";
    }

    return "Scope 1";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setLoading(true);

    try {
      let activityValue: number;
      switch (formData.data_entry_method) {
        case "distance":
          activityValue = parseFloat(formData.distance_km);
          break;
        case "volume":
          activityValue = parseFloat(formData.fuel_volume_litres);
          break;
        case "consumption":
          activityValue = parseFloat(formData.electricity_kwh);
          break;
        default:
          throw new Error("Invalid data entry method");
      }

      if (isNaN(activityValue) || activityValue <= 0) {
        toast({
          title: "Invalid Input",
          description: "Please enter a valid positive number for the activity value.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const payload = {
        organization_id: organizationId,
        vehicle_id: useRegisteredVehicle ? formData.vehicle_id : undefined,
        manual_vehicle_category: !useRegisteredVehicle ? formData.manual_vehicle_category : undefined,
        manual_fuel_type: !useRegisteredVehicle ? formData.manual_fuel_type : undefined,
        manual_ownership_type: !useRegisteredVehicle ? formData.manual_ownership_type : undefined,
        data_entry_method: formData.data_entry_method,
        distance_km: formData.data_entry_method === "distance" ? activityValue : undefined,
        fuel_volume_litres: formData.data_entry_method === "volume" ? activityValue : undefined,
        electricity_kwh: formData.data_entry_method === "consumption" ? activityValue : undefined,
        activity_date: formData.activity_date,
        purpose: formData.purpose || undefined,
        driver_name: formData.driver_name || undefined,
        data_quality: formData.data_quality,
        data_source_notes: formData.data_source_notes || undefined,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/calculate-fleet-emissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to calculate fleet emissions");
      }

      toast({
        title: "Activity Logged",
        description: `${result.emissions_tco2e.toFixed(4)} tCO2e calculated and saved (${result.calculated_scope})`,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Fleet activity error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to log fleet activity",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scope = getCalculatedScope();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Fleet Activity</DialogTitle>
          <DialogDescription>
            Record vehicle usage and calculate emissions automatically
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm font-medium">Calculated Scope:</span>
            <Badge
              variant={
                scope === "Scope 1"
                  ? "secondary"
                  : scope === "Scope 2"
                  ? "default"
                  : "outline"
              }
            >
              {scope}
            </Badge>
          </div>

          {vehicles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useRegisteredVehicle"
                  checked={useRegisteredVehicle}
                  onChange={(e) => setUseRegisteredVehicle(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="useRegisteredVehicle">
                  Use registered vehicle from fleet
                </Label>
              </div>

              {useRegisteredVehicle && (
                <Select
                  value={formData.vehicle_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vehicle_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration_number || vehicle.make_model} -{" "}
                        {vehicle.fuel_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {!useRegisteredVehicle && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Category</Label>
                <Select
                  value={formData.manual_vehicle_category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, manual_vehicle_category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select
                  value={formData.manual_fuel_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, manual_fuel_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map((fuel) => (
                      <SelectItem key={fuel.value} value={fuel.value}>
                        {fuel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ownership</Label>
                <Select
                  value={formData.manual_ownership_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, manual_ownership_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label>Data Entry Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {DATA_ENTRY_METHODS.filter((method) => {
                if (formData.manual_fuel_type === "electric") {
                  return method.value !== "volume";
                }
                if (formData.manual_fuel_type !== "electric") {
                  return method.value !== "consumption";
                }
                return true;
              }).map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.value}
                    type="button"
                    variant={
                      formData.data_entry_method === method.value
                        ? "default"
                        : "outline"
                    }
                    className="h-auto py-3 flex-col gap-1"
                    onClick={() =>
                      setFormData({ ...formData, data_entry_method: method.value })
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{method.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {formData.data_entry_method === "distance" && "Distance (km)"}
                {formData.data_entry_method === "volume" && "Fuel Volume (litres)"}
                {formData.data_entry_method === "consumption" && "Electricity (kWh)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter value"
                value={
                  formData.data_entry_method === "distance"
                    ? formData.distance_km
                    : formData.data_entry_method === "volume"
                    ? formData.fuel_volume_litres
                    : formData.electricity_kwh
                }
                onChange={(e) => {
                  const field =
                    formData.data_entry_method === "distance"
                      ? "distance_km"
                      : formData.data_entry_method === "volume"
                      ? "fuel_volume_litres"
                      : "electricity_kwh";
                  setFormData({ ...formData, [field]: e.target.value });
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Activity Date</Label>
              <Input
                type="date"
                value={formData.activity_date}
                onChange={(e) =>
                  setFormData({ ...formData, activity_date: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purpose (Optional)</Label>
              <Input
                placeholder="e.g., Client meeting, Delivery"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Driver Name (Optional)</Label>
              <Input
                placeholder="Driver name"
                value={formData.driver_name}
                onChange={(e) =>
                  setFormData({ ...formData, driver_name: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data Quality</Label>
            <Select
              value={formData.data_quality}
              onValueChange={(value) =>
                setFormData({ ...formData, data_quality: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Primary">Primary (Direct measurement)</SelectItem>
                <SelectItem value="Secondary">Secondary (Calculated/Estimated)</SelectItem>
                <SelectItem value="Tertiary">Tertiary (Default/Proxy)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Additional notes about this activity..."
              value={formData.data_source_notes}
              onChange={(e) =>
                setFormData({ ...formData, data_source_notes: e.target.value })
              }
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calculate & Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
