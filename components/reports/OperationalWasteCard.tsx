"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Recycle } from "lucide-react";
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
import { toast } from "sonner";

interface WasteEntry {
  id: string;
  description: string;
  material_type: string;
  disposal_method: string;
  weight_kg: number;
  entry_date: string;
  computed_co2e: number;
}

interface OperationalWasteCardProps {
  reportId: string;
  entries: WasteEntry[];
  onUpdate: () => void;
}

export function OperationalWasteCard({ reportId, entries, onUpdate }: OperationalWasteCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [materialType, setMaterialType] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("recycling");
  const [weightKg, setWeightKg] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight_kg, 0);

  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const formatDisposalMethod = (method: string) => {
    const mapping: Record<string, string> = {
      landfill: "Landfill",
      recycling: "Recycling",
      composting: "Composting",
      incineration: "Incineration",
      anaerobic_digestion: "Anaerobic Digestion",
    };
    return mapping[method] || method;
  };

  const getDisposalIcon = (method: string) => {
    if (method === "recycling" || method === "composting" || method === "anaerobic_digestion") {
      return <Recycle className="h-3 w-3 text-green-600" />;
    }
    return <Trash2 className="h-3 w-3 text-slate-600" />;
  };

  const getEmissionFactor = (method: string): number => {
    // kgCO2e per kg of waste
    const factors: Record<string, number> = {
      landfill: 0.5,
      recycling: 0.02,
      composting: 0.01,
      incineration: 0.3,
      anaerobic_digestion: 0.005,
    };
    return factors[method] || 0.5;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialType || !disposalMethod || !weightKg || parseFloat(weightKg) <= 0) {
      toast.error("Please provide all required fields with valid values");
      return;
    }

    setIsSaving(true);
    try {
      const emissionFactor = getEmissionFactor(disposalMethod);
      const weight = parseFloat(weightKg);
      const computedCO2e = weight * emissionFactor;

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/corporate_overheads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({
          report_id: reportId,
          category: "operational_waste",
          description: materialType,
          material_type: materialType,
          disposal_method: disposalMethod,
          weight_kg: weight,
          currency: "GBP",
          spend_amount: 0,
          entry_date: date,
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        }),
      });

      if (!response.ok) throw new Error("Failed to save entry");

      toast.success("Waste logged");
      setMaterialType("");
      setDisposalMethod("recycling");
      setWeightKg("");
      setDate(new Date().toISOString().split("T")[0]);
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving waste entry:", error);
      toast.error("Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Operational Waste</CardTitle>
                <CardDescription>Facility waste & disposal</CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
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
                  {totalWeight.toLocaleString()}kg total waste
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {getDisposalIcon(entry.disposal_method)}
                          {formatDisposalMethod(entry.disposal_method)}
                        </Badge>
                      </div>
                      <div className="font-medium text-sm truncate">{entry.material_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.weight_kg.toLocaleString()}kg • {formatEmissions(entry.computed_co2e)}
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
              <div className="text-sm text-muted-foreground mb-4">No waste logged</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Track facility waste like spent grain, cardboard, glass, or other materials
              </p>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Waste
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Operational Waste</DialogTitle>
            <DialogDescription>Record facility waste for carbon accounting</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-type">Material Type</Label>
              <Input
                id="material-type"
                placeholder="e.g., Spent grain, Cardboard, Glass"
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disposal-method">Disposal Method</Label>
              <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                <SelectTrigger id="disposal-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recycling">
                    <div className="flex items-center gap-2">
                      <Recycle className="h-3 w-3 text-green-600" />
                      Recycling (0.02 kgCO₂e/kg)
                    </div>
                  </SelectItem>
                  <SelectItem value="composting">
                    <div className="flex items-center gap-2">
                      <Recycle className="h-3 w-3 text-green-600" />
                      Composting (0.01 kgCO₂e/kg)
                    </div>
                  </SelectItem>
                  <SelectItem value="anaerobic_digestion">
                    <div className="flex items-center gap-2">
                      <Recycle className="h-3 w-3 text-green-600" />
                      Anaerobic Digestion (0.005 kgCO₂e/kg)
                    </div>
                  </SelectItem>
                  <SelectItem value="incineration">Incineration (0.3 kgCO₂e/kg)</SelectItem>
                  <SelectItem value="landfill">Landfill (0.5 kgCO₂e/kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  required
                />
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
            </div>

            {weightKg && parseFloat(weightKg) > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                <div className="text-xs text-muted-foreground mb-1">Estimated Emissions</div>
                <div className="text-lg font-semibold">
                  {formatEmissions(parseFloat(weightKg) * getEmissionFactor(disposalMethod))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Waste Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
