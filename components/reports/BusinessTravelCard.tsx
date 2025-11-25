"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane, Plus, Trash2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DataProvenanceBadge } from "@/components/ui/data-provenance-badge";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import {
  calculateDistance,
  extractCityName,
  extractAirportCode,
  getLocationIcon,
  type Location,
} from "@/lib/services/geocoding-service";

interface TravelEntry {
  id: string;
  description: string;
  transport_mode?: string;
  distance_km?: number;
  passenger_count?: number;
  is_return_trip?: boolean;
  entry_date: string;
  computed_co2e: number;
  origin_location?: string;
  destination_location?: string;
  cabin_class?: string;
}

interface BusinessTravelCardProps {
  reportId: string;
  entries: TravelEntry[];
  onUpdate: () => void;
}

interface EmissionFactor {
  factor_id: string;
  name: string;
  value: number;
  unit: string;
  travel_class: string;
  cabin_class?: string;
}

const cabinClassOptions = [
  { value: "Economy", label: "Economy", icon: "💺", description: "Standard seating" },
  { value: "Premium Economy", label: "Premium Economy", icon: "🪑", description: "Extra legroom" },
  { value: "Business", label: "Business", icon: "🛋️", description: "Business class" },
  { value: "First", label: "First", icon: "👑", description: "First class" },
];

export function BusinessTravelCard({ reportId, entries, onUpdate }: BusinessTravelCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [distance, setDistance] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Location state
  const [originLocation, setOriginLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  // Cabin class state
  const [cabinClass, setCabinClass] = useState<string>("Economy");

  const [emissionFactors, setEmissionFactors] = useState<EmissionFactor[]>([]);
  const [isLoadingFactors, setIsLoadingFactors] = useState(false);
  const [estimatedCO2e, setEstimatedCO2e] = useState<number | null>(null);
  const [emissionComparison, setEmissionComparison] = useState<Record<string, number>>({});

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(2)} kgCO₂e`;
  };

  const transportModeOptions = [
    { value: "Domestic", label: "Domestic Flight", icon: "✈️" },
    { value: "Short-haul", label: "Short-haul International Flight", icon: "✈️" },
    { value: "Long-haul", label: "Long-haul International Flight", icon: "✈️" },
    { value: "National", label: "National Rail", icon: "🚆" },
  ];

  const isFlightMode = ["Domestic", "Short-haul", "Long-haul"].includes(transportMode);
  const showCabinClass = isFlightMode;

  useEffect(() => {
    if (showModal) {
      fetchEmissionFactors();
    }
  }, [showModal]);

  // Auto-calculate distance when both locations selected
  useEffect(() => {
    if (originLocation && destinationLocation && !useManualEntry) {
      setIsCalculatingDistance(true);

      try {
        const dist = calculateDistance(
          { lat: originLocation.lat, lon: originLocation.lon },
          { lat: destinationLocation.lat, lon: destinationLocation.lon }
        );

        setCalculatedDistance(dist);
        setDistance(dist.toString());

        // Smart auto-fill description
        const fromCity = extractCityName(originLocation.displayName);
        const toCity = extractCityName(destinationLocation.displayName);
        const fromCode = extractAirportCode(originLocation.displayName);
        const toCode = extractAirportCode(destinationLocation.displayName);

        if (!description) {
          if (fromCode && toCode) {
            setDescription(`${fromCity} (${fromCode}) to ${toCity} (${toCode})`);
          } else {
            setDescription(`${fromCity} to ${toCity}`);
          }
        }
      } catch (error) {
        console.error("Error calculating distance:", error);
        toast.error("Unable to calculate distance");
      } finally {
        setIsCalculatingDistance(false);
      }
    }
  }, [originLocation, destinationLocation, useManualEntry]);

  useEffect(() => {
    calculateEstimate();
  }, [transportMode, distance, passengers, isReturnTrip, cabinClass, emissionFactors]);

  const fetchEmissionFactors = async () => {
    setIsLoadingFactors(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("emissions_factors")
        .select("factor_id, name, value, unit, travel_class, cabin_class")
        .eq("source", "DEFRA 2025")
        .eq("category", "Scope 3")
        .in("type", ["Business Travel - Air", "Business Travel - Rail"])
        .order("travel_class, cabin_class");

      if (error) throw error;
      setEmissionFactors(data || []);
    } catch (error: any) {
      console.error("Error fetching emission factors:", error);
      toast.error("Failed to load emission factors");
    } finally {
      setIsLoadingFactors(false);
    }
  };

  const calculateEstimate = () => {
    if (!transportMode || !distance || !passengers) {
      setEstimatedCO2e(null);
      return;
    }

    // For flights, match both travel_class and cabin_class
    // For rail, only match travel_class
    const factor = isFlightMode
      ? emissionFactors.find((f) => f.travel_class === transportMode && f.cabin_class === cabinClass)
      : emissionFactors.find((f) => f.travel_class === transportMode);

    if (!factor) {
      setEstimatedCO2e(null);
      return;
    }

    const distanceValue = parseFloat(distance);
    const passengerValue = parseInt(passengers);
    const effectiveDistance = isReturnTrip ? distanceValue * 2 : distanceValue;

    const co2e = factor.value * effectiveDistance * passengerValue;
    setEstimatedCO2e(co2e);

    // Calculate comparison for all cabin classes (flights only)
    if (isFlightMode) {
      const comparison: Record<string, number> = {};
      cabinClassOptions.forEach(({ value: cabinType }) => {
        const cabinFactor = emissionFactors.find(
          (f) => f.travel_class === transportMode && f.cabin_class === cabinType
        );
        if (cabinFactor) {
          comparison[cabinType] = cabinFactor.value * effectiveDistance * passengerValue;
        }
      });
      setEmissionComparison(comparison);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!useManualEntry && (!originLocation || !destinationLocation)) {
      toast.error("Please select origin and destination locations");
      return;
    }

    if (useManualEntry && !distance) {
      toast.error("Please enter distance");
      return;
    }

    if (!description || !transportMode || !passengers) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (parseFloat(distance) <= 0 || parseInt(passengers) <= 0) {
      toast.error("Distance and passengers must be greater than zero");
      return;
    }

    if (showCabinClass && !cabinClass) {
      toast.error("Please select a cabin class");
      return;
    }

    setIsSaving(true);
    try {
      const factor = isFlightMode
        ? emissionFactors.find((f) => f.travel_class === transportMode && f.cabin_class === cabinClass)
        : emissionFactors.find((f) => f.travel_class === transportMode);

      if (!factor) {
        throw new Error("Emission factor not found");
      }

      const distanceValue = parseFloat(distance);
      const passengerValue = parseInt(passengers);
      const effectiveDistance = isReturnTrip ? distanceValue * 2 : distanceValue;
      const computedCO2e = factor.value * effectiveDistance * passengerValue;

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("corporate_overheads").insert({
        report_id: reportId,
        category: "business_travel",
        description,

        // Location data
        origin_location: originLocation?.displayName || null,
        destination_location: destinationLocation?.displayName || null,
        origin_coordinates: originLocation
          ? { lat: originLocation.lat, lng: originLocation.lon }
          : null,
        destination_coordinates: destinationLocation
          ? { lat: destinationLocation.lat, lng: destinationLocation.lon }
          : null,
        calculated_distance_km: calculatedDistance,
        distance_source: useManualEntry ? "manual" : "auto",

        // Travel details
        transport_mode: transportMode,
        cabin_class: showCabinClass ? cabinClass : null,
        distance_km: distanceValue,
        passenger_count: passengerValue,
        is_return_trip: isReturnTrip,
        entry_date: date,
        emission_factor: factor.value,
        computed_co2e: computedCO2e,
        spend_amount: 0,
        currency: "GBP",
      });

      if (error) throw error;

      toast.success("Business travel logged successfully");
      resetForm();
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving travel entry:", error);
      toast.error(error.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setTransportMode("");
    setDistance("");
    setPassengers("1");
    setIsReturnTrip(false);
    setDate(new Date().toISOString().split("T")[0]);
    setOriginLocation(null);
    setDestinationLocation(null);
    setCalculatedDistance(null);
    setUseManualEntry(false);
    setCabinClass("Economy");
    setEstimatedCO2e(null);
    setEmissionComparison({});
  };

  const getCabinClassIcon = (cabin: string) => {
    const option = cabinClassOptions.find(opt => opt.value === cabin);
    return option?.icon || "✈️";
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Business Travel</CardTitle>
                <CardDescription>Activity-based tracking</CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {entries.length} {entries.length === 1 ? "trip" : "trips"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {entries.length > 0 ? (
            <>
              <div className="text-center py-4 border-b">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {formatEmissions(totalCO2e)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  From {entries.length} business {entries.length === 1 ? "trip" : "trips"}
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{entry.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.origin_location && entry.destination_location && (
                          <>
                            📍 {extractCityName(entry.origin_location)} → {extractCityName(entry.destination_location)} •{" "}
                          </>
                        )}
                        {entry.distance_km && `${entry.distance_km}km`}
                        {entry.cabin_class && ` • ${getCabinClassIcon(entry.cabin_class)} ${entry.cabin_class}`}
                        {entry.passenger_count && ` • ${entry.passenger_count} pax`}
                        {entry.is_return_trip && " • Return"}
                        {" • "}
                        {formatEmissions(entry.computed_co2e)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.entry_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-4">No business travel logged</div>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Business Travel
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Business Travel</DialogTitle>
            <DialogDescription>
              Activity-based tracking with DEFRA 2025 emission factors
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Trip Description</Label>
              <Input
                id="description"
                placeholder="Auto-filled from locations or enter manually"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {!useManualEntry ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Location *</Label>
                    <LocationAutocomplete
                      value={originLocation}
                      onSelect={setOriginLocation}
                      placeholder="Search origin..."
                      disabled={useManualEntry}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>To Location *</Label>
                    <LocationAutocomplete
                      value={destinationLocation}
                      onSelect={setDestinationLocation}
                      placeholder="Search destination..."
                      disabled={useManualEntry}
                    />
                  </div>
                </div>

                {calculatedDistance !== null && (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-900 dark:text-green-100">
                          📍 {extractCityName(originLocation!.displayName)} → {extractCityName(destinationLocation!.displayName)}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          ✈️ {calculatedDistance} km (automatically calculated)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseManualEntry(true)}
                  className="text-xs"
                >
                  Enter distance manually instead
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="manual-distance">Distance (km) *</Label>
                  <Input
                    id="manual-distance"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 650"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseManualEntry(false)}
                  className="text-xs"
                >
                  Use location autocomplete instead
                </Button>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="transport-mode">Transport Mode *</Label>
              <Select value={transportMode} onValueChange={setTransportMode} required>
                <SelectTrigger id="transport-mode">
                  <SelectValue placeholder="Select transport mode" />
                </SelectTrigger>
                <SelectContent>
                  {transportModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DataProvenanceBadge variant="block" />
            </div>

            {showCabinClass && (
              <div className="space-y-2">
                <Label>Cabin Class *</Label>
                <RadioGroup value={cabinClass} onValueChange={setCabinClass}>
                  {cabinClassOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label
                        htmlFor={option.value}
                        className="font-normal cursor-pointer flex items-center gap-2"
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">({option.description})</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passengers">Passengers *</Label>
                <Input
                  id="passengers"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="return-trip"
                checked={isReturnTrip}
                onCheckedChange={(checked) => setIsReturnTrip(checked as boolean)}
              />
              <Label
                htmlFor="return-trip"
                className="text-sm font-normal cursor-pointer"
              >
                Return trip (doubles the distance)
              </Label>
            </div>

            {estimatedCO2e !== null && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
                <div>
                  <div className="text-sm text-blue-900 dark:text-blue-100 mb-1">
                    {showCabinClass && cabinClass
                      ? `${getCabinClassIcon(cabinClass)} ${cabinClass} Class Emissions`
                      : "Estimated Emissions"}
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatEmissions(estimatedCO2e)}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    {isReturnTrip && `${parseFloat(distance) * 2}km total • `}
                    {passengers} {parseInt(passengers) === 1 ? "passenger" : "passengers"}
                  </div>
                </div>

                {showCabinClass && Object.keys(emissionComparison).length > 0 && (
                  <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                    <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Compare with other classes:
                    </div>
                    <div className="space-y-1">
                      {cabinClassOptions.map(({ value, icon }) => {
                        const emissions = emissionComparison[value];
                        if (!emissions) return null;
                        const isSelected = value === cabinClass;
                        const diff = ((emissions - estimatedCO2e) / estimatedCO2e) * 100;
                        return (
                          <div
                            key={value}
                            className={`text-xs flex justify-between ${
                              isSelected
                                ? "font-medium text-blue-900 dark:text-blue-100"
                                : "text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            <span>
                              {icon} {value}:
                            </span>
                            <span>
                              {formatEmissions(emissions)}
                              {!isSelected && diff !== 0 && (
                                <span className="ml-1">
                                  ({diff > 0 ? "+" : ""}
                                  {diff.toFixed(0)}%)
                                </span>
                              )}
                              {isSelected && <span className="ml-1">← Selected</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {cabinClass !== "Economy" && (
                      <div className="mt-2 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-1">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          💡 Tip: Economy class reduces emissions by{" "}
                          {Math.abs(
                            ((emissionComparison["Economy"] - estimatedCO2e) / estimatedCO2e) * 100
                          ).toFixed(0)}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isLoadingFactors}>
                {isSaving ? "Saving..." : "Save Trip"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
