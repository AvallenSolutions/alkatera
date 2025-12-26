"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus } from "lucide-react";
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
import { DataProvenanceBadge } from "@/components/ui/data-provenance-badge";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";

interface MaterialEntry {
  id: string;
  description: string;
  material_type?: string;
  weight_kg?: number;
  entry_date: string;
  computed_co2e: number;
}

interface MarketingMaterialsCardProps {
  reportId: string;
  entries: MaterialEntry[];
  onUpdate: () => void;
}

interface EmissionFactor {
  factor_id: string;
  name: string;
  value: number;
  unit: string;
  material_type: string;
}

export function MarketingMaterialsCard({ reportId, entries, onUpdate }: MarketingMaterialsCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [emissionFactors, setEmissionFactors] = useState<EmissionFactor[]>([]);
  const [isLoadingFactors, setIsLoadingFactors] = useState(false);
  const [estimatedCO2e, setEstimatedCO2e] = useState<number | null>(null);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const materialOptions = [
    { value: "Glass", label: "Glass", icon: "🪟" },
    { value: "Paper", label: "Paper & Board", icon: "📄" },
    { value: "Textiles", label: "Textiles (Branded Merchandise)", icon: "👕" },
    { value: "Plastic", label: "Plastic", icon: "🧴" },
  ];

  useEffect(() => {
    if (showModal) {
      fetchEmissionFactors();
    }
  }, [showModal]);

  useEffect(() => {
    calculateEstimate();
  }, [materialType, weight, emissionFactors]);

  const fetchEmissionFactors = async () => {
    setIsLoadingFactors(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("emissions_factors")
        .select("factor_id, name, value, unit, material_type")
        .eq("source", "DEFRA 2025")
        .eq("category", "Scope 3")
        .eq("type", "Materials")
        .order("material_type");

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
    if (!materialType || !weight) {
      setEstimatedCO2e(null);
      return;
    }

    const factor = emissionFactors.find((f) => f.material_type === materialType);
    if (!factor) {
      setEstimatedCO2e(null);
      return;
    }

    const weightValue = parseFloat(weight);
    const co2e = factor.value * weightValue;
    setEstimatedCO2e(co2e);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !materialType || !weight) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (parseFloat(weight) <= 0) {
      toast.error("Weight must be greater than zero");
      return;
    }

    setIsSaving(true);
    try {
      const factor = emissionFactors.find((f) => f.material_type === materialType);
      if (!factor) {
        throw new Error("Emission factor not found");
      }

      const weightValue = parseFloat(weight);
      const computedCO2e = factor.value * weightValue;

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("corporate_overheads").insert({
        report_id: reportId,
        category: "purchased_services",
        description,
        material_type: materialType,
        weight_kg: weightValue,
        entry_date: date,
        emission_factor: factor.value,
        computed_co2e: computedCO2e,
        spend_amount: 0,
        currency: "GBP",
      });

      if (error) throw error;

      toast.success("Marketing material logged successfully");
      setDescription("");
      setMaterialType("");
      setWeight("");
      setDate(new Date().toISOString().split("T")[0]);
      setEstimatedCO2e(null);
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving material entry:", error);
      toast.error(error.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Tag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Marketing Materials</CardTitle>
                <CardDescription>Merchandise & POS materials</CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                {entries.length} {entries.length === 1 ? "item" : "items"}
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
                  From {entries.length} marketing {entries.length === 1 ? "item" : "items"}
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
                        {entry.material_type} • {entry.weight_kg}kg • {formatEmissions(entry.computed_co2e)}
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
              <div className="text-sm text-muted-foreground mb-4">No materials logged</div>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Marketing Material
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Marketing Materials & Merchandise</DialogTitle>
            <DialogDescription>
              Activity-based tracking with DEFRA 2025 emission factors
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Item Description</Label>
              <Input
                id="description"
                placeholder="e.g., Conference T-Shirts"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="material-type">Material Type</Label>
              <Select value={materialType} onValueChange={setMaterialType} required>
                <SelectTrigger id="material-type">
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DataProvenanceBadge variant="block" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Total Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0"
                placeholder="e.g., 5.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Please weigh a single item and multiply by quantity, or use the shipping weight
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {estimatedCO2e !== null && (
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                <div className="text-sm text-orange-900 dark:text-orange-100 mb-1">
                  Estimated Emissions
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatEmissions(estimatedCO2e)}
                </div>
                <div className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                  {weight}kg of {materialType}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isLoadingFactors}>
                {isSaving ? "Saving..." : "Save Material"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
