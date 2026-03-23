"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

// ============================================================================
// Types
// ============================================================================

interface OperationalChangeEvent {
  id: string;
  description: string;
  event_date: string;
  scope: string;
  category: string | null;
  impact_direction: string;
  estimated_impact_kgco2e: number | null;
}

interface OperationalChangesCardProps {
  organizationId: string;
  year: number;
  onUpdate?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_OPTIONS = [
  { value: "scope1", label: "Scope 1 (Direct)" },
  { value: "scope2", label: "Scope 2 (Electricity)" },
  { value: "scope3", label: "Scope 3 (Supply chain)" },
];

const CATEGORY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  scope1: [
    { value: "natural_gas", label: "Natural gas" },
    { value: "diesel", label: "Diesel" },
    { value: "lpg", label: "LPG" },
    { value: "kerosene", label: "Kerosene" },
    { value: "fleet", label: "Fleet vehicles" },
    { value: "refrigerants", label: "Refrigerants" },
    { value: "other", label: "Other" },
  ],
  scope2: [
    { value: "electricity", label: "Electricity" },
    { value: "renewables", label: "Onsite renewables" },
    { value: "heat", label: "Heat / steam" },
    { value: "other", label: "Other" },
  ],
  scope3: [
    { value: "purchased_goods", label: "Purchased goods" },
    { value: "packaging", label: "Packaging" },
    { value: "logistics", label: "Logistics / distribution" },
    { value: "business_travel", label: "Business travel" },
    { value: "employee_commuting", label: "Employee commuting" },
    { value: "waste", label: "Waste" },
    { value: "water", label: "Water" },
    { value: "capital_goods", label: "Capital goods" },
    { value: "other", label: "Other" },
  ],
};

const DIRECTION_ICONS = {
  decrease: TrendingDown,
  increase: TrendingUp,
  neutral: Minus,
};

const DIRECTION_COLOURS = {
  decrease: "text-emerald-600 dark:text-emerald-400",
  increase: "text-red-600 dark:text-red-400",
  neutral: "text-slate-500",
};

// ============================================================================
// Component
// ============================================================================

export function OperationalChangesCard({
  organizationId,
  year,
  onUpdate,
}: OperationalChangesCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [entries, setEntries] = useState<OperationalChangeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [scope, setScope] = useState("scope1");
  const [category, setCategory] = useState("");
  const [impactDirection, setImpactDirection] = useState("decrease");
  const [estimatedImpact, setEstimatedImpact] = useState("");

  // Load existing events for this year
  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, year]);

  useEffect(() => {
    setEventDate(new Date().toISOString().split("T")[0]);
  }, []);

  // Reset category when scope changes
  useEffect(() => {
    setCategory("");
  }, [scope]);

  async function loadEvents() {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const startDate = `${year - 1}-04-01`; // Financial year convention
      const endDate = `${year}-03-31`;

      const { data, error } = await supabase
        .from("operational_change_events")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .order("event_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("[OperationalChanges] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("Please describe the operational change");
      return;
    }
    if (!eventDate) {
      toast.error("Please enter the date of the change");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("operational_change_events")
        .insert({
          organization_id: organizationId,
          description: description.trim(),
          event_date: eventDate,
          scope,
          category: category || null,
          impact_direction: impactDirection,
          estimated_impact_kgco2e: estimatedImpact
            ? parseFloat(estimatedImpact)
            : null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success("Operational change logged");
      resetForm();
      setShowModal(false);
      await loadEvents();
      onUpdate?.();
    } catch (err: any) {
      console.error("[OperationalChanges] Save error:", err);
      toast.error("Failed to save change event");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("operational_change_events")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Change event removed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      onUpdate?.();
    } catch (err: any) {
      console.error("[OperationalChanges] Delete error:", err);
      toast.error("Failed to remove entry");
    }
  }

  function resetForm() {
    setDescription("");
    setEventDate(new Date().toISOString().split("T")[0]);
    setScope("scope1");
    setCategory("");
    setImpactDirection("decrease");
    setEstimatedImpact("");
  }

  function formatScope(s: string) {
    const map: Record<string, string> = {
      scope1: "Scope 1",
      scope2: "Scope 2",
      scope3: "Scope 3",
    };
    return map[s] || s;
  }

  function formatCategory(cat: string | null, s: string) {
    if (!cat) return null;
    const options = CATEGORY_OPTIONS[s] || [];
    return options.find((o) => o.value === cat)?.label || cat;
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-950 rounded-full -mr-16 -mt-16 opacity-50" />

        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Operational Changes</CardTitle>
                <CardDescription>
                  Log significant changes that affect your emissions
                </CardDescription>
              </div>
            </div>
            {entries.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                {entries.length} {entries.length === 1 ? "change" : "changes"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {entries.map((entry) => {
                const DirIcon =
                  DIRECTION_ICONS[
                    entry.impact_direction as keyof typeof DIRECTION_ICONS
                  ] || Minus;
                const dirColour =
                  DIRECTION_COLOURS[
                    entry.impact_direction as keyof typeof DIRECTION_COLOURS
                  ] || "text-slate-500";

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 group"
                  >
                    <DirIcon className={`h-4 w-4 mt-0.5 shrink-0 ${dirColour}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {entry.description}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {formatScope(entry.scope)}
                        </Badge>
                        {entry.category && (
                          <Badge variant="outline" className="text-xs">
                            {formatCategory(entry.category, entry.scope)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.event_date).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </span>
                        {entry.estimated_impact_kgco2e != null && (
                          <span className="text-xs text-muted-foreground">
                            ~{(entry.estimated_impact_kgco2e / 1000).toFixed(1)}{" "}
                            tCO₂e
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-muted-foreground mb-1">
                No changes logged for this period
              </div>
              <div className="text-xs text-muted-foreground">
                Record operational changes to help explain why your emissions
                shifted year-on-year
              </div>
            </div>
          )}

          <Button onClick={() => setShowModal(true)} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Operational Change
          </Button>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Add Change Dialog                                                 */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Operational Change</DialogTitle>
            <DialogDescription>
              Record a significant change that affects your emissions (e.g.
              switched electricity tariff, installed solar panels)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="change-desc">What changed? *</Label>
              <Textarea
                id="change-desc"
                placeholder="e.g. Switched to REGO-backed renewable electricity tariff"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                required
              />
            </div>

            {/* Date + Direction */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="change-date">Date of change *</Label>
                <Input
                  id="change-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Impact on emissions *</Label>
                <RadioGroup
                  value={impactDirection}
                  onValueChange={setImpactDirection}
                  className="flex gap-3 pt-1"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="decrease" id="dir-decrease" />
                    <Label
                      htmlFor="dir-decrease"
                      className="text-sm text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    >
                      Decrease
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="increase" id="dir-increase" />
                    <Label
                      htmlFor="dir-increase"
                      className="text-sm text-red-600 dark:text-red-400 cursor-pointer"
                    >
                      Increase
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="neutral" id="dir-neutral" />
                    <Label
                      htmlFor="dir-neutral"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Neutral
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Scope + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scope affected *</Label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(CATEGORY_OPTIONS[scope] || []).map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimated impact */}
            <div className="space-y-2">
              <Label htmlFor="estimated-impact">
                Estimated annual impact (kgCO₂e)
              </Label>
              <Input
                id="estimated-impact"
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={estimatedImpact}
                onChange={(e) => setEstimatedImpact(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Approximate annual emission change from this event. Leave blank
                if unknown.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Log Change"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
