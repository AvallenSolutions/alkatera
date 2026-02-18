"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  Droplets,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  X,
  TrendingUp,
  Info,
  BarChart3,
  Calendar,
  Building2,
  Save,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { useAuth } from "@/hooks/useAuth";
import {
  getAvailablePeriods,
  getFinancialYearLabel,
  getFinancialYearRange,
  periodMonths,
  type Cadence,
  type Period,
} from "@/lib/log-data/period-utils";
import {
  groupAndAnnualiseUtilities,
  groupAndAnnualiseActivities,
  getConfidenceLabel,
  getConfidenceDots,
  type AnnualisedResult,
} from "@/lib/log-data/annualisation";

// ============================================================================
// Constants — reused from AddUtilityToSession.tsx
// ============================================================================

const UTILITY_TYPES = [
  { value: "electricity_grid", label: "Purchased Electricity", defaultUnit: "kWh", fuelType: "grid_electricity", scope: "2" },
  { value: "heat_steam_purchased", label: "Purchased Heat / Steam", defaultUnit: "kWh", fuelType: "heat_steam", scope: "2" },
  { value: "natural_gas", label: "Natural Gas", defaultUnit: "kWh", fuelType: "natural_gas_kwh", scope: "1" },
  { value: "natural_gas_m3", label: "Natural Gas (by m³)", defaultUnit: "m3", fuelType: "natural_gas_m3", scope: "1" },
  { value: "lpg", label: "LPG (Propane/Butane)", defaultUnit: "litre", fuelType: "lpg_litre", scope: "1" },
  { value: "diesel_stationary", label: "Diesel (Generators/Stationary)", defaultUnit: "litre", fuelType: "diesel_stationary", scope: "1" },
  { value: "heavy_fuel_oil", label: "Heavy Fuel Oil", defaultUnit: "litre", fuelType: "heavy_fuel_oil", scope: "1" },
  { value: "biomass_solid", label: "Biogas / Biomass", defaultUnit: "kg", fuelType: "biomass_wood_chips", scope: "1" },
  { value: "refrigerant_leakage", label: "Refrigerants (Leakage)", defaultUnit: "kg", fuelType: "refrigerant_r410a", scope: "1" },
  { value: "diesel_mobile", label: "Company Fleet (Diesel)", defaultUnit: "litre", fuelType: "diesel_stationary", scope: "1" },
  { value: "petrol_mobile", label: "Company Fleet (Petrol/Gasoline)", defaultUnit: "litre", fuelType: "petrol", scope: "1" },
];

const WATER_CATEGORIES = [
  { value: "water_intake", label: "Water Intake" },
  { value: "water_discharge", label: "Wastewater Discharge" },
  { value: "water_recycled", label: "Recycled Water" },
];

const WATER_SOURCES = [
  { value: "municipal", label: "Municipal Supply" },
  { value: "groundwater", label: "Groundwater / Borehole" },
  { value: "surface_water", label: "Surface Water" },
  { value: "recycled", label: "Recycled / Reclaimed" },
  { value: "rainwater", label: "Rainwater Harvesting" },
  { value: "other", label: "Other" },
];

const WATER_TREATMENT_METHODS = [
  { value: "primary_treatment", label: "Primary Treatment" },
  { value: "secondary_treatment", label: "Secondary Treatment" },
  { value: "tertiary_treatment", label: "Tertiary Treatment" },
  { value: "none", label: "No Treatment" },
  { value: "unknown", label: "Unknown" },
];

const WASTE_CATEGORIES = [
  { value: "waste_general", label: "General Waste" },
  { value: "waste_hazardous", label: "Hazardous Waste" },
  { value: "waste_recycling", label: "Recycling Stream" },
];

const WASTE_TREATMENT_METHODS = [
  { value: "landfill", label: "Landfill" },
  { value: "recycling", label: "Recycling" },
  { value: "composting", label: "Composting" },
  { value: "incineration_with_recovery", label: "Incineration (Energy Recovery)" },
  { value: "incineration_without_recovery", label: "Incineration (No Recovery)" },
  { value: "anaerobic_digestion", label: "Anaerobic Digestion" },
  { value: "reuse", label: "Reuse" },
  { value: "other", label: "Other" },
];

const DATA_QUALITY_OPTIONS = [
  { value: "primary_measured_onsite", label: "Measured On-site" },
  { value: "primary_supplier_verified", label: "Supplier Verified" },
  { value: "secondary_calculated_allocation", label: "Allocated from Facility Total" },
  { value: "secondary_modelled_industry_average", label: "Industry Average (Estimated)" },
];

// Water stress countries (AWARE protocol, WRI Aqueduct)
const WATER_STRESSED_COUNTRIES = [
  'AE', 'AF', 'BH', 'DJ', 'DZ', 'EG', 'ER', 'IL', 'IN', 'IQ', 'IR', 'JO',
  'KW', 'LB', 'LY', 'MA', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD', 'SY', 'TN',
  'YE', 'CN', 'MN', 'ES', 'GR', 'IT', 'MX', 'ZA',
];

// ============================================================================
// Interfaces
// ============================================================================

interface Facility {
  id: string;
  name: string;
  address_city: string | null;
  address_country: string | null;
  location_country_code: string | null;
}

interface DataContract {
  id: string;
  utility_type: string;
  is_active: boolean;
}

interface UtilityFormRow {
  id: string;
  utility_type: string;
  quantity: string;
  unit: string;
  isContracted: boolean;
}

interface WaterFormRow {
  id: string;
  activity_category: string;
  quantity: string;
  unit: string;
  water_source_type: string;
  wastewater_treatment_method: string;
}

interface WasteFormRow {
  id: string;
  activity_category: string;
  quantity: string;
  unit: string;
  waste_treatment_method: string;
}

interface ExistingEntry {
  id: string;
  type: "utility" | "water" | "waste";
  label: string;
  quantity: number;
  unit: string;
  period_start: string;
  period_end: string;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function LogDataPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  // Selection state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<string>("0");

  // Data state
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [existingSession, setExistingSession] = useState<{
    id: string;
    label: string;
    production_volume: number;
    volume_unit: string;
  } | null>(null);
  const [existingEntries, setExistingEntries] = useState<ExistingEntry[]>([]);

  // Annualisation state
  const [utilityAnnualisation, setUtilityAnnualisation] = useState<Record<string, AnnualisedResult>>({});
  const [waterAnnualisation, setWaterAnnualisation] = useState<Record<string, AnnualisedResult>>({});
  const [wasteAnnualisation, setWasteAnnualisation] = useState<Record<string, AnnualisedResult>>({});

  // Form state
  const [utilityRows, setUtilityRows] = useState<UtilityFormRow[]>([]);
  const [waterRows, setWaterRows] = useState<WaterFormRow[]>([
    { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "m³", water_source_type: "", wastewater_treatment_method: "" },
  ]);
  const [wasteRows, setWasteRows] = useState<WasteFormRow[]>([
    { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "kg", waste_treatment_method: "" },
  ]);
  const [dataQuality, setDataQuality] = useState("primary_measured_onsite");

  // Collapsible state
  const [utilitiesOpen, setUtilitiesOpen] = useState(true);
  const [waterOpen, setWaterOpen] = useState(true);
  const [wasteOpen, setWasteOpen] = useState(true);

  // Loading/saving state
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Derived
  const periods = getAvailablePeriods(cadence);
  const selectedPeriod: Period | null = periods[parseInt(selectedPeriodIndex)] || null;
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) || null;
  const isWaterStressed = selectedFacility?.location_country_code
    ? WATER_STRESSED_COUNTRIES.includes(selectedFacility.location_country_code)
    : false;

  // ============================================================================
  // Data Loading
  // ============================================================================

  // Load facilities for org
  useEffect(() => {
    async function loadFacilities() {
      if (!currentOrganization?.id) return;
      setIsLoadingFacilities(true);
      try {
        const { data, error } = await supabase
          .from("facilities")
          .select("id, name, address_city, address_country, location_country_code")
          .eq("organization_id", currentOrganization.id)
          .order("name");
        if (error) throw error;
        setFacilities(data || []);
      } catch (err) {
        console.error("Error loading facilities:", err);
        toast.error("Failed to load facilities");
      } finally {
        setIsLoadingFacilities(false);
      }
    }
    loadFacilities();
  }, [currentOrganization?.id]);

  // Load data contracts when facility selected
  useEffect(() => {
    async function loadContracts() {
      if (!selectedFacilityId) {
        setDataContracts([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("facility_data_contracts")
          .select("id, utility_type, is_active")
          .eq("facility_id", selectedFacilityId)
          .eq("is_active", true);
        if (error) throw error;
        setDataContracts(data || []);

        // Pre-populate utility rows from contracts
        const contractedRows: UtilityFormRow[] = (data || []).map((contract) => {
          const utilType = UTILITY_TYPES.find((u) => u.value === contract.utility_type);
          return {
            id: crypto.randomUUID(),
            utility_type: contract.utility_type,
            quantity: "",
            unit: utilType?.defaultUnit || "kWh",
            isContracted: true,
          };
        });

        // If no contracts, add one empty row
        if (contractedRows.length === 0) {
          contractedRows.push({
            id: crypto.randomUUID(),
            utility_type: "",
            quantity: "",
            unit: "",
            isContracted: false,
          });
        }

        setUtilityRows(contractedRows);
      } catch (err) {
        console.error("Error loading data contracts:", err);
      }
    }
    loadContracts();
  }, [selectedFacilityId]);

  // Load existing session & entries when facility + period selected
  const loadExistingData = useCallback(async () => {
    if (!selectedFacilityId || !selectedPeriod) return;
    setIsLoadingData(true);
    try {
      // 1. Find overlapping reporting session
      const { data: sessions } = await supabase
        .from("facility_reporting_sessions")
        .select("id, period_start, period_end, total_production_volume, volume_unit")
        .eq("facility_id", selectedFacilityId)
        .lte("period_start", selectedPeriod.end)
        .gte("period_end", selectedPeriod.start);

      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        const startYear = new Date(session.period_start).getFullYear();
        const endYear = new Date(session.period_end).getFullYear();
        const label = startYear === endYear ? `FY ${startYear}` : `FY ${startYear}-${String(endYear).slice(2)}`;
        setExistingSession({
          id: session.id,
          label,
          production_volume: session.total_production_volume,
          volume_unit: session.volume_unit,
        });
      } else {
        setExistingSession(null);
      }

      // 2. Load existing entries for this specific period
      const entries: ExistingEntry[] = [];

      const { data: utilEntries } = await supabase
        .from("utility_data_entries")
        .select("id, utility_type, quantity, unit, reporting_period_start, reporting_period_end")
        .eq("facility_id", selectedFacilityId)
        .eq("reporting_period_start", selectedPeriod.start)
        .eq("reporting_period_end", selectedPeriod.end);

      if (utilEntries) {
        for (const entry of utilEntries) {
          const utilType = UTILITY_TYPES.find((u) => u.value === entry.utility_type);
          entries.push({
            id: entry.id,
            type: "utility",
            label: utilType?.label || entry.utility_type,
            quantity: entry.quantity,
            unit: entry.unit,
            period_start: entry.reporting_period_start,
            period_end: entry.reporting_period_end,
          });
        }
      }

      const waterCategories = WATER_CATEGORIES.map((c) => c.value);
      const wasteCategories = WASTE_CATEGORIES.map((c) => c.value);
      const allCategories = [...waterCategories, ...wasteCategories];

      const { data: actEntries } = await supabase
        .from("facility_activity_entries")
        .select("id, activity_category, quantity, unit, reporting_period_start, reporting_period_end")
        .eq("facility_id", selectedFacilityId)
        .eq("reporting_period_start", selectedPeriod.start)
        .eq("reporting_period_end", selectedPeriod.end)
        .in("activity_category", allCategories);

      if (actEntries) {
        for (const entry of actEntries) {
          const isWater = waterCategories.includes(entry.activity_category);
          const catList = isWater ? WATER_CATEGORIES : WASTE_CATEGORIES;
          const cat = catList.find((c) => c.value === entry.activity_category);
          entries.push({
            id: entry.id,
            type: isWater ? "water" : "waste",
            label: cat?.label || entry.activity_category,
            quantity: entry.quantity,
            unit: entry.unit,
            period_start: entry.reporting_period_start,
            period_end: entry.reporting_period_end,
          });
        }
      }

      setExistingEntries(entries);

      // 3. Load ALL entries for the financial year (for annualisation)
      await loadAnnualisationData();
    } catch (err) {
      console.error("Error loading existing data:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [selectedFacilityId, selectedPeriod]);

  useEffect(() => {
    loadExistingData();
  }, [loadExistingData]);

  // Load all entries for the financial year for annualisation
  const loadAnnualisationData = useCallback(async () => {
    if (!selectedFacilityId || !selectedPeriod) return;

    // Determine financial year range containing the selected period
    const fyRange = getFinancialYearRange(new Date(selectedPeriod.start));

    try {
      // Utility entries for the FY
      const { data: fyUtilEntries } = await supabase
        .from("utility_data_entries")
        .select("utility_type, quantity, unit, reporting_period_start, reporting_period_end")
        .eq("facility_id", selectedFacilityId)
        .gte("reporting_period_start", fyRange.start)
        .lte("reporting_period_end", fyRange.end);

      if (fyUtilEntries && fyUtilEntries.length > 0) {
        setUtilityAnnualisation(groupAndAnnualiseUtilities(fyUtilEntries));
      } else {
        setUtilityAnnualisation({});
      }

      // Water/waste entries for the FY
      const waterCategories = WATER_CATEGORIES.map((c) => c.value);
      const wasteCategories = WASTE_CATEGORIES.map((c) => c.value);

      const { data: fyActEntries } = await supabase
        .from("facility_activity_entries")
        .select("activity_category, quantity, unit, reporting_period_start, reporting_period_end")
        .eq("facility_id", selectedFacilityId)
        .gte("reporting_period_start", fyRange.start)
        .lte("reporting_period_end", fyRange.end)
        .in("activity_category", [...waterCategories, ...wasteCategories]);

      if (fyActEntries && fyActEntries.length > 0) {
        const waterEntries = fyActEntries.filter((e) => waterCategories.includes(e.activity_category));
        const wasteEntries = fyActEntries.filter((e) => wasteCategories.includes(e.activity_category));
        setWaterAnnualisation(
          waterEntries.length > 0 ? groupAndAnnualiseActivities(waterEntries) : {}
        );
        setWasteAnnualisation(
          wasteEntries.length > 0 ? groupAndAnnualiseActivities(wasteEntries) : {}
        );
      } else {
        setWaterAnnualisation({});
        setWasteAnnualisation({});
      }
    } catch (err) {
      console.error("Error loading annualisation data:", err);
    }
  }, [selectedFacilityId, selectedPeriod]);

  // ============================================================================
  // Save Logic
  // ============================================================================

  async function handleSave() {
    if (!selectedFacilityId || !selectedPeriod || !currentOrganization?.id || !user?.id) {
      toast.error("Please select a facility and period first");
      return;
    }

    const validUtilities = utilityRows.filter((r) => r.utility_type && r.quantity && parseFloat(r.quantity) > 0);
    const validWater = waterRows.filter((r) => r.activity_category && r.quantity && parseFloat(r.quantity) > 0);
    const validWaste = wasteRows.filter((r) => r.activity_category && r.quantity && parseFloat(r.quantity) > 0);

    if (validUtilities.length === 0 && validWater.length === 0 && validWaste.length === 0) {
      toast.error("Please enter at least one data point");
      return;
    }

    setIsSaving(true);
    const saved = { utilities: 0, water: 0, waste: 0 };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Save utilities
      for (const row of validUtilities) {
        const utilInfo = UTILITY_TYPES.find((u) => u.value === row.utility_type);
        const category = utilInfo?.scope === "1" ? "Scope 1" : "Scope 2";
        const fuelType = utilInfo?.fuelType || row.utility_type;
        const quantity = parseFloat(row.quantity);

        // Insert to utility_data_entries
        const { error: utilError } = await supabase
          .from("utility_data_entries")
          .insert({
            facility_id: selectedFacilityId,
            reporting_session_id: existingSession?.id || null,
            utility_type: row.utility_type,
            quantity,
            unit: row.unit,
            reporting_period_start: selectedPeriod.start,
            reporting_period_end: selectedPeriod.end,
            data_quality: dataQuality,
            calculated_scope: "",
            created_by: user.id,
          });

        if (utilError) {
          console.error("Error saving utility entry:", utilError);
          toast.error(`Failed to save ${utilInfo?.label || row.utility_type}`);
          continue;
        }

        // Dual-write to activity_data (legacy)
        await supabase.from("activity_data").insert({
          organization_id: currentOrganization.id,
          facility_id: selectedFacilityId,
          user_id: user.id,
          name: `${utilInfo?.label || row.utility_type} - ${selectedPeriod.start} to ${selectedPeriod.end}`,
          category,
          quantity,
          unit: row.unit,
          fuel_type: fuelType,
          activity_date: selectedPeriod.end,
          reporting_period_start: selectedPeriod.start,
          reporting_period_end: selectedPeriod.end,
        });

        saved.utilities++;
      }

      // If utilities were saved, upsert emissions aggregated + trigger calculations
      if (saved.utilities > 0 && existingSession) {
        await supabase.from("facility_emissions_aggregated").upsert(
          {
            facility_id: selectedFacilityId,
            organization_id: currentOrganization.id,
            reporting_session_id: existingSession.id,
            reporting_period_start: selectedPeriod.start,
            reporting_period_end: selectedPeriod.end,
            total_production_volume: existingSession.production_volume,
            volume_unit: existingSession.volume_unit,
            total_co2e: 0,
            data_source_type: "Primary",
            calculated_by: user.id,
            results_payload: {
              method: "primary_verified_bills",
              utility_entries_count: saved.utilities,
              status: "awaiting_calculation",
            },
          },
          { onConflict: "facility_id,reporting_period_start,reporting_period_end" }
        );

        // Trigger scope 1/2 calculations
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          await fetch(`${supabaseUrl}/functions/v1/invoke-scope1-2-calculations`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ organization_id: currentOrganization.id }),
          });
        } catch (calcErr) {
          console.error("Calculation trigger failed:", calcErr);
        }
      }

      // Save water entries via edge function
      for (const row of validWater) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              },
              body: JSON.stringify({
                facility_id: selectedFacilityId,
                organization_id: currentOrganization.id,
                activity_category: row.activity_category,
                activity_date: selectedPeriod.start,
                reporting_period_start: selectedPeriod.start,
                reporting_period_end: selectedPeriod.end,
                quantity: parseFloat(row.quantity),
                unit: row.unit,
                data_provenance: dataQuality,
                water_source_type: row.water_source_type || undefined,
                wastewater_treatment_method: row.wastewater_treatment_method || undefined,
                water_stress_area_flag: isWaterStressed,
                reporting_session_id: existingSession?.id || undefined,
              }),
            }
          );
          if (response.ok) saved.water++;
          else {
            const err = await response.json();
            console.error("Water entry error:", err);
          }
        } catch (err) {
          console.error("Error saving water entry:", err);
        }
      }

      // Save waste entries via edge function
      for (const row of validWaste) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
              },
              body: JSON.stringify({
                facility_id: selectedFacilityId,
                organization_id: currentOrganization.id,
                activity_category: row.activity_category,
                activity_date: selectedPeriod.start,
                reporting_period_start: selectedPeriod.start,
                reporting_period_end: selectedPeriod.end,
                quantity: parseFloat(row.quantity),
                unit: row.unit,
                data_provenance: dataQuality,
                waste_treatment_method: row.waste_treatment_method || undefined,
                reporting_session_id: existingSession?.id || undefined,
              }),
            }
          );
          if (response.ok) saved.waste++;
          else {
            const err = await response.json();
            console.error("Waste entry error:", err);
          }
        } catch (err) {
          console.error("Error saving waste entry:", err);
        }
      }

      // Summary toast
      const parts: string[] = [];
      if (saved.utilities > 0) parts.push(`${saved.utilities} utility`);
      if (saved.water > 0) parts.push(`${saved.water} water`);
      if (saved.waste > 0) parts.push(`${saved.waste} waste`);

      if (parts.length > 0) {
        toast.success(`Saved ${parts.join(", ")} ${parts.length === 1 && (saved.utilities + saved.water + saved.waste) === 1 ? "entry" : "entries"}`);

        // Reset non-contracted utility rows
        setUtilityRows((prev) =>
          prev.map((row) => (row.isContracted ? { ...row, quantity: "" } : row)).filter((row) => row.isContracted)
        );
        if (utilityRows.every((r) => r.isContracted)) {
          setUtilityRows((prev) => prev.map((r) => ({ ...r, quantity: "" })));
        }

        setWaterRows([
          { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "m³", water_source_type: "", wastewater_treatment_method: "" },
        ]);
        setWasteRows([
          { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "kg", waste_treatment_method: "" },
        ]);

        // Refresh data
        await loadExistingData();
      } else {
        toast.error("No entries were saved. Check your data and try again.");
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save data");
    } finally {
      setIsSaving(false);
    }
  }

  // Delete an existing entry
  async function handleDeleteEntry(entry: ExistingEntry) {
    try {
      if (entry.type === "utility") {
        const { error } = await supabase
          .from("utility_data_entries")
          .delete()
          .eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("facility_activity_entries")
          .delete()
          .eq("id", entry.id);
        if (error) throw error;
      }
      toast.success(`Deleted ${entry.label} entry`);
      await loadExistingData();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast.error("Failed to delete entry");
    }
  }

  // ============================================================================
  // Form Helpers
  // ============================================================================

  function addUtilityRow() {
    setUtilityRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), utility_type: "", quantity: "", unit: "", isContracted: false },
    ]);
  }

  function removeUtilityRow(id: string) {
    setUtilityRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateUtilityRow(id: string, field: keyof UtilityFormRow, value: string) {
    setUtilityRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Auto-set unit when type changes
        if (field === "utility_type") {
          const ut = UTILITY_TYPES.find((u) => u.value === value);
          if (ut) updated.unit = ut.defaultUnit;
        }
        return updated;
      })
    );
  }

  function addWaterRow() {
    setWaterRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "m³", water_source_type: "", wastewater_treatment_method: "" },
    ]);
  }

  function removeWaterRow(id: string) {
    setWaterRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateWaterRow(id: string, field: keyof WaterFormRow, value: string) {
    setWaterRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function addWasteRow() {
    setWasteRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), activity_category: "", quantity: "", unit: "kg", waste_treatment_method: "" },
    ]);
  }

  function removeWasteRow(id: string) {
    setWasteRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateWasteRow(id: string, field: keyof WasteFormRow, value: string) {
    setWasteRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  // Contract completeness
  const contractedTypes = dataContracts.map((c) => c.utility_type);
  const filledContractedCount = utilityRows.filter(
    (r) => r.isContracted && r.quantity && parseFloat(r.quantity) > 0
  ).length;

  // FY label for annualisation display
  const fyLabel = selectedPeriod
    ? getFinancialYearLabel(new Date(selectedPeriod.start))
    : "";

  const hasAnnualisationData =
    Object.keys(utilityAnnualisation).length > 0 ||
    Object.keys(waterAnnualisation).length > 0 ||
    Object.keys(wasteAnnualisation).length > 0;

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoadingFacilities) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Log Data
        </h1>
        <p className="text-muted-foreground">
          Record utilities, water, and waste data for your facilities
        </p>
      </div>

      {/* Selection Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Facility selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Facility
              </Label>
              <Select
                value={selectedFacilityId}
                onValueChange={(v) => {
                  setSelectedFacilityId(v);
                  setExistingEntries([]);
                  setExistingSession(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facility..." />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.address_city ? ` (${f.address_city})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cadence selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Cadence
              </Label>
              <Select
                value={cadence}
                onValueChange={(v: Cadence) => {
                  setCadence(v);
                  setSelectedPeriodIndex("0");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Period
              </Label>
              <Select
                value={selectedPeriodIndex}
                onValueChange={setSelectedPeriodIndex}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p, i) => (
                    <SelectItem key={`${p.start}-${p.end}`} value={String(i)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content area — only show when facility + period selected */}
      {selectedFacilityId && selectedPeriod ? (
        isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Reporting Session Info */}
            <Alert className="mb-6" variant={existingSession ? "default" : undefined}>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {existingSession ? (
                  <>
                    Reporting session: <strong>{existingSession.label}</strong>
                    {existingSession.production_volume > 0 && (
                      <> &middot; Production: {existingSession.production_volume.toLocaleString()} {existingSession.volume_unit}</>
                    )}
                  </>
                ) : (
                  <>
                    No reporting session found for this period. Data will be saved without a session.
                    You can create one on the{" "}
                    <a href={`/company/facilities/${selectedFacilityId}`} className="text-primary underline">
                      facility page
                    </a>.
                  </>
                )}
              </AlertDescription>
            </Alert>

            {/* Data Quality selector */}
            <div className="mb-6">
              <Label className="text-sm text-muted-foreground mb-2 block">Data Quality</Label>
              <Select value={dataQuality} onValueChange={setDataQuality}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_QUALITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ============================================================ */}
            {/* Utilities Section */}
            {/* ============================================================ */}
            <Collapsible open={utilitiesOpen} onOpenChange={setUtilitiesOpen} className="mb-6">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Utilities
                        {contractedTypes.length > 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {filledContractedCount}/{contractedTypes.length} contracted
                          </Badge>
                        )}
                      </CardTitle>
                      {utilitiesOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {utilityRows.map((row) => {
                      const utilType = UTILITY_TYPES.find((u) => u.value === row.utility_type);
                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg"
                        >
                          <div className="md:col-span-5">
                            <Label className="text-xs text-muted-foreground">
                              Utility Type
                              {row.isContracted && (
                                <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">contracted</Badge>
                              )}
                            </Label>
                            <Select
                              value={row.utility_type}
                              onValueChange={(v) => updateUtilityRow(row.id, "utility_type", v)}
                              disabled={isSaving}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {UTILITY_TYPES.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="md:col-span-3">
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={row.quantity}
                              onChange={(e) => updateUtilityRow(row.id, "quantity", e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-xs text-muted-foreground">Unit</Label>
                            <Input
                              value={row.unit}
                              onChange={(e) => updateUtilityRow(row.id, "unit", e.target.value)}
                              disabled={isSaving}
                            />
                          </div>
                          <div className="md:col-span-2 flex items-end gap-1">
                            {utilType && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${utilType.scope === "1" ? "border-orange-500/50 text-orange-600" : "border-blue-500/50 text-blue-600"}`}
                              >
                                Scope {utilType.scope}
                              </Badge>
                            )}
                            {!row.isContracted && utilityRows.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeUtilityRow(row.id)}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addUtilityRow}
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add another utility type
                    </Button>

                    {/* Contract completeness bar */}
                    {contractedTypes.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {filledContractedCount} of {contractedTypes.length} contracted types filled
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#ccff00] rounded-full transition-all"
                            style={{
                              width: `${(filledContractedCount / contractedTypes.length) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* ============================================================ */}
            {/* Water Section */}
            {/* ============================================================ */}
            <Collapsible open={waterOpen} onOpenChange={setWaterOpen} className="mb-6">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Droplets className="h-5 w-5 text-blue-500" />
                        Water
                        {isWaterStressed && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Water Stressed Area
                          </Badge>
                        )}
                      </CardTitle>
                      {waterOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {waterRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg"
                      >
                        <div className="md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <Select
                            value={row.activity_category}
                            onValueChange={(v) => updateWaterRow(row.id, "activity_category", v)}
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {WATER_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => updateWaterRow(row.id, "quantity", e.target.value)}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label className="text-xs text-muted-foreground">Unit</Label>
                          <Select
                            value={row.unit}
                            onValueChange={(v) => updateWaterRow(row.id, "unit", v)}
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="m³">m³</SelectItem>
                              <SelectItem value="L">Litres</SelectItem>
                              <SelectItem value="ML">ML</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Source</Label>
                          <Select
                            value={row.water_source_type}
                            onValueChange={(v) => updateWaterRow(row.id, "water_source_type", v)}
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Optional..." />
                            </SelectTrigger>
                            <SelectContent>
                              {WATER_SOURCES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          {row.activity_category === "water_discharge" && (
                            <>
                              <Label className="text-xs text-muted-foreground">Treatment</Label>
                              <Select
                                value={row.wastewater_treatment_method}
                                onValueChange={(v) =>
                                  updateWaterRow(row.id, "wastewater_treatment_method", v)
                                }
                                disabled={isSaving}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Optional..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {WATER_TREATMENT_METHODS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          {waterRows.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeWaterRow(row.id)}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWaterRow}
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add water entry
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* ============================================================ */}
            {/* Waste Section */}
            {/* ============================================================ */}
            <Collapsible open={wasteOpen} onOpenChange={setWasteOpen} className="mb-6">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Trash2 className="h-5 w-5 text-orange-500" />
                        Waste
                      </CardTitle>
                      {wasteOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {wasteRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg"
                      >
                        <div className="md:col-span-4">
                          <Label className="text-xs text-muted-foreground">Waste Stream</Label>
                          <Select
                            value={row.activity_category}
                            onValueChange={(v) => updateWasteRow(row.id, "activity_category", v)}
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {WASTE_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => updateWasteRow(row.id, "quantity", e.target.value)}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Unit</Label>
                          <Select
                            value={row.unit}
                            onValueChange={(v) => updateWasteRow(row.id, "unit", v)}
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="tonnes">tonnes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Treatment</Label>
                          <Select
                            value={row.waste_treatment_method}
                            onValueChange={(v) =>
                              updateWasteRow(row.id, "waste_treatment_method", v)
                            }
                            disabled={isSaving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Optional..." />
                            </SelectTrigger>
                            <SelectContent>
                              {WASTE_TREATMENT_METHODS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          {wasteRows.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeWasteRow(row.id)}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWasteRow}
                      disabled={isSaving}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add waste entry
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* ============================================================ */}
            {/* Annual Estimate Card */}
            {/* ============================================================ */}
            {hasAnnualisationData && (
              <Card className="mb-6 border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-[#ccff00]" />
                    Annual Estimate ({fyLabel})
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Projected annual figures based on data entered so far
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Utilities annualisation */}
                  {Object.keys(utilityAnnualisation).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Utilities
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(utilityAnnualisation).map(([key, result]) => {
                          const utilType = UTILITY_TYPES.find((u) => u.value === key);
                          return (
                            <AnnualEstimateRow
                              key={key}
                              label={utilType?.label || key}
                              result={result}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Water annualisation */}
                  {Object.keys(waterAnnualisation).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Droplets className="h-3.5 w-3.5 text-blue-500" />
                        Water
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(waterAnnualisation).map(([key, result]) => {
                          const cat = WATER_CATEGORIES.find((c) => c.value === key);
                          return (
                            <AnnualEstimateRow
                              key={key}
                              label={cat?.label || key}
                              result={result}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Waste annualisation */}
                  {Object.keys(wasteAnnualisation).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                        <Trash2 className="h-3.5 w-3.5 text-orange-500" />
                        Waste
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(wasteAnnualisation).map(([key, result]) => {
                          const cat = WASTE_CATEGORIES.find((c) => c.value === key);
                          return (
                            <AnnualEstimateRow
                              key={key}
                              label={cat?.label || key}
                              result={result}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {(() => {
                    const allResults = [
                      ...Object.values(utilityAnnualisation),
                      ...Object.values(waterAnnualisation),
                      ...Object.values(wasteAnnualisation),
                    ];
                    if (allResults.length === 0) return null;
                    // Use the lowest confidence as overall
                    const maxMonths = Math.max(...allResults.map((r) => r.monthsCovered));
                    const minMonths = Math.min(...allResults.map((r) => r.monthsCovered));
                    const anyProjection = allResults.some((r) => r.isProjection);

                    if (!anyProjection) {
                      return (
                        <div className="flex items-center gap-2 pt-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Complete year of data - no projection needed
                        </div>
                      );
                    }

                    return (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ConfidenceDots months={minMonths} />
                          <span>
                            Based on {minMonths === maxMonths ? `${minMonths}` : `${minMonths}-${maxMonths}`} month{maxMonths !== 1 ? "s" : ""} of data
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Estimates improve as you add more months of data
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* ============================================================ */}
            {/* Previously Logged Entries */}
            {/* ============================================================ */}
            {existingEntries.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Previously logged for {selectedPeriod.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {existingEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          {entry.type === "utility" && <Zap className="h-4 w-4 text-amber-500" />}
                          {entry.type === "water" && <Droplets className="h-4 w-4 text-blue-500" />}
                          {entry.type === "waste" && <Trash2 className="h-4 w-4 text-orange-500" />}
                          <span className="text-sm font-medium">{entry.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {entry.quantity.toLocaleString()} {entry.unit}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ============================================================ */}
            {/* Save Button */}
            {/* ============================================================ */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="lg"
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              Save All Data
            </Button>
          </>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Select a facility to get started</h3>
            <p className="text-sm">
              Choose a facility and period above to begin logging data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function AnnualEstimateRow({
  label,
  result,
}: {
  label: string;
  result: AnnualisedResult;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono font-medium">
          {result.annualisedEstimate.toLocaleString()} {result.unit}/yr
        </span>
        {result.isProjection && (
          <span className="text-xs text-muted-foreground">
            ({result.monthlyAverage.toLocaleString()}/mo &times; 12)
          </span>
        )}
      </div>
    </div>
  );
}

function ConfidenceDots({ months }: { months: number }) {
  const filled = months >= 12 ? 4 : months >= 9 ? 3 : months >= 4 ? 2 : 1;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= filled ? "bg-[#ccff00]" : "bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}
