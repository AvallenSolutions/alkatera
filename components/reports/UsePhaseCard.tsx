"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Settings, CheckCircle2, Info, Trash2 } from "lucide-react";
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

interface UsePhaseEntry {
  id: string;
  description: string;
  material_type?: string;
  quantity?: number;
  computed_co2e: number;
}

interface UsePhaseCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries: UsePhaseEntry[];
  onUpdate: () => void;
}

/**
 * GHG Protocol Scope 3 Category 11: Use of Sold Products
 *
 * This captures emissions from customer use of products:
 * - Refrigeration energy for storing beverages
 * - Heating/cooling of products
 * - Energy used by powered products
 *
 * For beverages, the main use-phase impact is refrigeration in:
 * - Retail (supermarkets, convenience stores)
 * - Hospitality (bars, restaurants)
 * - Consumer homes
 */
export function UsePhaseCard({
  reportId,
  organizationId,
  year,
  entries,
  onUpdate,
}: UsePhaseCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [useType, setUseType] = useState("refrigeration_retail");
  const [unitsSold, setUnitsSold] = useState("");
  const [avgStorageDays, setAvgStorageDays] = useState("7");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const totalCO2e = entries.reduce((sum, entry) => sum + (entry.computed_co2e || 0), 0);

  const formatEmissions = (value: number) => {
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const formatUseType = (type: string) => {
    const mapping: Record<string, string> = {
      refrigeration_retail: "Retail Refrigeration",
      refrigeration_hospitality: "Hospitality Refrigeration",
      refrigeration_home: "Home Refrigeration",
      ambient_storage: "Ambient Storage",
      heated_serving: "Heated Serving",
    };
    return mapping[type] || type;
  };

  // Emission factors per unit per day of storage (kgCO2e)
  // Based on refrigeration energy studies and beverage industry LCAs
  const getEmissionFactor = (type: string): number => {
    const factors: Record<string, number> = {
      refrigeration_retail: 0.0008,      // Commercial fridge, shared load
      refrigeration_hospitality: 0.0012, // Bar fridge, higher turnover
      refrigeration_home: 0.0005,        // Domestic fridge, very efficient
      ambient_storage: 0.0,              // No energy use
      heated_serving: 0.0020,            // Warming cabinet/server
    };
    return factors[type] || 0.0008;
  };

  const calculateEstimatedEmissions = () => {
    if (!unitsSold || !avgStorageDays) return 0;
    const units = parseFloat(unitsSold);
    const days = parseFloat(avgStorageDays);
    if (units <= 0 || days < 0) return 0;

    const factor = getEmissionFactor(useType);
    return units * days * factor;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const units = parseFloat(unitsSold);
    const days = parseFloat(avgStorageDays);

    if (!units || units <= 0) {
      toast.error("Please provide valid units sold");
      return;
    }

    if (days < 0) {
      toast.error("Storage days cannot be negative");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const emissionFactor = getEmissionFactor(useType);
      const computedCO2e = units * days * emissionFactor;

      const { error } = await supabase
        .from("corporate_overheads")
        .insert({
          report_id: reportId,
          category: "use_phase",
          description: description || `${formatUseType(useType)} - ${units.toLocaleString()} units`,
          material_type: useType,
          quantity: units,
          currency: "GBP",
          spend_amount: days, // Storing days in spend_amount field
          entry_date: new Date().toISOString().split("T")[0],
          emission_factor: emissionFactor,
          computed_co2e: computedCO2e,
        });

      if (error) throw error;

      toast.success("Use phase entry added");
      setDescription("");
      setUnitsSold("");
      setAvgStorageDays("7");
      setUseType("refrigeration_retail");
      setShowModal(false);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving use phase:", error);
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
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 dark:bg-yellow-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Use of Products</CardTitle>
                <CardDescription>Category 11: Customer use phase</CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
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
                  From product use by customers
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
                        {entry.quantity?.toLocaleString()} units
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
              <div className="text-sm text-muted-foreground mb-4">No use phase data</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                Track emissions from customers using your products - refrigeration, storage, and energy consumption
              </p>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Add Use Phase Data
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Use Phase Emissions</DialogTitle>
            <DialogDescription>
              Record emissions from customer use of products (GHG Protocol Category 11)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                For beverages, use-phase emissions primarily come from refrigeration.
                Consider retail storage, hospitality, and home consumption patterns.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., UK retail refrigeration"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="use-type">Use Phase Type</Label>
              <Select value={useType} onValueChange={setUseType}>
                <SelectTrigger id="use-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refrigeration_retail">Retail Refrigeration - 0.8 gCO₂e/unit/day</SelectItem>
                  <SelectItem value="refrigeration_hospitality">Hospitality Refrigeration - 1.2 gCO₂e/unit/day</SelectItem>
                  <SelectItem value="refrigeration_home">Home Refrigeration - 0.5 gCO₂e/unit/day</SelectItem>
                  <SelectItem value="ambient_storage">Ambient Storage - 0 gCO₂e</SelectItem>
                  <SelectItem value="heated_serving">Heated Serving - 2.0 gCO₂e/unit/day</SelectItem>
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
                  placeholder="e.g., 100000"
                  value={unitsSold}
                  onChange={(e) => setUnitsSold(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Products sold in this channel
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="days">Avg Storage Days</Label>
                <Input
                  id="days"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g., 7"
                  value={avgStorageDays}
                  onChange={(e) => setAvgStorageDays(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Days in refrigerated storage
                </p>
              </div>
            </div>

            {estimatedEmissions > 0 && (
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <div className="text-xs text-muted-foreground mb-1">Estimated Emissions</div>
                <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {formatEmissions(estimatedEmissions)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on {parseFloat(unitsSold).toLocaleString()} units x {avgStorageDays} days
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
