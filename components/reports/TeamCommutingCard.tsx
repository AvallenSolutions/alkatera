"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Save, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataProvenanceBadge } from "@/components/ui/data-provenance-badge";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface TeamCommutingCardProps {
  reportId: string;
  initialFteCount: number;
  onUpdate: () => void;
}

export function TeamCommutingCard({ reportId, initialFteCount, onUpdate }: TeamCommutingCardProps) {
  const [fteCount, setFteCount] = useState(initialFteCount.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const COMMUTING_FACTOR = 2.5; // tCO2e per FTE per year (UK average)

  const estimatedCO2e = parseFloat(fteCount || "0") * COMMUTING_FACTOR * 1000; // Convert to kgCO2e

  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  const handleSave = async () => {
    if (!fteCount || parseInt(fteCount) < 0) {
      toast.error("Please enter a valid employee count");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const computedCO2e = parseFloat(fteCount) * COMMUTING_FACTOR * 1000;

      // Delete existing commuting entry for this report
      const { error: deleteError } = await supabase
        .from("corporate_overheads")
        .delete()
        .eq("report_id", reportId)
        .eq("category", "employee_commuting");

      if (deleteError) throw deleteError;

      // Insert new entry
      const { error: insertError } = await supabase
        .from("corporate_overheads")
        .insert({
          report_id: reportId,
          category: "employee_commuting",
          description: `${fteCount} FTEs`,
          spend_amount: 0,
          currency: "GBP",
          entry_date: new Date().toISOString().split("T")[0],
          emission_factor: COMMUTING_FACTOR,
          computed_co2e: computedCO2e,
          fte_count: parseInt(fteCount),
        });

      if (insertError) throw insertError;

      toast.success("Employee count saved");
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      onUpdate();
    } catch (error: any) {
      console.error("Error saving FTE count:", error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 dark:bg-green-950 rounded-full -mr-16 -mt-16 opacity-50" />

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Team & Commuting</CardTitle>
              <CardDescription>Employee commuting emissions</CardDescription>
            </div>
          </div>
          {initialFteCount > 0 && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              {initialFteCount} FTEs
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fte-count">Number of Full-Time Employees</Label>
            <Input
              id="fte-count"
              type="number"
              min="0"
              placeholder="e.g., 50"
              value={fteCount}
              onChange={(e) => setFteCount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              We'll estimate commuting emissions using UK average data
            </p>
            <DataProvenanceBadge variant="block" />
          </div>

          {fteCount && parseFloat(fteCount) > 0 && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
              <div className="text-xs text-muted-foreground">Estimated Annual Emissions</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatEmissions(estimatedCO2e)}
              </div>
              <div className="text-xs text-muted-foreground">
                Based on {COMMUTING_FACTOR} tCO₂e per employee per year
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          size="sm"
          disabled={isSaving || !fteCount || parseInt(fteCount) < 0}
        >
          {isSaving ? (
            "Saving..."
          ) : isSaved ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Employee Count
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
