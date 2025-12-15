"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Building2,
  Calendar,
  Factory,
  Info,
  Loader2,
  Percent,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface OwnedFacilityProductionFormProps {
  productId: number;
  facilityId: string;
  facilityName: string;
  organizationId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PRODUCTION_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "cases", label: "Cases" },
  { value: "pallets", label: "Pallets" },
];

export function OwnedFacilityProductionForm({
  productId,
  facilityId,
  facilityName,
  organizationId,
  onSuccess,
  onCancel,
}: OwnedFacilityProductionFormProps) {
  const supabase = getSupabaseBrowserClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingFacilityData, setLoadingFacilityData] = useState(false);

  const currentYear = new Date().getFullYear();
  const [reportingPeriodStart, setReportingPeriodStart] = useState("");
  const [reportingPeriodEnd, setReportingPeriodEnd] = useState("");

  const [facilityTotalEmissions, setFacilityTotalEmissions] = useState<number | null>(null);
  const [emissionFactorYear, setEmissionFactorYear] = useState(currentYear);

  const [productVolume, setProductVolume] = useState("");
  const [productVolumeUnit, setProductVolumeUnit] = useState("units");
  const [totalFacilityVolume, setTotalFacilityVolume] = useState("");

  useEffect(() => {
    if (reportingPeriodStart && reportingPeriodEnd) {
      loadFacilityEmissions();
    }
  }, [reportingPeriodStart, reportingPeriodEnd, facilityId]);

  const loadFacilityEmissions = async () => {
    setLoadingFacilityData(true);
    try {
      // First try exact match
      let { data, error } = await supabase
        .from("facility_emissions_aggregated")
        .select("total_co2e, total_production_volume, volume_unit, reporting_period_start, reporting_period_end")
        .eq("facility_id", facilityId)
        .eq("reporting_period_start", reportingPeriodStart)
        .eq("reporting_period_end", reportingPeriodEnd)
        .maybeSingle();

      // If no exact match, try overlapping periods
      if (!data && !error) {
        const result = await supabase
          .from("facility_emissions_aggregated")
          .select("total_co2e, total_production_volume, volume_unit, reporting_period_start, reporting_period_end")
          .eq("facility_id", facilityId)
          .lte("reporting_period_start", reportingPeriodEnd)
          .gte("reporting_period_end", reportingPeriodStart)
          .order("reporting_period_start", { ascending: false })
          .limit(1)
          .maybeSingle();

        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (data) {
        setFacilityTotalEmissions(data.total_co2e);

        // Auto-populate Total Facility Output if available
        if (data.total_production_volume && data.volume_unit) {
          setTotalFacilityVolume(data.total_production_volume.toString());
          // Map the volume_unit from the database to the select options
          const unitMapping: Record<string, string> = {
            'Litres': 'litres',
            'Hectolitres': 'litres',
            'Units': 'units',
            'kg': 'kg',
          };
          const mappedUnit = unitMapping[data.volume_unit] || 'litres';
          setProductVolumeUnit(mappedUnit);
          toast.success(`Found facility data: ${data.total_co2e.toLocaleString()} kg CO2e, ${data.total_production_volume.toLocaleString()} ${data.volume_unit}`);
        } else {
          toast.success(`Found facility emissions data: ${data.total_co2e.toLocaleString()} kg CO2e`);
        }
      } else {
        setFacilityTotalEmissions(null);
        setTotalFacilityVolume("");
        toast.info("No facility emissions data found for this period. You'll need to enter it manually.");
      }
    } catch (error: any) {
      console.error("Error loading facility emissions:", error);
      toast.error("Could not load facility emissions data");
    } finally {
      setLoadingFacilityData(false);
    }
  };

  const allocationPercentage = useMemo(() => {
    const prodVol = parseFloat(productVolume) || 0;
    const totalVol = parseFloat(totalFacilityVolume) || 0;
    if (totalVol <= 0) return 0;
    return (prodVol / totalVol) * 100;
  }, [productVolume, totalFacilityVolume]);

  const allocatedEmissions = useMemo(() => {
    if (!facilityTotalEmissions) return 0;
    return (facilityTotalEmissions * allocationPercentage) / 100;
  }, [facilityTotalEmissions, allocationPercentage]);

  const emissionIntensity = useMemo(() => {
    const volume = parseFloat(productVolume) || 0;
    if (volume <= 0) return 0;
    return allocatedEmissions / volume;
  }, [allocatedEmissions, productVolume]);

  const validateForm = (): string | null => {
    if (!reportingPeriodStart || !reportingPeriodEnd) {
      return "Please select a reporting period";
    }
    if (new Date(reportingPeriodEnd) <= new Date(reportingPeriodStart)) {
      return "End date must be after start date";
    }
    if (!facilityTotalEmissions || facilityTotalEmissions <= 0) {
      return "Facility total emissions data is required";
    }
    if (!productVolume || parseFloat(productVolume) <= 0) {
      return "Please enter the product volume";
    }
    if (!totalFacilityVolume || parseFloat(totalFacilityVolume) <= 0) {
      return "Please enter the total facility volume";
    }
    if (parseFloat(productVolume) > parseFloat(totalFacilityVolume)) {
      return "Product volume cannot exceed total facility volume";
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
      // First, find or create the product_lca for this product
      let { data: productLCA, error: lcaError } = await supabase
        .from("product_lcas")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

      if (lcaError) throw lcaError;

      // If no LCA exists for this product, create one
      if (!productLCA) {
        const { data: newLCA, error: createError } = await supabase
          .from("product_lcas")
          .insert({
            product_id: productId,
            organization_id: organizationId,
            status: "draft",
            methodology: "ISO 14067",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        productLCA = newLCA;
      }

      // Prepare the production site data matching the actual table schema
      const productionSiteData = {
        product_lca_id: productLCA.id,
        facility_id: facilityId,
        organization_id: organizationId,
        production_volume: parseFloat(productVolume),
        data_source: "Verified",
      };

      const { error: siteError } = await supabase
        .from("product_lca_production_sites")
        .insert(productionSiteData);

      if (siteError) throw siteError;

      toast.success("Production site linked successfully");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving production site:", error);
      toast.error(error.message || "Failed to save production site");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200">
          <strong>Owned Facility Allocation:</strong> This facility is under your operational control.
          Emissions will be allocated based on the proportion of this product's volume to total facility output.
        </AlertDescription>
      </Alert>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-blue-400" />
            Reporting Period
          </CardTitle>
          <CardDescription>
            Select the time period for this production data
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

          {loadingFacilityData && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading facility emissions data...
            </div>
          )}

          {facilityTotalEmissions !== null && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <Factory className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200">
                <strong>Facility Total Emissions:</strong> {facilityTotalEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO2e
                <div className="text-xs text-green-300 mt-1">
                  Data from facility emissions records (Scope 1 & 2)
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {facilityTotalEmissions === null && reportingPeriodStart && reportingPeriodEnd && (
        <Card className="bg-amber-900/20 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <AlertCircle className="h-5 w-5" />
              Manual Entry Required
            </CardTitle>
            <CardDescription>
              No facility emissions data found for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="manualEmissions">Facility Total Emissions (kg CO2e)</Label>
              <Input
                id="manualEmissions"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 100000"
                value={facilityTotalEmissions || ""}
                onChange={(e) => setFacilityTotalEmissions(parseFloat(e.target.value) || null)}
                className="bg-slate-800 border-slate-700"
              />
              <p className="text-xs text-slate-400 mt-1">
                Enter the total Scope 1 & 2 emissions for {facilityName} during this period
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-blue-400" />
            Production Volumes
          </CardTitle>
          <CardDescription>
            Enter production data to calculate allocation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium text-white">This Product</Label>
              <p className="text-xs text-slate-400 mb-2">Volume of this specific product manufactured</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="productVolume">Volume</Label>
                  <Input
                    id="productVolume"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g., 50000"
                    value={productVolume}
                    onChange={(e) => setProductVolume(e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label htmlFor="productUnit">Unit</Label>
                  <Select value={productVolumeUnit} onValueChange={setProductVolumeUnit}>
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
            </div>

            <div className="pt-4 border-t border-slate-700">
              <Label className="text-base font-medium text-white">Total Facility Output</Label>
              <p className="text-xs text-slate-400 mb-2">
                {totalFacilityVolume
                  ? "Auto-filled from facility production data"
                  : "Total volume of all products at this facility (same units)"}
              </p>
              <div>
                <Label htmlFor="totalVolume">Total Volume ({productVolumeUnit})</Label>
                <Input
                  id="totalVolume"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 200000"
                  value={totalFacilityVolume}
                  onChange={(e) => setTotalFacilityVolume(e.target.value)}
                  disabled={!!totalFacilityVolume && facilityTotalEmissions !== null}
                  className={`bg-slate-800 border-slate-700 ${totalFacilityVolume && facilityTotalEmissions !== null ? 'opacity-75 cursor-not-allowed' : ''}`}
                />
                <p className="text-xs text-slate-400 mt-1">
                  {totalFacilityVolume && facilityTotalEmissions !== null
                    ? "Value loaded from facility emissions data"
                    : "Include all products manufactured at this facility during the period"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {allocationPercentage > 0 && (
        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-200">
              <TrendingUp className="h-5 w-5" />
              Allocation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-blue-400" />
                  <p className="text-xs text-slate-400">Allocation %</p>
                </div>
                <p className="text-3xl font-bold text-blue-400 font-mono">
                  {allocationPercentage.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  of facility emissions
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Factory className="h-4 w-4 text-white" />
                  <p className="text-xs text-slate-400">Allocated Emissions</p>
                </div>
                <p className="text-3xl font-bold text-white font-mono">
                  {allocatedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  kg CO2e total
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-lime-400" />
                  <p className="text-xs text-slate-400">Emission Intensity</p>
                </div>
                <p className="text-3xl font-bold text-lime-400 font-mono">
                  {emissionIntensity.toFixed(4)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  kg CO2e / {productVolumeUnit}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-slate-400">Calculation Method:</p>
                  <p className="text-white font-medium">Production Volume Allocation</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge className="bg-blue-500/20 text-blue-300">Scope 1 & 2</Badge>
                  <Badge className="bg-green-500/20 text-green-300">Owned Facility</Badge>
                  <Badge variant="outline" className="text-slate-300">DEFRA {emissionFactorYear}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !facilityTotalEmissions || allocationPercentage === 0}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              Link Production Site
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
