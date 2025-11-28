"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface ProductionMixEntry {
  id: string;
  facility_id: string;
  facility_name: string;
  production_share: number; // Decimal 0.0 to 1.0
  facility_intensity: number | null;
  data_source_type: 'Primary' | 'Secondary_Average' | null;
}

interface Facility {
  id: string;
  name: string;
  location: string | null;
  calculated_intensity: number | null;
  data_source_type: 'Primary' | 'Secondary_Average' | null;
  volume_unit: string | null;
}

interface ProductionMixManagerProps {
  lcaId: string;
  organizationId: string;
  referenceYear: number;
  onMixChange?: () => void;
}

export function ProductionMixManager({
  lcaId,
  organizationId,
  referenceYear,
  onMixChange,
}: ProductionMixManagerProps) {
  const [productionMix, setProductionMix] = useState<ProductionMixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [productionSharePercent, setProductionSharePercent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProductionMix();
  }, [lcaId]);

  const loadProductionMix = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query production mix entries
      const { data: mixData, error: mixError } = await supabase
        .from("lca_production_mix")
        .select("*")
        .eq("lca_id", lcaId)
        .order("production_share", { ascending: false });

      if (mixError) throw mixError;

      // Get facility names
      const facilityIds = (mixData || []).map((m) => m.facility_id);
      if (facilityIds.length > 0) {
        const { data: facilitiesData, error: facilitiesError } = await supabase
          .from("facilities")
          .select("id, name")
          .in("id", facilityIds);

        if (facilitiesError) throw facilitiesError;

        const facilitiesMap = new Map((facilitiesData || []).map((f) => [f.id, f.name]));

        const enrichedMix = (mixData || []).map((entry) => ({
          ...entry,
          facility_name: facilitiesMap.get(entry.facility_id) || "Unknown Facility",
        }));

        setProductionMix(enrichedMix);
      } else {
        setProductionMix([]);
      }
    } catch (err: any) {
      console.error("Error loading production mix:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFacilities = async () => {
    try {
      setError(null);

      // Get all facilities for the organisation
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from("facilities")
        .select("id, name, location")
        .eq("organization_id", organizationId)
        .order("name");

      if (facilitiesError) throw facilitiesError;

      // Get emission intensities for reference year
      const facilityIds = (facilitiesData || []).map((f) => f.id);
      const { data: intensitiesData, error: intensitiesError } = await supabase
        .from("facility_emissions_aggregated")
        .select("facility_id, calculated_intensity, data_source_type, volume_unit")
        .in("facility_id", facilityIds)
        .gte("reporting_period_start", `${referenceYear}-01-01`)
        .lt("reporting_period_start", `${referenceYear + 1}-01-01`)
        .order("reporting_period_start", { ascending: false });

      if (intensitiesError) throw intensitiesError;

      // Match facilities with intensities
      const facilitiesWithIntensity = (facilitiesData || []).map((facility) => {
        const intensity = (intensitiesData || []).find((i) => i.facility_id === facility.id);
        return {
          ...facility,
          calculated_intensity: intensity?.calculated_intensity || null,
          data_source_type: intensity?.data_source_type || null,
          volume_unit: intensity?.volume_unit || null,
        };
      });

      // Filter out already allocated facilities
      const allocatedFacilityIds = productionMix.map((m) => m.facility_id);
      const available = facilitiesWithIntensity.filter(
        (f) => !allocatedFacilityIds.includes(f.id)
      );

      setFacilities(available);
    } catch (err: any) {
      console.error("Error loading facilities:", err);
      setError(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setSelectedFacilityId("");
    setProductionSharePercent("");
    setError(null);
    loadAvailableFacilities();
  };

  const handleAddFacility = async () => {
    try {
      setError(null);

      if (!selectedFacilityId) {
        setError("Please select a facility");
        return;
      }

      const sharePercent = parseFloat(productionSharePercent);
      if (isNaN(sharePercent) || sharePercent <= 0 || sharePercent > 100) {
        setError("Production share must be between 0 and 100");
        return;
      }

      const productionShare = sharePercent / 100;

      // Check total doesn't exceed 100%
      const currentTotal = productionMix.reduce((sum, m) => sum + m.production_share, 0);
      if (currentTotal + productionShare > 1.0001) {
        setError(`Cannot exceed 100%. Current total: ${(currentTotal * 100).toFixed(2)}%`);
        return;
      }

      const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);
      if (!selectedFacility?.calculated_intensity) {
        setError(
          `No emission intensity data found for this facility for year ${referenceYear}. Please log emissions and production data for this facility first.`
        );
        return;
      }

      setIsSubmitting(true);

      // Insert into database
      const { error: insertError } = await supabase.from("lca_production_mix").insert({
        lca_id: lcaId,
        facility_id: selectedFacilityId,
        production_share: productionShare,
        facility_intensity: selectedFacility.calculated_intensity,
        data_source_type: selectedFacility.data_source_type,
      });

      if (insertError) throw insertError;

      // Reload the production mix
      await loadProductionMix();
      setIsAddModalOpen(false);
      onMixChange?.();
    } catch (err: any) {
      console.error("Error adding facility:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFacility = async (entryId: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from("lca_production_mix")
        .delete()
        .eq("id", entryId);

      if (deleteError) throw deleteError;

      await loadProductionMix();
      onMixChange?.();
    } catch (err: any) {
      console.error("Error removing facility:", err);
      setError(err.message);
    }
  };

  const totalSharePercent = productionMix.reduce(
    (sum, m) => sum + m.production_share * 100,
    0
  );
  const isComplete = totalSharePercent >= 99.99 && totalSharePercent <= 100.01;
  const remainingPercent = Math.max(0, 100 - totalSharePercent);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (productionMix.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Mix Allocation</CardTitle>
          <CardDescription>
            ISO 14044 Physical Allocation: Define production share percentages for multi-facility
            manufacturing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You must allocate 100% of production across your manufacturing facilities. Reference
              year: {referenceYear}
            </AlertDescription>
          </Alert>

          <Button onClick={handleOpenAddModal} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Production Facility
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <AddFacilityDialog
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          setSelectedFacilityId={setSelectedFacilityId}
          productionSharePercent={productionSharePercent}
          setProductionSharePercent={setProductionSharePercent}
          remainingPercent={remainingPercent}
          isSubmitting={isSubmitting}
          onSubmit={handleAddFacility}
          error={error}
          referenceYear={referenceYear}
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Mix Allocation</CardTitle>
              <CardDescription>
                {productionMix.length} {productionMix.length === 1 ? "facility" : "facilities"} •
                Reference year: {referenceYear}
              </CardDescription>
            </div>
            <Button onClick={handleOpenAddModal} size="sm" disabled={isComplete}>
              <Plus className="mr-2 h-4 w-4" />
              Add Facility
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility Name</TableHead>
                  <TableHead>Data Source</TableHead>
                  <TableHead className="text-right">Production Share</TableHead>
                  <TableHead className="text-right">Intensity</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionMix.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.facility_name}</TableCell>
                    <TableCell>
                      {entry.data_source_type === "Primary" ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Average</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(entry.production_share * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.facility_intensity?.toFixed(4) || "N/A"} kg CO₂e/unit
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFacility(entry.id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Allocation Status */}
          <div
            className={`rounded-lg p-4 space-y-3 ${
              isComplete
                ? "bg-green-50 dark:bg-green-950"
                : "bg-amber-50 dark:bg-amber-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <h4
                className={`font-semibold ${
                  isComplete
                    ? "text-green-900 dark:text-green-100"
                    : "text-amber-900 dark:text-amber-100"
                }`}
              >
                {isComplete ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Allocation Complete
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Allocation Incomplete
                  </span>
                )}
              </h4>
              <div className="text-right">
                <p
                  className={`text-2xl font-bold font-mono ${
                    isComplete
                      ? "text-green-900 dark:text-green-100"
                      : "text-amber-900 dark:text-amber-100"
                  }`}
                >
                  {totalSharePercent.toFixed(2)}%
                </p>
                <p
                  className={`text-sm ${
                    isComplete
                      ? "text-green-700 dark:text-green-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {isComplete ? "ISO 14044 Compliant" : `${remainingPercent.toFixed(2)}% remaining`}
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>ISO 14044 Requirement:</strong> Production shares must sum to exactly 100%
              before you can proceed with calculation. The weighted average intensity will be
              calculated automatically.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <AddFacilityDialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        facilities={facilities}
        selectedFacilityId={selectedFacilityId}
        setSelectedFacilityId={setSelectedFacilityId}
        productionSharePercent={productionSharePercent}
        setProductionSharePercent={setProductionSharePercent}
        remainingPercent={remainingPercent}
        isSubmitting={isSubmitting}
        onSubmit={handleAddFacility}
        error={error}
        referenceYear={referenceYear}
      />
    </>
  );
}

interface AddFacilityDialogProps {
  open: boolean;
  onClose: () => void;
  facilities: Facility[];
  selectedFacilityId: string;
  setSelectedFacilityId: (id: string) => void;
  productionSharePercent: string;
  setProductionSharePercent: (value: string) => void;
  remainingPercent: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  error: string | null;
  referenceYear: number;
}

function AddFacilityDialog({
  open,
  onClose,
  facilities,
  selectedFacilityId,
  setSelectedFacilityId,
  productionSharePercent,
  setProductionSharePercent,
  remainingPercent,
  isSubmitting,
  onSubmit,
  error,
  referenceYear,
}: AddFacilityDialogProps) {
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Production Facility</DialogTitle>
          <DialogDescription>
            Allocate a percentage of production to a facility for year {referenceYear}
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
            <Label htmlFor="facility-select">Select Facility</Label>
            <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
              <SelectTrigger id="facility-select">
                <SelectValue placeholder="Choose a facility" />
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
                        <Badge variant="destructive" className="ml-2">
                          No Data
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {facilities.length === 0 && (
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
                        {selectedFacility.calculated_intensity.toFixed(4)} kg CO₂e/
                        {selectedFacility.volume_unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Data Source:</span>
                      {selectedFacility.data_source_type === "Primary" ? (
                        <Badge variant="default" className="bg-green-600">
                          Verified
                        </Badge>
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
            <Label htmlFor="production-share">Production Share (%)</Label>
            <Input
              id="production-share"
              type="number"
              min="0"
              max={remainingPercent}
              step="0.01"
              placeholder={`Enter % (max ${remainingPercent.toFixed(2)}%)`}
              value={productionSharePercent}
              onChange={(e) => setProductionSharePercent(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-sm text-muted-foreground">
              Remaining to allocate: {remainingPercent.toFixed(2)}%
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>ISO 14044:</strong> Enter the percentage of this product manufactured at this
              facility. Total must equal 100% across all facilities.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Adding..." : "Add Facility"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
