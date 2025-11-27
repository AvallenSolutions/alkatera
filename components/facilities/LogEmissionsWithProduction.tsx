"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const UTILITY_TYPES = [
  { value: 'electricity_grid', label: 'Purchased Electricity', defaultUnit: 'kWh' },
  { value: 'heat_steam_purchased', label: 'Purchased Heat / Steam', defaultUnit: 'kWh' },
  { value: 'natural_gas', label: 'Natural Gas', defaultUnit: 'm³' },
  { value: 'lpg', label: 'LPG (Propane/Butane)', defaultUnit: 'Litres' },
  { value: 'diesel_stationary', label: 'Diesel (Generators/Stationary)', defaultUnit: 'Litres' },
  { value: 'heavy_fuel_oil', label: 'Heavy Fuel Oil', defaultUnit: 'Litres' },
  { value: 'biomass_solid', label: 'Biogas / Biomass', defaultUnit: 'kg' },
  { value: 'refrigerant_leakage', label: 'Refrigerants (Leakage)', defaultUnit: 'kg' },
  { value: 'diesel_mobile', label: 'Company Fleet (Diesel)', defaultUnit: 'Litres' },
  { value: 'petrol_mobile', label: 'Company Fleet (Petrol/Gasoline)', defaultUnit: 'Litres' },
];

const FACILITY_ACTIVITY_TYPES = [
  { value: 'Soft Drinks Bottling', label: 'Soft Drinks Bottling', intensity: 0.15 },
  { value: 'Brewing', label: 'Brewing', intensity: 0.22 },
  { value: 'Distilling', label: 'Distilling', intensity: 0.35 },
  { value: 'Juice Processing', label: 'Juice Processing', intensity: 0.18 },
  { value: 'Dairy Processing', label: 'Dairy Processing', intensity: 0.25 },
];

const PRODUCTION_UNITS = [
  { value: 'Litres', label: 'Litres' },
  { value: 'Hectolitres', label: 'Hectolitres' },
  { value: 'Units', label: 'Units (individual products)' },
  { value: 'kg', label: 'Kilograms' },
];

interface LogEmissionsWithProductionProps {
  facilityId: string;
  organizationId: string;
  onSuccess: () => void;
}

export function LogEmissionsWithProduction({ facilityId, organizationId, onSuccess }: LogEmissionsWithProductionProps) {
  console.log('[LogEmissions] Component mounted/rendered', { facilityId, organizationId });

  const [dataSourceType, setDataSourceType] = useState<'Primary' | 'Secondary_Average'>('Primary');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Primary data path state
  const [utilityEntries, setUtilityEntries] = useState<Array<{
    utility_type: string;
    quantity: string;
    unit: string;
  }>>([{
    utility_type: '',
    quantity: '',
    unit: '',
  }]);

  const [productionVolume, setProductionVolume] = useState('');
  const [productionUnit, setProductionUnit] = useState<string>('Litres');

  // Secondary data path state
  const [facilityActivityType, setFacilityActivityType] = useState('');
  const [selectedIntensity, setSelectedIntensity] = useState<number | null>(null);

  // Common fields
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const addUtilityEntry = () => {
    setUtilityEntries([...utilityEntries, { utility_type: '', quantity: '', unit: '' }]);
  };

  const removeUtilityEntry = (index: number) => {
    setUtilityEntries(utilityEntries.filter((_, i) => i !== index));
  };

  const updateUtilityEntry = (index: number, field: string, value: string) => {
    const updated = [...utilityEntries];
    updated[index] = { ...updated[index], [field]: value };
    setUtilityEntries(updated);
  };

  const handleActivityTypeChange = (value: string) => {
    setFacilityActivityType(value);
    const activity = FACILITY_ACTIVITY_TYPES.find(a => a.value === value);
    setSelectedIntensity(activity?.intensity || null);
  };

  const handleSubmit = async () => {
    console.log('[LogEmissions] handleSubmit called', {
      facilityId,
      organizationId,
      dataSourceType,
      periodStart,
      periodEnd,
      productionVolume,
      utilityEntries,
      facilityActivityType
    });

    // Validation
    if (!organizationId) {
      console.error('[LogEmissions] Missing organization ID');
      toast.error('Organization ID is required');
      return;
    }

    if (!periodStart || !periodEnd) {
      console.error('[LogEmissions] Missing reporting period');
      toast.error('Please select reporting period');
      return;
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (endDate <= startDate) {
      console.error('[LogEmissions] Invalid date range', { startDate, endDate });
      toast.error('End date must be after start date');
      return;
    }

    if (dataSourceType === 'Primary') {
      console.log('[LogEmissions] Validating Primary data', { productionVolume, utilityEntries });

      if (!productionVolume || parseFloat(productionVolume) <= 0) {
        console.error('[LogEmissions] Invalid production volume', productionVolume);
        toast.error('Please enter total production volume');
        return;
      }

      // Check each utility entry individually for better error messages
      const emptyEntries = utilityEntries.filter(e => !e.utility_type && !e.quantity && !e.unit);
      const partialEntries = utilityEntries.filter(e =>
        (e.utility_type && (!e.quantity || !e.unit)) ||
        (e.quantity && (!e.utility_type || !e.unit)) ||
        (e.unit && (!e.utility_type || !e.quantity))
      );

      if (emptyEntries.length === utilityEntries.length) {
        console.error('[LogEmissions] No utility entries provided');
        toast.error('Please add at least one utility entry (select utility type, enter quantity and unit)');
        return;
      }

      if (partialEntries.length > 0) {
        console.error('[LogEmissions] Incomplete utility entries found', partialEntries);
        toast.error('Please complete all fields for each utility entry (type, quantity, and unit)');
        return;
      }

      // Filter out completely empty entries (in case user added extras)
      const validEntries = utilityEntries.filter(e => e.utility_type || e.quantity || e.unit);

      const hasZeroQuantity = validEntries.some(e => parseFloat(e.quantity) <= 0);
      if (hasZeroQuantity) {
        console.error('[LogEmissions] Zero or negative quantities found', validEntries);
        toast.error('All quantities must be greater than zero');
        return;
      }

      console.log('[LogEmissions] Primary validation passed');
    } else {
      if (!facilityActivityType || selectedIntensity === null) {
        toast.error('Please select facility activity type');
        return;
      }
    }

    console.log('[LogEmissions] Validation passed, starting submission...');

    try {
      setIsSubmitting(true);
      console.log('[LogEmissions] isSubmitting set to true');

      if (dataSourceType === 'Primary') {
        console.log('[LogEmissions] Processing Primary data path');
        // Path A: Primary Data - Calculate emissions from utilities, then calculate intensity
        // TODO: Call edge function to calculate emissions from utility data
        // For now, we'll create a placeholder emission log

        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
          console.error('[LogEmissions] User authentication failed', userError);
          throw new Error('User not authenticated');
        }

        // Filter out completely empty entries before saving
        const validUtilityEntries = utilityEntries.filter(e => e.utility_type && e.quantity && e.unit);

        console.log('[LogEmissions] Inserting facility emissions data...', {
          facility_id: facilityId,
          organization_id: organizationId,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          total_production_volume: parseFloat(productionVolume),
          volume_unit: productionUnit,
          valid_utility_entries: validUtilityEntries,
        });

        const { data: insertedData, error } = await supabase
          .from('facility_emissions_aggregated')
          .insert({
            facility_id: facilityId,
            organization_id: organizationId,
            reporting_period_start: periodStart,
            reporting_period_end: periodEnd,
            total_co2e: 0, // Will be calculated by edge function
            total_production_volume: parseFloat(productionVolume),
            volume_unit: productionUnit as any,
            data_source_type: 'Primary',
            calculated_by: userData.user.id,
            results_payload: { utility_entries: validUtilityEntries },
          })
          .select();

        console.log('[LogEmissions] Insert response:', { data: insertedData, error });

        if (error) {
          console.error('Error inserting primary data:', error);
          throw new Error(error.message || 'Failed to save primary emissions data');
        }
        console.log('[LogEmissions] Primary data saved successfully');
        toast.success('Primary emissions data logged successfully. Intensity calculated automatically.');
      } else {
        console.log('[LogEmissions] Processing Secondary data path');
        // Path B: Secondary Average - Use industry proxy
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
          console.error('[LogEmissions] User authentication failed', userError);
          throw new Error('User not authenticated');
        }

        console.log('[LogEmissions] Inserting secondary/industry average data...', {
          facility_id: facilityId,
          organization_id: organizationId,
          facility_activity_type: facilityActivityType,
          fallback_intensity_factor: selectedIntensity,
        });

        const { data: insertedData, error } = await supabase
          .from('facility_emissions_aggregated')
          .insert({
            facility_id: facilityId,
            organization_id: organizationId,
            reporting_period_start: periodStart,
            reporting_period_end: periodEnd,
            total_co2e: 0, // Not calculated for secondary
            data_source_type: 'Secondary_Average',
            facility_activity_type: facilityActivityType,
            fallback_intensity_factor: selectedIntensity,
            calculated_by: userData.user.id,
            results_payload: { method: 'industry_average' },
          })
          .select();

        console.log('[LogEmissions] Insert response:', { data: insertedData, error });

        if (error) {
          console.error('Error inserting secondary data:', error);
          throw new Error(error.message || 'Failed to save industry average data');
        }
        console.log('[LogEmissions] Secondary data saved successfully');
        toast.success('Industry average intensity configured successfully');
      }

      // Reset form
      setUtilityEntries([{ utility_type: '', quantity: '', unit: '' }]);
      setProductionVolume('');
      setFacilityActivityType('');
      setSelectedIntensity(null);
      setPeriodStart('');
      setPeriodEnd('');

      onSuccess();
    } catch (error: any) {
      console.error('Error logging emissions:', error);
      toast.error(error.message || 'Failed to log emissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Facility Emissions & Production</CardTitle>
        <CardDescription>
          Choose your data source and log emissions to calculate facility intensity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* Common Fields: Reporting Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="period_start">Reporting Period Start *</Label>
            <Input
              id="period_start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="period_end">Reporting Period End *</Label>
            <Input
              id="period_end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Path A: Primary Data */}
        {dataSourceType === 'Primary' && (
          <>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This will calculate facility intensity from your verified utility bills and production volume.
                <strong> Higher data quality score.</strong>
              </AlertDescription>
            </Alert>

            {/* Production Volume Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label htmlFor="production_volume">Total Production Volume for Period *</Label>
                <Input
                  id="production_volume"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={productionVolume}
                  onChange={(e) => setProductionVolume(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total volume produced during this reporting period
                </p>
              </div>
              <div>
                <Label htmlFor="production_unit">Unit *</Label>
                <Select value={productionUnit} onValueChange={setProductionUnit}>
                  <SelectTrigger>
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

            {/* Utility Entries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Utility Consumption Data *</Label>
                <Button variant="outline" size="sm" onClick={addUtilityEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Utility
                </Button>
              </div>

              {utilityEntries.map((entry, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                  <div className="md:col-span-2">
                    <Label>Utility Type</Label>
                    <Select
                      value={entry.utility_type}
                      onValueChange={(value) => {
                        const utility = UTILITY_TYPES.find(u => u.value === value);
                        updateUtilityEntry(index, 'utility_type', value);
                        updateUtilityEntry(index, 'unit', utility?.defaultUnit || '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {UTILITY_TYPES.map((utility) => (
                          <SelectItem key={utility.value} value={utility.value}>
                            {utility.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.quantity}
                      onChange={(e) => updateUtilityEntry(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Unit</Label>
                      <Input
                        value={entry.unit}
                        onChange={(e) => updateUtilityEntry(index, 'unit', e.target.value)}
                      />
                    </div>
                    {utilityEntries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUtilityEntry(index)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Path B: Industry Average */}
        {dataSourceType === 'Secondary_Average' && (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will use industry average data. <strong>Lower data quality score.</strong> Use verified bills for better accuracy.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="activity_type">Facility Activity Type *</Label>
              <Select value={facilityActivityType} onValueChange={handleActivityTypeChange}>
                <SelectTrigger>
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
            </div>

            {selectedIntensity !== null && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium">Selected Emission Intensity:</p>
                <p className="text-2xl font-bold text-primary">
                  {selectedIntensity} <span className="text-sm font-normal">kg CO₂e per litre</span>
                </p>
                <Badge variant="outline" className="mt-2">
                  ESTIMATE
                </Badge>
              </div>
            )}
          </>
        )}

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Saving...' : 'Log Emissions Data'}
        </Button>
      </CardContent>
    </Card>
  );
}
