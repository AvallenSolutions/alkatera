"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow } from "@/components/studio/eyebrow";
import { PillButton } from "@/components/studio/pill-button";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { checkSmartMeterConflict, resolveSmartMeterConflict } from "@/lib/energy/check-conflict-client";
import { useReportingPeriod } from "@/hooks/useReportingPeriod";
import {
  UTILITY_TYPES,
  WATER_CATEGORIES,
  WATER_SOURCES,
  WATER_TREATMENT_METHODS,
  WASTE_CATEGORIES,
  WASTE_TYPES,
  WASTE_TREATMENT_METHODS,
  DATA_QUALITY_OPTIONS,
} from "@/lib/constants/utility-types";
import { REFRIGERANT_GWP } from "@/lib/ghg-constants";
import type { Cadence, Period } from "@/lib/log-data/period-utils";
import { getCustomAnnualPeriod } from "@/lib/log-data/period-utils";
import { AgentBanner } from "@/components/agents/AgentBanner";
import { UtilityBillImportDialog } from "./UtilityBillImportDialog";
import { UtilityRolloverDialog } from "./UtilityRolloverDialog";
import { WaterBillImportDialog } from "./WaterBillImportDialog";
import { WasteBillImportDialog } from "./WasteBillImportDialog";

// =============================================================================
// Types
// =============================================================================

interface UtilityRow {
  utility_type: string;
  quantity: string;
  unit: string;
  activity_date: string;
  refrigerant_type?: string;
}

interface WaterRow {
  category: string;
  quantity: string;
  unit: string;
  source: string;
  treatment: string;
  activity_date: string;
}

interface WasteRow {
  category: string;
  quantity: string;
  unit: string;
  waste_type: string;
  treatment: string;
  activity_date: string;
}

interface DirectDataEntryProps {
  facilityId: string;
  organizationId: string;
  onDataSaved?: () => void;
}

/** Quiet mono tab trigger: uppercase, tracked, 3px underline when active. */
const MONO_TAB =
  "relative -mb-px rounded-none border-b-[3px] border-transparent bg-transparent px-0 pb-2.5 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim shadow-none transition-colors data-[state=active]:border-room-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

const MONO_TAB_LIST =
  "h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// =============================================================================
// Component
// =============================================================================

export function DirectDataEntry({
  facilityId,
  organizationId,
  onDataSaved,
}: DirectDataEntryProps) {
  const { defaultCadence, getAvailablePeriods } = useReportingPeriod();
  const [cadence, setCadence] = useState<Cadence>(defaultCadence);
  const [periods, setPeriods] = useState<Period[]>([]);
  // selectedPeriodIndex is the array index as a string, or the literal "custom"
  // when the user has chosen a bespoke 12-month window (Annual cadence only).
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<string>("0");
  const [customStart, setCustomStart] = useState<string>("");
  const [activeTab, setActiveTab] = useState("utilities");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smConflict, setSmConflict] = useState<{ existing: { utilityType: string; from: string; to: string }[] } | null>(null);
  const [showBillImport, setShowBillImport] = useState(false);
  const [showWaterImport, setShowWaterImport] = useState(false);
  const [showWasteImport, setShowWasteImport] = useState(false);
  const [showRollover, setShowRollover] = useState(false);

  // Utility rows
  const [utilityRows, setUtilityRows] = useState<UtilityRow[]>([
    { utility_type: "", quantity: "", unit: "", activity_date: "" },
  ]);

  // Water rows
  const [waterRows, setWaterRows] = useState<WaterRow[]>([
    { category: "", quantity: "", unit: "m3", source: "", treatment: "", activity_date: "" },
  ]);

  // Waste rows
  const [wasteRows, setWasteRows] = useState<WasteRow[]>([
    { category: "", quantity: "", unit: "kg", waste_type: "", treatment: "", activity_date: "" },
  ]);

  useEffect(() => {
    const available = getAvailablePeriods(cadence);
    setPeriods(available);
    setSelectedPeriodIndex("0");
  }, [cadence, getAvailablePeriods]);

  const selectedPeriod: Period | null =
    selectedPeriodIndex === "custom"
      ? customStart
        ? getCustomAnnualPeriod(customStart)
        : null
      : periods[parseInt(selectedPeriodIndex)] || null;

  // =========================================================================
  // Row management helpers
  // =========================================================================

  const addUtilityRow = () =>
    setUtilityRows([...utilityRows, { utility_type: "", quantity: "", unit: "", activity_date: "" }]);

  const removeUtilityRow = (i: number) =>
    setUtilityRows(utilityRows.filter((_, idx) => idx !== i));

  const updateUtilityRow = (i: number, field: keyof UtilityRow, value: string) => {
    const updated = [...utilityRows];
    updated[i] = { ...updated[i], [field]: value };
    setUtilityRows(updated);
  };

  const addWaterRow = () =>
    setWaterRows([...waterRows, { category: "", quantity: "", unit: "m3", source: "", treatment: "", activity_date: "" }]);

  const removeWaterRow = (i: number) =>
    setWaterRows(waterRows.filter((_, idx) => idx !== i));

  const updateWaterRow = (i: number, field: keyof WaterRow, value: string) => {
    const updated = [...waterRows];
    updated[i] = { ...updated[i], [field]: value };
    setWaterRows(updated);
  };

  const addWasteRow = () =>
    setWasteRows([...wasteRows, { category: "", quantity: "", unit: "kg", waste_type: "", treatment: "", activity_date: "" }]);

  const removeWasteRow = (i: number) =>
    setWasteRows(wasteRows.filter((_, idx) => idx !== i));

  const updateWasteRow = (i: number, field: keyof WasteRow, value: string) => {
    const updated = [...wasteRows];
    updated[i] = { ...updated[i], [field]: value };
    setWasteRows(updated);
  };

  // =========================================================================
  // Submit
  // =========================================================================

  const handleSaveUtilities = async (resolution?: "replace") => {
    if (!selectedPeriod) {
      toast.error("Please select a reporting period");
      return;
    }

    const valid = utilityRows.filter((r) => r.utility_type && r.quantity && parseFloat(r.quantity) > 0);
    if (valid.length === 0) {
      toast.error("Please add at least one utility entry with a quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      // "Enter consumption once": warn if smart-meter data already covers these months.
      const types = valid.map((v) => v.utility_type);
      if (resolution === "replace") {
        await resolveSmartMeterConflict(facilityId, types, selectedPeriod.start, selectedPeriod.end);
      } else {
        const c = await checkSmartMeterConflict(facilityId, types, selectedPeriod.start, selectedPeriod.end);
        if (c.conflict) {
          setSmConflict(c);
          setIsSubmitting(false);
          return;
        }
      }
      setSmConflict(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("User not authenticated");

      for (const entry of valid) {
        const utilityInfo = UTILITY_TYPES.find((u) => u.value === entry.utility_type);
        const unit = entry.unit || utilityInfo?.defaultUnit || "kWh";

        // Insert to utility_data_entries (reporting_session_id left NULL)
        const { error: utilError } = await supabase
          .from("utility_data_entries")
          .insert({
            facility_id: facilityId,
            utility_type: entry.utility_type,
            quantity: parseFloat(entry.quantity),
            unit,
            activity_date: entry.activity_date || null,
            reporting_period_start: selectedPeriod.start,
            reporting_period_end: selectedPeriod.end,
            data_quality: "actual",
            calculated_scope: "",
            refrigerant_type:
              entry.utility_type === "refrigerant_leakage"
                ? entry.refrigerant_type ?? null
                : null,
            created_by: userData.user.id,
          });

        if (utilError) throw utilError;

        // Dual-write to activity_data for legacy compatibility
        const category = utilityInfo?.scope === "1" ? "Scope 1" : "Scope 2";
        await supabase.from("activity_data").insert({
          organization_id: organizationId,
          facility_id: facilityId,
          user_id: userData.user.id,
          name: `${utilityInfo?.label || entry.utility_type} - ${selectedPeriod.start} to ${selectedPeriod.end}`,
          category,
          quantity: parseFloat(entry.quantity),
          unit,
          fuel_type: utilityInfo?.fuelType || entry.utility_type,
          activity_date: selectedPeriod.end,
          reporting_period_start: selectedPeriod.start,
          reporting_period_end: selectedPeriod.end,
        });
      }

      // Trigger emissions calculation
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-scope1-2-calculations`;
          await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ organization_id: organizationId }),
          });
        }
      } catch {
        // Non-blocking
      }

      toast.success(`${valid.length} utility ${valid.length === 1 ? "entry" : "entries"} saved`);
      setUtilityRows([{ utility_type: "", quantity: "", unit: "", activity_date: "" }]);
      onDataSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save utility data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWater = async () => {
    if (!selectedPeriod) {
      toast.error("Please select a reporting period");
      return;
    }

    const valid = waterRows.filter((r) => r.category && r.quantity && parseFloat(r.quantity) > 0);
    if (valid.length === 0) {
      toast.error("Please add at least one water entry");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      for (const entry of valid) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              facility_id: facilityId,
              organization_id: organizationId,
              activity_category: entry.category,
              activity_date: entry.activity_date || selectedPeriod.end,
              reporting_period_start: selectedPeriod.start,
              reporting_period_end: selectedPeriod.end,
              quantity: parseFloat(entry.quantity),
              unit: entry.unit,
              water_source_type: entry.source || null,
              wastewater_treatment_method: entry.treatment || null,
              data_provenance: "primary_measured_onsite",
            }),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to save water entry");
        }
      }

      toast.success(`${valid.length} water ${valid.length === 1 ? "entry" : "entries"} saved`);
      setWaterRows([{ category: "", quantity: "", unit: "m3", source: "", treatment: "", activity_date: "" }]);
      onDataSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save water data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveWaste = async () => {
    if (!selectedPeriod) {
      toast.error("Please select a reporting period");
      return;
    }

    const valid = wasteRows.filter((r) => r.category && r.quantity && parseFloat(r.quantity) > 0);
    if (valid.length === 0) {
      toast.error("Please add at least one waste entry");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      for (const entry of valid) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              facility_id: facilityId,
              organization_id: organizationId,
              activity_category: entry.category,
              activity_date: entry.activity_date || selectedPeriod.end,
              reporting_period_start: selectedPeriod.start,
              reporting_period_end: selectedPeriod.end,
              quantity: parseFloat(entry.quantity),
              unit: entry.unit,
              waste_category: entry.waste_type || null,
              waste_treatment_method: entry.treatment || null,
              data_provenance: "primary_measured_onsite",
            }),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to save waste entry");
        }
      }

      toast.success(`${valid.length} waste ${valid.length === 1 ? "entry" : "entries"} saved`);
      setWasteRows([{ category: "", quantity: "", unit: "kg", waste_type: "", treatment: "", activity_date: "" }]);
      onDataSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save waste data");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <>
    <AgentBanner kinds={['utility_bill', 'water_bill', 'waste_bill']} formName="energy, water and waste data" />
    <section>
      <Eyebrow className="mb-1">Log facility data</Eyebrow>
      <p className="mb-5 text-xs text-muted-foreground">
        Select a period, then add utility, water or waste readings.
      </p>
      <div className="space-y-6">
        {/* Period Selection */}
        <div className="flex flex-wrap gap-4 items-end rounded-[6px] border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Cadence</Label>
            <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs font-medium text-muted-foreground">Period</Label>
            <Select
              value={selectedPeriodIndex}
              onValueChange={(v) => {
                // Prefill the custom start with the most recent annual period's
                // start so the date input isn't empty on first open.
                if (v === "custom" && !customStart) {
                  setCustomStart(periods[0]?.start || new Date().toISOString().slice(0, 10));
                }
                setSelectedPeriodIndex(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select period..." />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {p.label}
                  </SelectItem>
                ))}
                {/* Custom day-precise 12-month window — Annual cadence only */}
                {cadence === "annual" && (
                  <SelectItem value="custom">Custom 12-month period…</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedPeriodIndex === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Start date</Label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[170px]"
              />
            </div>
          )}
          {selectedPeriod && (
            <div className="text-xs text-muted-foreground pb-2">
              {selectedPeriod.start} to {selectedPeriod.end}
              {selectedPeriodIndex === "custom" && " (12 months)"}
            </div>
          )}
        </div>

        {/* Data Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={MONO_TAB_LIST}>
            <TabsTrigger value="utilities" className={MONO_TAB}>
              Utilities
            </TabsTrigger>
            <TabsTrigger value="water" className={MONO_TAB}>
              Water
            </TabsTrigger>
            <TabsTrigger value="waste" className={MONO_TAB}>
              Waste
            </TabsTrigger>
          </TabsList>

          {/* ============================================================= */}
          {/* UTILITIES TAB */}
          {/* ============================================================= */}
          <TabsContent value="utilities" className="space-y-4 mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Utility entries</Label>
              <div className="flex flex-wrap items-center gap-2">
                <PillButton variant="ghost" size="sm" onClick={() => setShowRollover(true)} disabled={isSubmitting}>
                  Copy from last year
                </PillButton>
                <PillButton variant="outline" size="sm" onClick={() => setShowBillImport(true)} disabled={isSubmitting}>
                  Upload bill
                </PillButton>
                <PillButton variant="outline" size="sm" onClick={addUtilityRow} disabled={isSubmitting}>
                  Add row
                </PillButton>
              </div>
            </div>

            {utilityRows.map((row, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-[6px] border border-border bg-card p-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={row.utility_type}
                    onValueChange={(v) => {
                      updateUtilityRow(i, "utility_type", v);
                      const info = UTILITY_TYPES.find((u) => u.value === v);
                      if (info && !row.unit) updateUtilityRow(i, "unit", info.defaultUnit);
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {UTILITY_TYPES.filter(
                          (u) => !u.recommendedFor || u.recommendedFor.includes("general"),
                        ).map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Winery / vineyard-specific</SelectLabel>
                        {UTILITY_TYPES.filter(
                          (u) => u.recommendedFor && !u.recommendedFor.includes("general"),
                        ).map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) => updateUtilityRow(i, "quantity", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={row.activity_date}
                    onChange={(e) => updateUtilityRow(i, "activity_date", e.target.value)}
                    disabled={isSubmitting}
                    min={selectedPeriod?.start}
                    max={selectedPeriod?.end}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={row.unit}
                      onChange={(e) => updateUtilityRow(i, "unit", e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  {utilityRows.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeUtilityRow(i)} disabled={isSubmitting}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {row.utility_type === "co2_winemaking" && (
                  <p className="md:col-span-5 text-xs text-muted-foreground">
                    Enter <strong>purchased</strong> CO₂ used in winemaking (tank
                    blanketing, sparging, purging, carbonation), in kg. Do not
                    include CO₂ produced by fermentation, which is biogenic and
                    excluded under the GHG Protocol and ISO 14064.
                  </p>
                )}
                {row.utility_type === "refrigerant_leakage" && (
                  <div className="md:col-span-5">
                    <Label className="text-xs">Refrigerant type</Label>
                    <Select
                      value={row.refrigerant_type ?? ""}
                      onValueChange={(v) => updateUtilityRow(i, "refrigerant_type", v)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger><SelectValue placeholder="Select refrigerant (defaults to R-134a)" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(REFRIGERANT_GWP).map(([key, r]) => (
                          <SelectItem key={key} value={key}>
                            {r.label} · GWP {r.gwp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the mass leaked (kg). Emissions = kg leaked × GWP. If
                      left blank, R-134a (GWP 1430) is assumed for backward
                      compatibility.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {smConflict ? (
              <div className="rounded-[6px] border border-studio-attention/40 bg-card p-4 text-sm">
                <span className="font-medium text-studio-attention">Smart-meter data already covers these months.</span>{' '}
                Saving this entry too would count the same energy twice. Replace the smart-meter data with this entry,
                or cancel and keep the (more detailed) smart-meter data.
                <div className="mt-3 flex flex-wrap gap-2">
                  <PillButton size="sm" disabled={isSubmitting} onClick={() => handleSaveUtilities("replace")}>
                    Replace smart-meter data
                  </PillButton>
                  <PillButton size="sm" variant="ghost" disabled={isSubmitting} onClick={() => setSmConflict(null)}>
                    Cancel
                  </PillButton>
                </div>
              </div>
            ) : (
              <PillButton variant="room" onClick={() => handleSaveUtilities()} disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save utility data"}
              </PillButton>
            )}
          </TabsContent>

          {/* ============================================================= */}
          {/* WATER TAB */}
          {/* ============================================================= */}
          <TabsContent value="water" className="space-y-4 mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Water entries</Label>
              <div className="flex flex-wrap items-center gap-2">
                <PillButton variant="outline" size="sm" onClick={() => setShowWaterImport(true)} disabled={isSubmitting}>
                  Upload bill
                </PillButton>
                <PillButton variant="outline" size="sm" onClick={addWaterRow} disabled={isSubmitting}>
                  Add row
                </PillButton>
              </div>
            </div>

            {waterRows.map((row, i) => (
              <div key={i} className="rounded-[6px] border border-border bg-card p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={row.category} onValueChange={(v) => updateWaterRow(i, "category", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {WATER_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" step="0.01" value={row.quantity} onChange={(e) => updateWaterRow(i, "quantity", e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={row.unit} onValueChange={(v) => updateWaterRow(i, "unit", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m3">m³</SelectItem>
                        <SelectItem value="L">Litres</SelectItem>
                        <SelectItem value="ML">Megalitres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={row.activity_date} onChange={(e) => updateWaterRow(i, "activity_date", e.target.value)} disabled={isSubmitting} min={selectedPeriod?.start} max={selectedPeriod?.end} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Source</Label>
                    <Select value={row.source} onValueChange={(v) => updateWaterRow(i, "source", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                      <SelectContent>
                        {WATER_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Treatment</Label>
                    <Select value={row.treatment} onValueChange={(v) => updateWaterRow(i, "treatment", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                      <SelectContent>
                        {WATER_TREATMENT_METHODS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    {waterRows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeWaterRow(i)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <PillButton variant="room" onClick={handleSaveWater} disabled={isSubmitting} className="w-full">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save water data"}
            </PillButton>
          </TabsContent>

          {/* ============================================================= */}
          {/* WASTE TAB */}
          {/* ============================================================= */}
          <TabsContent value="waste" className="space-y-4 mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Waste entries</Label>
              <div className="flex flex-wrap items-center gap-2">
                <PillButton variant="outline" size="sm" onClick={() => setShowWasteImport(true)} disabled={isSubmitting}>
                  Upload invoice
                </PillButton>
                <PillButton variant="outline" size="sm" onClick={addWasteRow} disabled={isSubmitting}>
                  Add row
                </PillButton>
              </div>
            </div>

            {wasteRows.map((row, i) => (
              <div key={i} className="rounded-[6px] border border-border bg-card p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={row.category} onValueChange={(v) => updateWasteRow(i, "category", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {WASTE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" step="0.01" value={row.quantity} onChange={(e) => updateWasteRow(i, "quantity", e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={row.unit} onValueChange={(v) => updateWasteRow(i, "unit", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="tonnes">Tonnes</SelectItem>
                        <SelectItem value="m3">m³</SelectItem>
                        <SelectItem value="L">Litres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={row.activity_date} onChange={(e) => updateWasteRow(i, "activity_date", e.target.value)} disabled={isSubmitting} min={selectedPeriod?.start} max={selectedPeriod?.end} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Waste Type</Label>
                    <Select value={row.waste_type} onValueChange={(v) => updateWasteRow(i, "waste_type", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                      <SelectContent>
                        {WASTE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Treatment</Label>
                    <Select value={row.treatment} onValueChange={(v) => updateWasteRow(i, "treatment", v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                      <SelectContent>
                        {WASTE_TREATMENT_METHODS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    {wasteRows.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeWasteRow(i)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <PillButton variant="room" onClick={handleSaveWaste} disabled={isSubmitting} className="w-full">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save waste data"}
            </PillButton>
          </TabsContent>
        </Tabs>
      </div>

      <UtilityRolloverDialog
        open={showRollover}
        onClose={() => setShowRollover(false)}
        facilityId={facilityId}
        organizationId={organizationId}
        onDataSaved={() => {
          setShowRollover(false)
          onDataSaved?.()
        }}
      />

      <UtilityBillImportDialog
        open={showBillImport}
        onClose={() => setShowBillImport(false)}
        facilityId={facilityId}
        organizationId={organizationId}
        onDataSaved={() => {
          setShowBillImport(false)
          onDataSaved?.()
        }}
      />

      <WaterBillImportDialog
        open={showWaterImport}
        onClose={() => setShowWaterImport(false)}
        facilityId={facilityId}
        organizationId={organizationId}
        onDataSaved={() => {
          setShowWaterImport(false)
          onDataSaved?.()
        }}
      />

      <WasteBillImportDialog
        open={showWasteImport}
        onClose={() => setShowWasteImport(false)}
        facilityId={facilityId}
        organizationId={organizationId}
        onDataSaved={() => {
          setShowWasteImport(false)
          onDataSaved?.()
        }}
      />
    </section>
    </>
  );
}
