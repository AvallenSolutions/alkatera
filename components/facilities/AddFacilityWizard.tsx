"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, FileCheck, ArrowRight, ArrowLeft, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { COUNTRIES } from "@/lib/countries";
import { LocationPicker, type LocationData } from "@/components/shared/LocationPicker";
import { useFacilityLimit } from "@/hooks/useSubscription";
import { UsageMeterCompact } from "@/components/subscription";

interface AddFacilityWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

interface DataContract {
  utilityType: string;
  frequency: 'monthly' | 'yearly';
  quality: 'actual' | 'estimated';
}

const UTILITY_TYPES = [
  { value: 'electricity_grid', label: 'Purchased Electricity', defaultUnit: 'kWh', scope: 'Scope 2' },
  { value: 'heat_steam_purchased', label: 'Purchased Heat / Steam', defaultUnit: 'kWh', scope: 'Scope 2' },
  { value: 'natural_gas', label: 'Natural Gas', defaultUnit: 'm³', scope: 'Scope 1' },
  { value: 'lpg', label: 'LPG (Propane/Butane)', defaultUnit: 'Litres', scope: 'Scope 1' },
  { value: 'diesel_stationary', label: 'Diesel (Generators/Stationary)', defaultUnit: 'Litres', scope: 'Scope 1' },
  { value: 'heavy_fuel_oil', label: 'Heavy Fuel Oil', defaultUnit: 'Litres', scope: 'Scope 1' },
  { value: 'biomass_solid', label: 'Biogas / Biomass', defaultUnit: 'kg', scope: 'Scope 1' },
  { value: 'refrigerant_leakage', label: 'Refrigerants (Leakage)', defaultUnit: 'kg', scope: 'Scope 1' },
  { value: 'diesel_mobile', label: 'Company Fleet (Diesel)', defaultUnit: 'Litres', scope: 'Scope 1' },
  { value: 'petrol_mobile', label: 'Company Fleet (Petrol/Gasoline)', defaultUnit: 'Litres', scope: 'Scope 1' },
];

const FACILITY_FUNCTIONS = [
  'Brewing',
  'Distillery',
  'Bottling',
  'Canning',
  'Kegging',
  'Warehousing',
  'Distribution',
  'Office',
  'R&D',
  'Quality Control',
];

export function AddFacilityWizard({
  open,
  onOpenChange,
  organizationId,
}: AddFacilityWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentCount, maxCount, isUnlimited, isLoading: isLoadingLimit, checkLimit } = useFacilityLimit();
  const atLimit = !isUnlimited && maxCount != null && currentCount >= maxCount;

  const [operationalControl, setOperationalControl] = useState<'owned' | 'third_party' | null>(null);
  const [facilityName, setFacilityName] = useState('');
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [addressPostcode, setAddressPostcode] = useState('');
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [dataContracts, setDataContracts] = useState<DataContract[]>([]);
  const [selectedUtilityTypes, setSelectedUtilityTypes] = useState<Set<string>>(new Set());

  const handleNext = () => {
    if (step === 1 && !operationalControl) {
      toast.error('Please select who operates this facility');
      return;
    }

    if (step === 2) {
      if (!facilityName.trim()) {
        toast.error('Please enter a facility name');
        return;
      }
      if (selectedFunctions.length === 0) {
        toast.error('Please select at least one function');
        return;
      }
      if (!addressLat || !addressLng || !addressCity || !addressCountry) {
        toast.error('Please select a location using the search');
        return;
      }
    }

    if (step === 3 && dataContracts.length === 0) {
      toast.error('Please select at least one data source');
      return;
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const toggleUtilityType = (utilityType: string) => {
    const newSet = new Set(selectedUtilityTypes);

    if (newSet.has(utilityType)) {
      newSet.delete(utilityType);
      setDataContracts(dataContracts.filter(dc => dc.utilityType !== utilityType));
    } else {
      newSet.add(utilityType);
      setDataContracts([
        ...dataContracts,
        {
          utilityType,
          frequency: 'monthly',
          quality: 'actual',
        }
      ]);
    }

    setSelectedUtilityTypes(newSet);
  };

  const updateDataContract = (utilityType: string, field: 'frequency' | 'quality', value: string) => {
    setDataContracts(dataContracts.map(dc =>
      dc.utilityType === utilityType
        ? { ...dc, [field]: value }
        : dc
    ));
  };

  const toggleFunction = (func: string) => {
    if (selectedFunctions.includes(func)) {
      setSelectedFunctions(selectedFunctions.filter(f => f !== func));
    } else {
      setSelectedFunctions([...selectedFunctions, func]);
    }
  };

  const handleLocationSelect = (location: LocationData) => {
    setLocationSearchValue(location.address);
    setAddressLine1(location.address);
    setAddressCity(location.city || '');
    setAddressCountry(location.countryCode || location.country || '');
    setAddressLat(location.lat);
    setAddressLng(location.lng);
  };

  const handleSubmit = async () => {
    if (!operationalControl) return;

    try {
      setIsSubmitting(true);

      // Server-side limit check before creation
      const limitResult = await checkLimit();
      if (!limitResult.allowed) {
        toast.error(limitResult.reason || 'Facility limit reached. Please upgrade your plan.');
        setIsSubmitting(false);
        return;
      }

      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .insert({
          organization_id: organizationId,
          name: facilityName,
          functions: selectedFunctions,
          operational_control: operationalControl,
          address_line1: addressLine1,
          address_city: addressCity,
          address_country: addressCountry,
          address_postcode: addressPostcode,
          address_lat: addressLat,
          address_lng: addressLng,
          // Also populate new location columns for AWARE water stress assessment
          location_country_code: addressCountry,
          location_address: addressLine1,
          latitude: addressLat,
          longitude: addressLng,
        })
        .select()
        .single();

      if (facilityError) throw facilityError;

      if (dataContracts.length > 0) {
        const contracts = dataContracts.map(dc => ({
          facility_id: facility.id,
          utility_type: dc.utilityType,
          frequency: dc.frequency,
          data_quality: dc.quality,
        }));

        const { error: contractsError } = await supabase
          .from('facility_data_contracts')
          .insert(contracts);

        if (contractsError) throw contractsError;
      }

      toast.success(`Facility "${facilityName}" created successfully`);
      onOpenChange(false);

      router.push(`/company/facilities/${facility.id}`);
    } catch (error: any) {
      console.error('Error creating facility:', error);
      toast.error(error.message || 'Failed to create facility');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">Who operates this facility?</h3>
              <p className="text-sm text-muted-foreground">
                This determines whether emissions are reported in Scope 1 & 2 or Scope 3
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  operationalControl === 'owned' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setOperationalControl('owned')}
              >
                <CardContent className="p-6 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h4 className="font-semibold mb-2">We do (Owned)</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your organization directly operates this facility
                  </p>
                  <Badge variant="secondary">Scope 1 & 2</Badge>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  operationalControl === 'third_party' ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setOperationalControl('third_party')}
              >
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <h4 className="font-semibold mb-2">A Partner (Third-Party)</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Operated by a contractor or partner on your behalf
                  </p>
                  <Badge className="bg-blue-100 text-blue-800">Scope 3</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">Facility Profile</h3>
              <p className="text-sm text-muted-foreground">
                Basic information about this facility
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="facilityName">Facility Name *</Label>
                <Input
                  id="facilityName"
                  placeholder="e.g., London Brewery"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                />
              </div>

              <div>
                <Label>Functions *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select all that apply
                </p>
                <div className="flex flex-wrap gap-2">
                  {FACILITY_FUNCTIONS.map((func) => (
                    <Badge
                      key={func}
                      variant={selectedFunctions.includes(func) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleFunction(func)}
                    >
                      {selectedFunctions.includes(func) && <Check className="h-3 w-3 mr-1" />}
                      {func}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="location">Facility Location *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Search for the city or factory address
                </p>
                <LocationPicker
                  value={locationSearchValue}
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search for city or factory location..."
                  required
                />
                {addressLine1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {addressLine1}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">The Data Contract</h3>
              <p className="text-sm text-muted-foreground">
                What data will this facility provide?
              </p>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {UTILITY_TYPES.map((utility) => (
                <Card key={utility.value}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedUtilityTypes.has(utility.value)}
                        onCheckedChange={() => toggleUtilityType(utility.value)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{utility.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Default Unit: {utility.defaultUnit} • {utility.scope}
                            </p>
                          </div>
                        </div>

                        {selectedUtilityTypes.has(utility.value) && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <Label className="text-xs">Frequency</Label>
                              <Select
                                value={dataContracts.find(dc => dc.utilityType === utility.value)?.frequency}
                                onValueChange={(value) => updateDataContract(utility.value, 'frequency', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Quality</Label>
                              <Select
                                value={dataContracts.find(dc => dc.utilityType === utility.value)?.quality}
                                onValueChange={(value) => updateDataContract(utility.value, 'quality', value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="actual">Actual</SelectItem>
                                  <SelectItem value="estimated">Estimated</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <FileCheck className="h-16 w-16 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-semibold mb-2">Ready to Create</h3>
              <p className="text-sm text-muted-foreground">
                Review your facility configuration
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operational Control</p>
                <p className="text-lg font-semibold">
                  {operationalControl === 'owned' ? 'We do (Owned)' : 'A Partner (Third-Party)'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Facility Name</p>
                <p className="text-lg font-semibold">{facilityName}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Functions</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedFunctions.map((func) => (
                    <Badge key={func} variant="secondary">{func}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="text-sm">{addressLine1}</p>
                {addressCity && addressCountry && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {addressCity}, {addressCountry}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Data Contract</p>
                <p className="text-sm">{dataContracts.length} utility type(s) selected</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Facility - Step {step} of 4</DialogTitle>
          <DialogDescription>
            Set up a new facility to track emissions data
          </DialogDescription>
        </DialogHeader>

        {atLimit && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <Lock className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Facility limit reached</p>
              <p className="text-xs text-muted-foreground">
                You&apos;ve used {currentCount} of {maxCount} facilities on your current plan.{" "}
                <a href="/dashboard/settings" className="underline text-primary">Upgrade</a> to add more.
              </p>
            </div>
          </div>
        )}

        {!atLimit && !isUnlimited && maxCount != null && (
          <UsageMeterCompact current={currentCount} max={maxCount} />
        )}

        <div className="py-6">
          {renderStep()}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || atLimit}>
                {atLimit ? 'Limit Reached' : isSubmitting ? 'Creating...' : 'Create Facility & Enter Data'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
