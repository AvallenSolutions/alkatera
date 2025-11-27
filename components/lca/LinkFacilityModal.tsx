"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Facility {
  id: string;
  name: string;
  location: string | null;
  calculated_intensity: number | null;
  data_source_type: 'Primary' | 'Secondary_Average' | null;
  volume_unit: string | null;
}

interface LinkFacilityModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (facilityId: string, productionVolume: number) => Promise<void>;
  organizationId: string;
  excludeFacilityIds?: string[];
}

export function LinkFacilityModal({
  open,
  onClose,
  onSubmit,
  organizationId,
  excludeFacilityIds = [],
}: LinkFacilityModalProps) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [productionVolume, setProductionVolume] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadFacilities();
      setSelectedFacilityId("");
      setProductionVolume("");
      setError(null);
    }
  }, [open, organizationId]);

  const loadFacilities = async () => {
    try {
      setLoadingFacilities(true);
      setError(null);

      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from("facilities")
        .select("id, name, location")
        .eq("organization_id", organizationId)
        .order("name");

      if (facilitiesError) throw facilitiesError;

      const { data: intensitiesData, error: intensitiesError } = await supabase
        .from("facility_emissions_aggregated")
        .select("facility_id, calculated_intensity, data_source_type, volume_unit")
        .in("facility_id", facilitiesData?.map(f => f.id) || [])
        .order("reporting_year", { ascending: false })
        .order("reporting_period", { ascending: false });

      if (intensitiesError) throw intensitiesError;

      const facilitiesWithIntensity = (facilitiesData || []).map(facility => {
        const intensity = (intensitiesData || []).find(i => i.facility_id === facility.id);
        return {
          ...facility,
          calculated_intensity: intensity?.calculated_intensity || null,
          data_source_type: intensity?.data_source_type || null,
          volume_unit: intensity?.volume_unit || null,
        };
      });

      const availableFacilities = facilitiesWithIntensity.filter(
        f => !excludeFacilityIds.includes(f.id)
      );

      setFacilities(availableFacilities);
    } catch (err: any) {
      console.error("Error loading facilities:", err);
      setError(err.message);
    } finally {
      setLoadingFacilities(false);
    }
  };

  const selectedFacility = facilities.find(f => f.id === selectedFacilityId);

  const handleSubmit = async () => {
    setError(null);

    if (!selectedFacilityId) {
      setError("Please select a facility");
      return;
    }

    const volume = parseFloat(productionVolume);

    if (isNaN(volume) || volume <= 0) {
      setError("Please enter a valid production volume greater than 0");
      return;
    }

    if (!selectedFacility?.calculated_intensity) {
      setError("Selected facility does not have a valid emission intensity. Please ensure facility emissions have been calculated.");
      return;
    }

    try {
      setLoading(true);
      await onSubmit(selectedFacilityId, volume);
      onClose();
    } catch (err: any) {
      console.error("Error linking facility:", err);
      setError(err.message || "Failed to link facility");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link Production Facility</DialogTitle>
          <DialogDescription>
            Select the facility where this product is manufactured and enter the production volume.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="facility">Select Facility</Label>
            <Select
              value={selectedFacilityId}
              onValueChange={setSelectedFacilityId}
              disabled={loadingFacilities || loading}
            >
              <SelectTrigger id="facility">
                <SelectValue placeholder={loadingFacilities ? "Loading facilities..." : "Choose a facility"} />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{facility.name}</span>
                      {facility.calculated_intensity ? (
                        <Badge variant="default" className="ml-2 bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          No Data
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {facilities.length === 0 && !loadingFacilities && (
                  <SelectItem value="none" disabled>
                    No facilities available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {selectedFacility && (
              <div className="mt-2 p-3 bg-muted rounded-md space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">{selectedFacility.location || "Not specified"}</span>
                </div>
                {selectedFacility.calculated_intensity && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Emission Intensity:</span>
                      <span className="font-mono font-medium">
                        {selectedFacility.calculated_intensity.toFixed(4)} kg CO₂e/{selectedFacility.volume_unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Data Source:</span>
                      {selectedFacility.data_source_type === 'Primary' ? (
                        <Badge variant="default" className="bg-green-600">Verified</Badge>
                      ) : (
                        <Badge variant="secondary">Industry Average</Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="volume">Volume Produced</Label>
            <Input
              id="volume"
              type="number"
              min="0"
              step="any"
              placeholder="Enter units produced in this period"
              value={productionVolume}
              onChange={(e) => setProductionVolume(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Units produced at this facility during the reporting period
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Allocation Logic:</strong> We use this volume to calculate the weighted average impact
              if you produce at multiple sites. The final impact will be proportional to each site's share
              of total production.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingFacilities}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Linking..." : "Link Facility"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
