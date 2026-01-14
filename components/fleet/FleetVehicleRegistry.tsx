"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Car, Truck, Bike, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

interface FleetVehicleRegistryProps {
  organizationId?: string;
  onVehicleAdded?: () => void;
}

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  vehicle_class: string;
  propulsion_type: string;
  fuel_type: string;
  year_of_manufacture: number;
  ownership_type: string;
  calculated_scope: string;
  status: string;
  driver_name?: string;
  department?: string;
}

const VEHICLE_CLASSES = [
  { value: "car", label: "Car", icon: Car },
  { value: "van", label: "Van", icon: Truck },
  { value: "hgv", label: "HGV / Truck", icon: Truck },
  { value: "motorcycle", label: "Motorcycle", icon: Bike },
];

const PROPULSION_TYPES = [
  { value: "ice", label: "Internal Combustion (ICE)" },
  { value: "bev", label: "Battery Electric (BEV)" },
  { value: "hybrid", label: "Hybrid" },
];

const FUEL_TYPES = [
  { value: "diesel", label: "Diesel" },
  { value: "petrol", label: "Petrol" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG" },
  { value: "cng", label: "CNG" },
];

const OWNERSHIP_TYPES = [
  { value: "company_owned", label: "Company Owned" },
  { value: "company_leased", label: "Company Leased" },
  { value: "employee_owned", label: "Employee Owned" },
  { value: "rental", label: "Rental / Hired" },
];

// Get current year for validation - don't allow future years
const CURRENT_YEAR = new Date().getFullYear();

export function FleetVehicleRegistry({
  organizationId,
  onVehicleAdded,
}: FleetVehicleRegistryProps) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [formData, setFormData] = useState({
    registration_number: "",
    make_model: "",
    vehicle_class: "car",
    propulsion_type: "ice",
    fuel_type: "petrol",
    year_of_manufacture: CURRENT_YEAR,
    ownership_type: "company_owned",
    driver_name: "",
    department: "",
  });

  useEffect(() => {
    if (organizationId) {
      fetchVehicles();
    }
  }, [organizationId]);

  const fetchVehicles = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("vehicles").insert({
        organization_id: organizationId,
        registration_number: formData.registration_number || null,
        make_model: formData.make_model || null,
        vehicle_class: formData.vehicle_class,
        propulsion_type: formData.propulsion_type,
        fuel_type: formData.propulsion_type === "bev" ? "electric" : formData.fuel_type,
        year_of_manufacture: formData.year_of_manufacture,
        ownership_type: formData.ownership_type,
        driver_name: formData.driver_name || null,
        department: formData.department || null,
        status: "active",
      });

      if (error) throw error;

      toast({
        title: "Vehicle Added",
        description: "The vehicle has been added to your fleet registry.",
      });

      setShowAddDialog(false);
      resetForm();
      fetchVehicles();
      onVehicleAdded?.();
    } catch (error: any) {
      // Properly extract error message from Supabase error object
      const errorMessage =
        error?.message ||
        error?.error?.message ||
        (typeof error === 'object' ? JSON.stringify(error) : String(error)) ||
        "Failed to add vehicle. Please try again.";

      console.error("Error adding vehicle:", errorMessage, error);

      toast({
        title: "Error Adding Vehicle",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to remove this vehicle from the registry?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: "retired" })
        .eq("id", vehicleId);

      if (error) throw error;

      toast({
        title: "Vehicle Retired",
        description: "The vehicle has been marked as retired.",
      });

      fetchVehicles();
      onVehicleAdded?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to retire vehicle",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      registration_number: "",
      make_model: "",
      vehicle_class: "car",
      propulsion_type: "ice",
      fuel_type: "petrol",
      year_of_manufacture: CURRENT_YEAR,
      ownership_type: "company_owned",
      driver_name: "",
      department: "",
    });
  };

  const getScopeColor = (scope: string) => {
    if (scope === "Scope 1") return "secondary";
    if (scope === "Scope 2") return "default";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Vehicle Registry</CardTitle>
          <CardDescription>
            Manage your fleet vehicles for accurate emissions tracking
          </CardDescription>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Vehicle to Fleet</DialogTitle>
              <DialogDescription>
                Register a new vehicle. The scope will be calculated automatically based on
                ownership and fuel type.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    placeholder="e.g., AB12 CDE"
                    value={formData.registration_number}
                    onChange={(e) =>
                      setFormData({ ...formData, registration_number: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Make / Model</Label>
                  <Input
                    placeholder="e.g., Ford Transit"
                    value={formData.make_model}
                    onChange={(e) =>
                      setFormData({ ...formData, make_model: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Class</Label>
                  <Select
                    value={formData.vehicle_class}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vehicle_class: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_CLASSES.map((vc) => (
                        <SelectItem key={vc.value} value={vc.value}>
                          {vc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Propulsion Type</Label>
                  <Select
                    value={formData.propulsion_type}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        propulsion_type: value,
                        fuel_type: value === "bev" ? "electric" : formData.fuel_type,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPULSION_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.propulsion_type !== "bev" && (
                <div className="space-y-2">
                  <Label>Fuel Type</Label>
                  <Select
                    value={formData.fuel_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fuel_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.filter((ft) => ft.value !== "electric").map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Year of Manufacture</Label>
                  <Input
                    type="number"
                    min={1990}
                    max={CURRENT_YEAR}
                    value={formData.year_of_manufacture}
                    onChange={(e) => {
                      const year = parseInt(e.target.value);
                      // Validate year is not in the future
                      if (year <= CURRENT_YEAR) {
                        setFormData({
                          ...formData,
                          year_of_manufacture: year,
                        });
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ownership Type</Label>
                  <Select
                    value={formData.ownership_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, ownership_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNERSHIP_TYPES.map((ot) => (
                        <SelectItem key={ot.value} value={ot.value}>
                          {ot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Driver Name (Optional)</Label>
                  <Input
                    placeholder="Assigned driver"
                    value={formData.driver_name}
                    onChange={(e) =>
                      setFormData({ ...formData, driver_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Department (Optional)</Label>
                  <Input
                    placeholder="e.g., Sales, Operations"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Vehicle
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Car className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No vehicles registered yet</p>
            <p className="text-sm">Add your first vehicle to start tracking fleet emissions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {vehicle.registration_number || vehicle.make_model || "Unnamed"}
                      </p>
                      {vehicle.make_model && vehicle.registration_number && (
                        <p className="text-sm text-muted-foreground">{vehicle.make_model}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{vehicle.vehicle_class}</TableCell>
                  <TableCell className="capitalize">{vehicle.fuel_type}</TableCell>
                  <TableCell className="capitalize">
                    {vehicle.ownership_type?.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getScopeColor(vehicle.calculated_scope)}>
                      {vehicle.calculated_scope}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vehicle.status === "active" ? "default" : "secondary"}
                    >
                      {vehicle.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
