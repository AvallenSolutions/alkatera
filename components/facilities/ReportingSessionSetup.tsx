"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card as AlertCard, CardContent as AlertCardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Calendar, Package } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const PRODUCTION_UNITS = [
  { value: "Litres", label: "Litres" },
  { value: "Hectolitres", label: "Hectolitres" },
  { value: "Units", label: "Units (individual products)" },
  { value: "kg", label: "Kilograms" },
];

const FACILITY_ACTIVITY_TYPES = [
  { value: "Soft Drinks Bottling", label: "Soft Drinks Bottling", intensity: 0.15 },
  { value: "Brewing", label: "Brewing", intensity: 0.22 },
  { value: "Distilling", label: "Distilling", intensity: 0.35 },
  { value: "Juice Processing", label: "Juice Processing", intensity: 0.18 },
  { value: "Dairy Processing", label: "Dairy Processing", intensity: 0.25 },
];

interface ReportingSessionSetupProps {
  facilityId: string;
  organizationId: string;
  onSessionCreated: (sessionId: string) => void;
}

export function ReportingSessionSetup({
  facilityId,
  organizationId,
  onSessionCreated,
}: ReportingSessionSetupProps) {
  const [dataSourceType, setDataSourceType] = useState<"Primary" | "Secondary_Average">("Primary");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [productionVolume, setProductionVolume] = useState("");
  const [productionUnit, setProductionUnit] = useState("Litres");
  const [facilityActivityType, setFacilityActivityType] = useState("");
  const [selectedIntensity, setSelectedIntensity] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivityTypeChange = (value: string) => {
    setFacilityActivityType(value);
    const activity = FACILITY_ACTIVITY_TYPES.find((a) => a.value === value);
    setSelectedIntensity(activity?.intensity || null);
  };

  const validateForm = (): string | null => {
    if (!periodStart || !periodEnd) {
      return "Please select a reporting period";
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (endDate <= startDate) {
      return "End date must be after start date";
    }

    if (dataSourceType === "Primary") {
      if (!productionVolume || parseFloat(productionVolume) <= 0) {
        return "Please enter a valid production volume";
      }
    } else {
      if (!facilityActivityType || selectedIntensity === null) {
        return "Please select a facility activity type";
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("User not authenticated");
      }

      const { data, error: insertError } = await supabase
        .from("facility_reporting_sessions")
        .insert({
          facility_id: facilityId,
          organization_id: organizationId,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          total_production_volume: dataSourceType === "Primary" ? parseFloat(productionVolume) : 0,
          volume_unit: productionUnit,
          data_source_type: dataSourceType,
          facility_activity_type: dataSourceType === "Secondary_Average" ? facilityActivityType : null,
          fallback_intensity_factor: dataSourceType === "Secondary_Average" ? selectedIntensity : null,
          created_by: userData.user.id,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      toast.success("Reporting session created successfully");
      onSessionCreated(data.id);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create reporting session";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set Up Reporting Session</CardTitle>
          <CardDescription>
            Define the reporting period and production data once. Then add multiple utility entries to this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Data Source Toggle */}
          <div>
            <Label className="mb-2 block">Data Source Type</Label>
            <Tabs value={dataSourceType} onValueChange={(v) => setDataSourceType(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Primary">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verified Bills (Primary)
                </TabsTrigger>
                <TabsTrigger value="Secondary_Average">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Industry Average (Estimated)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Reporting Period */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4" />
              <Label className="text-base font-semibold">Reporting Period *</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="period_start">Start Date</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="period_end">End Date</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Primary Data Path */}
          {dataSourceType === "Primary" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                <Label className="text-base font-semibold">Production Volume for Period *</Label>
              </div>
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Enter the total production volume for this facility during the reporting period. You can then add detailed utility consumption data for each energy source.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="production_volume">Volume</Label>
                  <Input
                    id="production_volume"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productionVolume}
                    onChange={(e) => setProductionVolume(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="production_unit">Unit</Label>
                  <Select value={productionUnit} onValueChange={setProductionUnit} disabled={isSubmitting}>
                    <SelectTrigger id="production_unit">
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
          )}

          {/* Secondary Data Path */}
          {dataSourceType === "Secondary_Average" && (
            <div>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will use industry average data. Lower data quality score. Use verified bills for better accuracy.
                </AlertDescription>
              </Alert>
              <Label htmlFor="activity_type">Facility Activity Type *</Label>
              <Select value={facilityActivityType} onValueChange={handleActivityTypeChange} disabled={isSubmitting}>
                <SelectTrigger id="activity_type">
                  <SelectValue placeholder="Select activity type..." />
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_ACTIVITY_TYPES.map((activity) => (
                    <SelectItem key={activity.value} value={activity.value}>
                      {activity.label}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({activity.intensity} kg CO₂e/litre)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedIntensity !== null && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium">Selected Emission Intensity:</p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedIntensity} <span className="text-sm font-normal">kg CO₂e per litre</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Creating Session..." : "Create Reporting Session"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
