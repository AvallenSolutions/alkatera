"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Settings, CheckCircle2, Info } from "lucide-react";
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

interface LogisticsEntry {
  id: string;
  description: string;
  transport_mode: string;
  distance_km: number;
  weight_kg: number;
  computed_co2e: number;
}

interface LogisticsDistributionCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries: LogisticsEntry[];
  onUpdate: () => void;
}

export function LogisticsDistributionCard({
  reportId,
  organizationId,
  year,
  entries,
  onUpdate,
}: LogisticsDistributionCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [transportMode, setTransportMode] = useState("road");
  const [distanceKm, setDistanceKm] = useState("");
  const [totalProductionWeight, setTotalProductionWeight] = useState(0);
  const [isLoadingWeight, setIsLoadingWeight] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    // Always display in tonnes
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

  const getEmissionFactor = (mode: string): number => {
    // kgCO2e per tonne-km
    const factors: Record<string, number> = {
      road: 0.062,
      rail: 0.028,
      sea: 0.011,
      air: 0.602,
      multimodal: 0.045,
    };
    return factors[mode] || 0.062;
  };

  const fetchProductionWeight = async () => {
    setIsLoadingWeight(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_total_production_weight`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            p_organization_id: organizationId,
            p_year: year,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch production weight");

      const weight = await response.json();
      setTotalProductionWeight(weight || 0);
    } catch (error: any) {
      console.error("Error fetching production weight:", error);
      toast.error("Failed to calculate production weight");
    } finally {
      setIsLoadingWeight(false);
    }
  };

  useEffect(() => {
    if (showModal && totalProductionWeight === 0) {
      fetchProductionWeight();
    }
  }, [showModal]);

  const calculateEstimatedEmissions = () => {
    if (!distanceKm || parseFloat(distanceKm) <= 0) return 0;

    const weightTonnes = totalProductionWeight / 1000;
    const distance = parseFloat(distanceKm);
    const factor = getEmissionFactor(transportMode);

    return weightTonnes * distance * factor;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!distanceKm || parseFloat(distanceKm) <= 0) {
      toast.error("Please provide a valid distance");
      return;
    }

    if (totalProductionWeight === 0) {
      toast.error("No production data found for this year");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const emissionFactor = getEmissionFactor(transportMode);
      const weightTonnes = totalProductionWeight / 1000;
      const distance = parseFloat(distanceKm);
      const computedCO2e = weightTonnes * distance * emissionFactor;

      const { error } = await supabase
        .from("corporate_overheads")
        .insert({
          report_id: reportId,
          category: "downstream_logistics",
          description: `${formatTransportMode(transportMode)} - ${distance}km`,
          transport_mode: transportMode,
          distance_km: distance,
          weight_kg: totalProductionWeight,
          currency: "GBP",
          spend_amount: 0,
          entry_date: new Date().toISOString().split("T")[0],
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        });

      if (error) throw error;

      toast.success("Distribution configured");
      setDistanceKm("");
      setTransportMode("road");
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving logistics configuration:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = entries.length > 0;
  const estimatedEmissions = calculateEstimatedEmissions();

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 dark:bg-cyan-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                <Truck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Logistics & Distribution</CardTitle>
                <CardDescription>Downstream transport emissions</CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configured
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
                  From product distribution
                </div>
              </div>

              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{entry.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {(entry.weight_kg / 1000).toFixed(2)} tonnes • {entry.distance_km.toLocaleString()}km
                      </div>
                    </div>
                    <div className="text-sm font-medium">{formatEmissions(entry.computed_co2e)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-4">Distribution not configured</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Configure your average distribution distance and transport mode for smart emission
                estimates based on production volumes
              </p>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure Distribution
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Distribution</DialogTitle>
            <DialogDescription>
              Set up smart emission estimates based on your production volumes
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {isLoadingWeight ? (
                  "Calculating production weight..."
                ) : totalProductionWeight > 0 ? (
                  <>
                    Detected {(totalProductionWeight / 1000).toFixed(2)} tonnes of production in {year}
                  </>
                ) : (
                  "No production data found for this year"
                )}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="transport-mode">Primary Transport Mode</Label>
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

            <div className="space-y-2">
              <Label htmlFor="distance">Average Distribution Distance (km)</Label>
              <Input
                id="distance"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 250"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Average distance from your facility to customer delivery points
              </p>
            </div>

            {estimatedEmissions > 0 && (
              <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800">
                <div className="text-xs text-muted-foreground mb-1">Estimated Emissions</div>
                <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  {formatEmissions(estimatedEmissions)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on {(totalProductionWeight / 1000).toFixed(2)} tonnes × {distanceKm}km
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isLoadingWeight || totalProductionWeight === 0}>
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
