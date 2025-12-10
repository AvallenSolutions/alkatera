"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Calculator,
  Calendar,
  Factory,
  Info,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface ContractManufacturerAllocationFormProps {
  productId: number;
  facilityId: string;
  facilityName: string;
  organizationId: string;
  supplierId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface EnergyInput {
  id: string;
  fuelType: string;
  consumptionValue: string;
  consumptionUnit: string;
  calculatedCo2e: number;
  emissionFactorUsed: number;
  emissionFactorYear: number;
}

const FUEL_TYPES = [
  { value: "grid_electricity", label: "Grid Electricity", defaultUnit: "kWh" },
  { value: "natural_gas_kwh", label: "Natural Gas (kWh)", defaultUnit: "kWh" },
  { value: "natural_gas_m3", label: "Natural Gas (m³)", defaultUnit: "m3" },
  { value: "diesel_stationary", label: "Diesel (Stationary)", defaultUnit: "litre" },
  { value: "petrol", label: "Petrol", defaultUnit: "litre" },
  { value: "lpg_litre", label: "LPG (Litres)", defaultUnit: "litre" },
  { value: "lpg_kwh", label: "LPG (kWh)", defaultUnit: "kWh" },
  { value: "heavy_fuel_oil", label: "Heavy Fuel Oil", defaultUnit: "litre" },
  { value: "heat_steam", label: "Purchased Heat/Steam", defaultUnit: "kWh" },
  { value: "biomass_wood_chips", label: "Wood Chips", defaultUnit: "kg" },
  { value: "biomass_wood_pellets", label: "Wood Pellets", defaultUnit: "kg" },
  { value: "biogas", label: "Biogas", defaultUnit: "kWh" },
];

const PRODUCTION_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "cases", label: "Cases" },
  { value: "pallets", label: "Pallets" },
];

export function ContractManufacturerAllocationForm({
  productId,
  facilityId,
  facilityName,
  organizationId,
  supplierId,
  onSuccess,
  onCancel,
}: ContractManufacturerAllocationFormProps) {
  const supabase = getSupabaseBrowserClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emissionFactors, setEmissionFactors] = useState<Record<string, any>>({});

  const currentYear = new Date().getFullYear();
  const [reportingPeriodStart, setReportingPeriodStart] = useState("");
  const [reportingPeriodEnd, setReportingPeriodEnd] = useState("");

  const [totalFacilityProductionVolume, setTotalFacilityProductionVolume] = useState("");
  const [productionVolumeUnit, setProductionVolumeUnit] = useState("units");

  const [co2eEntryMethod, setCo2eEntryMethod] = useState<"direct" | "calculated_from_energy">("direct");
  const [directCo2eValue, setDirectCo2eValue] = useState("");
  const [emissionFactorYear, setEmissionFactorYear] = useState(currentYear);
  const [energyInputs, setEnergyInputs] = useState<EnergyInput[]>([]);

  const [clientProductionVolume, setClientProductionVolume] = useState("");

  const [isEnergyIntensiveProcess, setIsEnergyIntensiveProcess] = useState(false);
  const [energyIntensiveNotes, setEnergyIntensiveNotes] = useState("");

  useEffect(() => {
    loadEmissionFactors();
  }, [emissionFactorYear]);

  const loadEmissionFactors = async () => {
    const { data, error } = await supabase
      .from("defra_energy_emission_factors")
      .select("*")
      .eq("factor_year", emissionFactorYear);

    if (data) {
      const factorsMap: Record<string, any> = {};
      data.forEach((factor) => {
        factorsMap[factor.fuel_type] = factor;
      });
      setEmissionFactors(factorsMap);
    }
  };

  const totalFacilityCo2e = useMemo(() => {
    if (co2eEntryMethod === "direct") {
      return parseFloat(directCo2eValue) || 0;
    }
    return energyInputs.reduce((sum, input) => sum + (input.calculatedCo2e || 0), 0);
  }, [co2eEntryMethod, directCo2eValue, energyInputs]);

  const attributionRatio = useMemo(() => {
    const totalVolume = parseFloat(totalFacilityProductionVolume) || 0;
    const clientVolume = parseFloat(clientProductionVolume) || 0;
    if (totalVolume <= 0) return 0;
    return Math.min(clientVolume / totalVolume, 1);
  }, [totalFacilityProductionVolume, clientProductionVolume]);

  const allocatedEmissions = useMemo(() => {
    return totalFacilityCo2e * attributionRatio;
  }, [totalFacilityCo2e, attributionRatio]);

  const emissionIntensity = useMemo(() => {
    const clientVolume = parseFloat(clientProductionVolume) || 0;
    if (clientVolume <= 0) return 0;
    return allocatedEmissions / clientVolume;
  }, [allocatedEmissions, clientProductionVolume]);

  const addEnergyInput = () => {
    setEnergyInputs([
      ...energyInputs,
      {
        id: crypto.randomUUID(),
        fuelType: "",
        consumptionValue: "",
        consumptionUnit: "",
        calculatedCo2e: 0,
        emissionFactorUsed: 0,
        emissionFactorYear: emissionFactorYear,
      },
    ]);
  };

  const removeEnergyInput = (id: string) => {
    setEnergyInputs(energyInputs.filter((input) => input.id !== id));
  };

  const updateEnergyInput = (id: string, field: keyof EnergyInput, value: string | number) => {
    setEnergyInputs(
      energyInputs.map((input) => {
        if (input.id !== id) return input;

        const updated = { ...input, [field]: value };

        if (field === "fuelType") {
          const fuelType = FUEL_TYPES.find((f) => f.value === value);
          if (fuelType) {
            updated.consumptionUnit = fuelType.defaultUnit;
          }
          const factor = emissionFactors[value as string];
          if (factor) {
            updated.emissionFactorUsed = factor.co2e_factor;
            updated.emissionFactorYear = factor.factor_year;
          }
        }

        if (field === "consumptionValue" || field === "fuelType") {
          const consumption = parseFloat(field === "consumptionValue" ? (value as string) : updated.consumptionValue) || 0;
          const factor = emissionFactors[updated.fuelType];
          if (factor) {
            updated.calculatedCo2e = consumption * factor.co2e_factor;
            updated.emissionFactorUsed = factor.co2e_factor;
          }
        }

        return updated;
      })
    );
  };

  const validateForm = (): string | null => {
    if (!reportingPeriodStart || !reportingPeriodEnd) {
      return "Please select a reporting period";
    }
    if (new Date(reportingPeriodEnd) <= new Date(reportingPeriodStart)) {
      return "End date must be after start date";
    }
    if (!totalFacilityProductionVolume || parseFloat(totalFacilityProductionVolume) <= 0) {
      return "Please enter the total facility production volume";
    }
    if (co2eEntryMethod === "direct" && (!directCo2eValue || parseFloat(directCo2eValue) < 0)) {
      return "Please enter the total facility CO2e";
    }
    if (co2eEntryMethod === "calculated_from_energy" && energyInputs.length === 0) {
      return "Please add at least one energy input";
    }
    if (!clientProductionVolume || parseFloat(clientProductionVolume) <= 0) {
      return "Please enter the client production volume";
    }
    if (parseFloat(clientProductionVolume) > parseFloat(totalFacilityProductionVolume)) {
      return "Client production volume cannot exceed total facility production";
    }
    if (isEnergyIntensiveProcess && !energyIntensiveNotes.trim()) {
      return "Please explain the energy-intensive processes";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const allocationData = {
        organization_id: organizationId,
        product_id: productId,
        facility_id: facilityId,
        supplier_id: supplierId || null,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        total_facility_production_volume: parseFloat(totalFacilityProductionVolume),
        production_volume_unit: productionVolumeUnit,
        total_facility_co2e_kg: totalFacilityCo2e,
        co2e_entry_method: co2eEntryMethod,
        emission_factor_year: emissionFactorYear,
        emission_factor_source: "DEFRA",
        client_production_volume: parseFloat(clientProductionVolume),
        is_energy_intensive_process: isEnergyIntensiveProcess,
        energy_intensive_notes: isEnergyIntensiveProcess ? energyIntensiveNotes : null,
        created_by: user?.id,
        data_quality_score: co2eEntryMethod === "calculated_from_energy" ? 4 : 3,
        locked_at: new Date().toISOString(),
      };

      const { data: allocation, error: allocationError } = await supabase
        .from("contract_manufacturer_allocations")
        .insert(allocationData)
        .select()
        .single();

      if (allocationError) throw allocationError;

      if (co2eEntryMethod === "calculated_from_energy" && energyInputs.length > 0) {
        const energyInputsData = energyInputs.map((input) => ({
          allocation_id: allocation.id,
          fuel_type: input.fuelType,
          consumption_value: parseFloat(input.consumptionValue),
          consumption_unit: input.consumptionUnit,
          emission_factor_used: input.emissionFactorUsed,
          emission_factor_unit: `kgCO2e/${input.consumptionUnit}`,
          emission_factor_year: input.emissionFactorYear,
          emission_factor_source: "DEFRA",
          calculated_co2e_kg: input.calculatedCo2e,
        }));

        const { error: energyError } = await supabase
          .from("contract_manufacturer_energy_inputs")
          .insert(energyInputsData);

        if (energyError) throw energyError;
      }

      const statusMessage = isEnergyIntensiveProcess
        ? "Allocation saved as Provisional - pending verification"
        : "Allocation saved and verified";

      toast.success(statusMessage);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving allocation:", error);
      toast.error(error.message || "Failed to save allocation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200">
          This is a <strong>time-bound snapshot</strong>. Each reporting period creates a separate,
          locked record. Data from different years uses the appropriate emission factors for temporal accuracy.
        </AlertDescription>
      </Alert>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-lime-400" />
            Reporting Period
          </CardTitle>
          <CardDescription>
            Define the time period this allocation covers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodStart">Start Date</Label>
              <Input
                id="periodStart"
                type="date"
                value={reportingPeriodStart}
                onChange={(e) => setReportingPeriodStart(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="periodEnd">End Date</Label>
              <Input
                id="periodEnd"
                type="date"
                value={reportingPeriodEnd}
                onChange={(e) => setReportingPeriodEnd(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Factory className="h-5 w-5 text-lime-400" />
            Input A: Total Facility Production
          </CardTitle>
          <CardDescription>
            Total production volume across ALL products at {facilityName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalVolume">Total Production Volume</Label>
              <Input
                id="totalVolume"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 1000000"
                value={totalFacilityProductionVolume}
                onChange={(e) => setTotalFacilityProductionVolume(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <Label htmlFor="volumeUnit">Unit</Label>
              <Select value={productionVolumeUnit} onValueChange={setProductionVolumeUnit}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="h-5 w-5 text-lime-400" />
            Input B: Facility Energy & Emissions
          </CardTitle>
          <CardDescription>
            Total CO2e emissions from the facility during this period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={co2eEntryMethod} onValueChange={(v) => setCo2eEntryMethod(v as "direct" | "calculated_from_energy")}>
            <TabsList className="grid w-full grid-cols-2 bg-slate-800">
              <TabsTrigger value="direct">Direct CO2e Entry</TabsTrigger>
              <TabsTrigger value="calculated_from_energy">Raw Energy Data</TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="space-y-4 pt-4">
              <div>
                <Label htmlFor="directCo2e">Total Facility CO2e (kg)</Label>
                <Input
                  id="directCo2e"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 50000"
                  value={directCo2eValue}
                  onChange={(e) => setDirectCo2eValue(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter the total CO2e if already calculated
                </p>
              </div>
            </TabsContent>

            <TabsContent value="calculated_from_energy" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Emission Factor Year</Label>
                  <Select
                    value={emissionFactorYear.toString()}
                    onValueChange={(v) => setEmissionFactorYear(parseInt(v))}
                  >
                    <SelectTrigger className="w-32 bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2023, 2022].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          DEFRA {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={addEnergyInput}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Energy Source
                </Button>
              </div>

              {energyInputs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No energy sources added. Click "Add Energy Source" to begin.
                </div>
              ) : (
                <div className="space-y-3">
                  {energyInputs.map((input) => (
                    <Card key={input.id} className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-4">
                            <Label className="text-xs">Fuel Type</Label>
                            <Select
                              value={input.fuelType}
                              onValueChange={(v) => updateEnergyInput(input.id, "fuelType", v)}
                            >
                              <SelectTrigger className="bg-slate-900 border-slate-600">
                                <SelectValue placeholder="Select fuel" />
                              </SelectTrigger>
                              <SelectContent>
                                {FUEL_TYPES.map((fuel) => (
                                  <SelectItem key={fuel.value} value={fuel.value}>
                                    {fuel.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Consumption</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={input.consumptionValue}
                              onChange={(e) => updateEnergyInput(input.id, "consumptionValue", e.target.value)}
                              className="bg-slate-900 border-slate-600"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unit</Label>
                            <Input
                              value={input.consumptionUnit}
                              disabled
                              className="bg-slate-900 border-slate-600"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">CO2e (kg)</Label>
                            <div className="h-10 px-3 flex items-center bg-slate-900 border border-slate-600 rounded-md text-lime-400 font-mono">
                              {input.calculatedCo2e.toFixed(2)}
                            </div>
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEnergyInput(input.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {input.emissionFactorUsed > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Factor: {input.emissionFactorUsed} kgCO2e/{input.consumptionUnit} (DEFRA {input.emissionFactorYear})
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {energyInputs.length > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total Facility CO2e</p>
                    <p className="text-xl font-bold text-lime-400 font-mono">
                      {totalFacilityCo2e.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calculator className="h-5 w-5 text-lime-400" />
            Input C: Client Production Volume
          </CardTitle>
          <CardDescription>
            Volume produced specifically for this product at the facility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientVolume">Client Production Volume</Label>
              <Input
                id="clientVolume"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 100000"
                value={clientProductionVolume}
                onChange={(e) => setClientProductionVolume(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={PRODUCTION_UNITS.find((u) => u.value === productionVolumeUnit)?.label || productionVolumeUnit}
                disabled
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>

          {parseFloat(clientProductionVolume) > parseFloat(totalFacilityProductionVolume) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Client volume cannot exceed total facility production
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="bg-amber-900/20 border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <AlertCircle className="h-5 w-5" />
            Energy-Intensive Process Flag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="energyIntensive"
              checked={isEnergyIntensiveProcess}
              onCheckedChange={(checked) => setIsEnergyIntensiveProcess(checked as boolean)}
            />
            <div>
              <Label htmlFor="energyIntensive" className="text-amber-100">
                This production required energy-intensive processes
              </Label>
              <p className="text-xs text-amber-200/70 mt-1">
                Check if processes like distillation, heating, or sterilisation were used that are not typical
                for other products at this facility
              </p>
            </div>
          </div>

          {isEnergyIntensiveProcess && (
            <>
              <Textarea
                placeholder="Describe the energy-intensive processes used..."
                value={energyIntensiveNotes}
                onChange={(e) => setEnergyIntensiveNotes(e.target.value)}
                className="bg-amber-950/50 border-amber-500/30"
              />
              <Alert className="bg-amber-500/10 border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-amber-200">
                  This entry will be marked as <strong>Provisional</strong> pending verification.
                  You will not be able to generate final reports until an admin reviews this allocation.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-lime-900/20 border-lime-500/30">
        <CardHeader>
          <CardTitle className="text-lime-200">Calculation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400">Attribution Ratio</p>
              <p className="text-2xl font-bold text-white font-mono">
                {(attributionRatio * 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Facility CO2e</p>
              <p className="text-2xl font-bold text-white font-mono">
                {totalFacilityCo2e.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Allocated Emissions</p>
              <p className="text-2xl font-bold text-lime-400 font-mono">
                {allocatedEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Emission Intensity</p>
              <p className="text-2xl font-bold text-lime-400 font-mono">
                {emissionIntensity.toFixed(4)}
              </p>
              <p className="text-xs text-slate-500">kg CO2e / {productionVolumeUnit}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-slate-300">
                  {co2eEntryMethod === "direct" ? "Direct Entry" : "Calculated from Energy"}
                </Badge>
                <Badge variant="outline" className="text-slate-300">
                  DEFRA {emissionFactorYear}
                </Badge>
                <Badge className={isEnergyIntensiveProcess ? "bg-amber-500/20 text-amber-300" : "bg-lime-500/20 text-lime-300"}>
                  {isEnergyIntensiveProcess ? "Provisional" : "Verified"}
                </Badge>
              </div>
              <Badge className="bg-blue-500/20 text-blue-300">
                Primary - Allocated
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-4">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || attributionRatio > 1}
          className="bg-lime-500 hover:bg-lime-600 text-black"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" />
              Save Allocation Snapshot
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
