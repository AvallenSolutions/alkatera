"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Settings, CheckCircle2, Info, Trash2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface TransportEntry {
  id: string;
  description: string;
  transport_mode: string;
  distance_km: number;
  weight_kg?: number;
  units?: number;
  computed_co2e: number;
}

interface DownstreamTransportCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries: TransportEntry[];
  onUpdate: () => void;
}

/**
 * GHG Protocol Scope 3 Category 9: Downstream Transportation & Distribution
 *
 * This captures emissions from transporting products after they leave
 * your facilities - specifically for transport legs NOT covered in
 * the Logistics & Distribution card (which handles your direct shipping).
 *
 * Examples:
 * - Retailer to end customer delivery
 * - Customer collection journeys
 * - Last-mile delivery by third parties
 * - Return shipments
 */
export function DownstreamTransportCard({
  reportId,
  organizationId,
  year,
  entries,
  onUpdate,
}: DownstreamTransportCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [transportMode, setTransportMode] = useState("road_van");
  const [distanceKm, setDistanceKm] = useState("");
  const [unitsSold, setUnitsSold] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const formatTransportMode = (mode: string) => {
    const mapping: Record<string, string> = {
      road_van: "Van Delivery",
      road_car: "Customer Car Journey",
      road_hgv: "HGV Delivery",
      electric_van: "Electric Van",
      bike_cargo: "Cargo Bike",
      click_collect: "Click & Collect",
    };
    return mapping[mode] || mode;
  };

  // Emission factors per delivery (kgCO2e per km per unit)
  // Based on typical last-mile delivery studies
  const getEmissionFactor = (mode: string): number => {
    const factors: Record<string, number> = {
      road_van: 0.00025,      // Diesel van, avg load ~50 units
      road_car: 0.00015,      // Customer journey, avg 5 units
      road_hgv: 0.00008,      // HGV, avg load ~500 units
      electric_van: 0.00005,  // EV van delivery
      bike_cargo: 0.00001,    // Cargo bike, minimal emissions
      click_collect: 0.00010, // Customer drives to collect
    };
    return factors[mode] || 0.00025;
  };

  const calculateEstimatedEmissions = () => {
    if (!distanceKm || !unitsSold) return 0;
    const distance = parseFloat(distanceKm);
    const units = parseFloat(unitsSold);
    if (distance <= 0 || units <= 0) return 0;

    const factor = getEmissionFactor(transportMode);
    return units * distance * factor;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const distance = parseFloat(distanceKm);
    const units = parseFloat(unitsSold);

    if (!distance || distance <= 0) {
      toast.error("Please provide a valid average distance");
      return;
    }

    if (!units || units <= 0) {
      toast.error("Please provide valid units sold");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const emissionFactor = getEmissionFactor(transportMode);
      const computedCO2e = units * distance * emissionFactor;

      const { error } = await supabase
        .from("corporate_overheads")
        .insert({
          report_id: reportId,
          category: "downstream_transport",
          description: description || `${formatTransportMode(transportMode)} - ${units.toLocaleString()} units`,
          transport_mode: transportMode,
          distance_km: distance,
          passenger_count: units, // Reusing this field for units
          currency: "GBP",
          spend_amount: 0,
          entry_date: new Date().toISOString().split("T")[0],
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        });

      if (error) throw error;

      toast.success("Downstream transport entry added");
      setDescription("");
      setDistanceKm("");
      setUnitsSold("");
      setTransportMode("road_van");
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving downstream transport:", error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    setIsDeleting(entryId);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("corporate_overheads")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      toast.success("Entry deleted");
      onUpdate();
    } catch (error: any) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    } finally {
      setIsDeleting(null);
    }
  };

  const isConfigured = entries.length > 0;
  const estimatedEmissions = calculateEstimatedEmissions();

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 dark:bg-purple-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Downstream Transport</CardTitle>
                <CardDescription>Category 9: End-user delivery</CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </Badge>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConfigured ? (
            <>
              <div className="text-center py-4 border-b">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {formatEmissions(totalCO2e)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  From end-user delivery journeys
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
                        {entry.distance_km?.toLocaleString()}km avg distance
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{formatEmissions(entry.computed_co2e)}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isDeleting === entry.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-4">No downstream transport data</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Track emissions from product delivery to end users - customer journeys, last-mile delivery, click & collect
              </p>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Add Downstream Transport
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Downstream Transport</DialogTitle>
            <DialogDescription>
              Record end-user delivery emissions (GHG Protocol Category 9)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This captures delivery to end users beyond your direct distribution.
                Examples: customer collection journeys, third-party last-mile delivery, retailer to customer.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., UK home deliveries"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport-mode">Delivery Method</Label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger id="transport-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="road_van">Van Delivery - 0.25 gCO₂e/unit-km</SelectItem>
                  <SelectItem value="road_car">Customer Car Journey - 0.15 gCO₂e/unit-km</SelectItem>
                  <SelectItem value="road_hgv">HGV Delivery - 0.08 gCO₂e/unit-km</SelectItem>
                  <SelectItem value="electric_van">Electric Van - 0.05 gCO₂e/unit-km</SelectItem>
                  <SelectItem value="bike_cargo">Cargo Bike - 0.01 gCO₂e/unit-km</SelectItem>
                  <SelectItem value="click_collect">Click & Collect - 0.10 gCO₂e/unit-km</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="units">Units Sold</Label>
                <Input
                  id="units"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g., 10000"
                  value={unitsSold}
                  onChange={(e) => setUnitsSold(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Number of product units delivered
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="distance">Avg Distance (km)</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 15"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Average delivery distance
                </p>
              </div>
            </div>

            {estimatedEmissions > 0 && (
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-muted-foreground mb-1">Estimated Emissions</div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatEmissions(estimatedEmissions)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on {parseFloat(unitsSold).toLocaleString()} units x {distanceKm}km avg
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Add Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
