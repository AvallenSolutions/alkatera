"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpFromLine, Settings, CheckCircle2, Info, Trash2 } from "lucide-react";
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
  weight_kg: number;
  computed_co2e: number;
}

interface UpstreamTransportCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries: TransportEntry[];
  onUpdate: () => void;
}

/**
 * GHG Protocol Scope 3 Category 4: Upstream Transportation & Distribution
 *
 * This captures emissions from transporting purchased goods/materials
 * FROM suppliers TO your facilities.
 *
 * Distinct from Category 9 (downstream) which covers distribution
 * of YOUR products to customers.
 */
export function UpstreamTransportCard({
  reportId,
  organizationId,
  year,
  entries,
  onUpdate,
}: UpstreamTransportCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [transportMode, setTransportMode] = useState("road");
  const [distanceKm, setDistanceKm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const formatTransportMode = (mode: string) => {
    const mapping: Record<string, string> = {
      road: "Road (HGV)",
      rail: "Rail Freight",
      sea: "Sea Freight",
      air: "Air Freight",
      multimodal: "Multimodal",
    };
    return mapping[mode] || mode;
  };

  // Emission factors: kgCO2e per tonne-km (DEFRA 2024)
  const getEmissionFactor = (mode: string): number => {
    const factors: Record<string, number> = {
      road: 0.062,
      rail: 0.028,
      sea: 0.011,
      air: 0.602,
      multimodal: 0.045,
    };
    return factors[mode] || 0.062;
  };

  const calculateEstimatedEmissions = () => {
    if (!distanceKm || !weightKg) return 0;
    const distance = parseFloat(distanceKm);
    const weight = parseFloat(weightKg);
    if (distance <= 0 || weight <= 0) return 0;

    const weightTonnes = weight / 1000;
    const factor = getEmissionFactor(transportMode);
    return weightTonnes * distance * factor;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const distance = parseFloat(distanceKm);
    const weight = parseFloat(weightKg);

    if (!distance || distance <= 0) {
      toast.error("Please provide a valid distance");
      return;
    }

    if (!weight || weight <= 0) {
      toast.error("Please provide a valid weight");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const emissionFactor = getEmissionFactor(transportMode);
      const weightTonnes = weight / 1000;
      const computedCO2e = weightTonnes * distance * emissionFactor;

      const { error } = await supabase
        .from("corporate_overheads")
        .insert({
          report_id: reportId,
          category: "upstream_transport",
          description: description || `${formatTransportMode(transportMode)} - ${distance}km`,
          transport_mode: transportMode,
          distance_km: distance,
          weight_kg: weight,
          currency: "GBP",
          spend_amount: 0,
          entry_date: new Date().toISOString().split("T")[0],
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        });

      if (error) throw error;

      toast.success("Upstream transport entry added");
      setDescription("");
      setDistanceKm("");
      setWeightKg("");
      setTransportMode("road");
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving upstream transport:", error);
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
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 dark:bg-violet-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Upstream Transport</CardTitle>
                <CardDescription>Category 4: Inbound logistics</CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100">
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
                  From inbound material transport
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
                        {(entry.weight_kg / 1000).toFixed(2)} tonnes x {entry.distance_km.toLocaleString()}km
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
              <div className="text-sm text-muted-foreground mb-4">No upstream transport data</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Track emissions from transporting purchased materials and goods from suppliers to your facilities
              </p>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Add Upstream Transport
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Upstream Transport</DialogTitle>
            <DialogDescription>
              Record inbound logistics from suppliers to your facilities (GHG Protocol Category 4)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This covers transportation of purchased goods FROM suppliers TO your facilities.
                For outbound delivery to customers, use Downstream Transport (Category 9).
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Glass bottles from supplier"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport-mode">Transport Mode</Label>
              <Select value={transportMode} onValueChange={setTransportMode}>
                <SelectTrigger id="transport-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="road">Road (HGV) - 0.062 kgCO₂e/tonne-km</SelectItem>
                  <SelectItem value="rail">Rail Freight - 0.028 kgCO₂e/tonne-km</SelectItem>
                  <SelectItem value="sea">Sea Freight - 0.011 kgCO₂e/tonne-km</SelectItem>
                  <SelectItem value="air">Air Freight - 0.602 kgCO₂e/tonne-km</SelectItem>
                  <SelectItem value="multimodal">Multimodal - 0.045 kgCO₂e/tonne-km</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Total Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 5000"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="distance">Distance (km)</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 200"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  required
                />
              </div>
            </div>

            {estimatedEmissions > 0 && (
              <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800">
                <div className="text-xs text-muted-foreground mb-1">Estimated Emissions</div>
                <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                  {formatEmissions(estimatedEmissions)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on {(parseFloat(weightKg) / 1000).toFixed(2)} tonnes x {distanceKm}km
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
