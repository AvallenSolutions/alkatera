"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { COUNTRIES } from "@/lib/countries";
import { LocationPicker, type LocationData } from "@/components/shared/LocationPicker";

interface EditFacilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string | null;
  onSuccess: () => void;
}

interface FacilityData {
  id: string;
  name: string;
  functions: string[];
  operational_control: 'owned' | 'third_party';
  address_line1: string;
  address_city: string;
  address_country: string;
  address_postcode: string;
  address_lat: number | null;
  address_lng: number | null;
  location_address: string | null;
  location_country_code: string | null;
}

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
  'Co-Manufacturer',
];

export function EditFacilityDialog({
  open,
  onOpenChange,
  facilityId,
  onSuccess,
}: EditFacilityDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [facility, setFacility] = useState<FacilityData | null>(null);

  // Form state
  const [operationalControl, setOperationalControl] = useState<'owned' | 'third_party'>('owned');
  const [facilityName, setFacilityName] = useState('');
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [addressCountryCode, setAddressCountryCode] = useState('');
  const [addressPostcode, setAddressPostcode] = useState('');
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);

  useEffect(() => {
    if (open && facilityId) {
      loadFacility();
    }
  }, [open, facilityId]);

  const loadFacility = async () => {
    if (!facilityId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('id', facilityId)
        .single();

      if (error) throw error;

      setFacility(data);
      setOperationalControl(data.operational_control || 'owned');
      setFacilityName(data.name || '');
      setSelectedFunctions(data.functions || []);
      setAddressLine1(data.address_line1 || '');
      setAddressCity(data.address_city || '');
      setAddressPostcode(data.address_postcode || '');
      setAddressLat(data.address_lat ? parseFloat(data.address_lat) : null);
      setAddressLng(data.address_lng ? parseFloat(data.address_lng) : null);

      // Set the location search value for display in the LocationPicker
      const displayParts: string[] = [];
      if (data.address_line1) displayParts.push(data.address_line1);
      if (data.address_city) displayParts.push(data.address_city);
      setLocationSearchValue(displayParts.join(', ') || data.location_address || '');

      // Handle country code
      let countryCode = data.location_country_code || '';
      if (!countryCode && data.address_country) {
        const matchedCountry = COUNTRIES.find(
          c => c.label.toLowerCase() === data.address_country.toLowerCase() ||
               c.value.toLowerCase() === data.address_country.toLowerCase()
        );
        countryCode = matchedCountry?.value || '';
      }
      setAddressCountryCode(countryCode);
      const countryLabel = COUNTRIES.find(c => c.value === countryCode)?.label || data.address_country || '';
      setAddressCountry(countryLabel);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load facility';
      console.error('Error loading facility:', error);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
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
    setAddressCountry(location.country || '');
    setAddressCountryCode(location.countryCode || '');
    setAddressLat(location.lat);
    setAddressLng(location.lng);
  };

  const handleSave = async () => {
    if (!facilityId) return;

    if (!facilityName.trim()) {
      toast.error('Please enter a facility name');
      return;
    }

    if (selectedFunctions.length === 0) {
      toast.error('Please select at least one function');
      return;
    }

    try {
      setIsSaving(true);

      // Derive country code for the update
      let countryCodeToSave = addressCountryCode;
      if (!countryCodeToSave && addressCountry) {
        const matchedCountry = COUNTRIES.find(
          c => c.label.toLowerCase() === addressCountry.toLowerCase()
        );
        countryCodeToSave = matchedCountry?.value || '';
      }

      const { error } = await supabase
        .from('facilities')
        .update({
          name: facilityName.trim(),
          functions: selectedFunctions,
          operational_control: operationalControl,
          address_line1: addressLine1.trim() || null,
          address_city: addressCity.trim() || null,
          address_country: addressCountry.trim() || null,
          address_postcode: addressPostcode.trim() || null,
          // Save geocoded coordinates — critical for distance calculations
          address_lat: addressLat,
          address_lng: addressLng,
          // Also update location columns for AWARE water stress assessment
          location_country_code: countryCodeToSave || null,
          location_address: addressLine1.trim() || null,
          latitude: addressLat,
          longitude: addressLng,
          updated_at: new Date().toISOString(),
        })
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update facility';
      console.error('Error updating facility:', error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Facility</DialogTitle>
          <DialogDescription>
            Update facility details and operational information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading facility details...
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Operational Control */}
            <div>
              <Label className="mb-3 block">Operational Control</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={operationalControl === 'owned' ? 'default' : 'outline'}
                  className="h-auto py-4"
                  onClick={() => setOperationalControl('owned')}
                >
                  <div className="text-left">
                    <div className="font-semibold">Owned</div>
                    <div className="text-xs opacity-80">Direct operational control</div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={operationalControl === 'third_party' ? 'default' : 'outline'}
                  className="h-auto py-4"
                  onClick={() => setOperationalControl('third_party')}
                >
                  <div className="text-left">
                    <div className="font-semibold">Third-Party</div>
                    <div className="text-xs opacity-80">Contract manufacturer</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Facility Profile */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Facility Profile</h3>

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
                <Label className="mb-3 block">Primary Functions *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FACILITY_FUNCTIONS.map((func) => (
                    <div key={func} className="flex items-center space-x-2">
                      <Checkbox
                        id={`func-${func}`}
                        checked={selectedFunctions.includes(func)}
                        onCheckedChange={() => toggleFunction(func)}
                      />
                      <Label
                        htmlFor={`func-${func}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {func}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedFunctions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedFunctions.map((func) => (
                      <Badge key={func} variant="secondary">
                        {func}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Location — use LocationPicker for geocoding */}
              <div>
                <Label>Facility Location</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Search for the city or address to enable automatic distance calculations
                </p>
                <LocationPicker
                  value={locationSearchValue}
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search for city or address..."
                />
                {addressCity && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {addressCity}{addressCountry ? `, ${addressCountry}` : ''}
                    {addressLat && addressLng ? (
                      <span className="text-green-600 dark:text-green-400 ml-2">
                        Coordinates saved
                      </span>
                    ) : null}
                  </p>
                )}
                {!addressLat && !addressLng && (facility?.address_line1 || facility?.location_address) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    This facility has an address but no coordinates. Search again to enable distance calculations.
                  </p>
                )}
              </div>

              {/* Postcode — standalone field since LocationPicker doesn't always return it */}
              <div>
                <Label htmlFor="addressPostcode">Postcode</Label>
                <Input
                  id="addressPostcode"
                  placeholder="SW1A 1AA"
                  value={addressPostcode}
                  onChange={(e) => setAddressPostcode(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
