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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { COUNTRIES } from "@/lib/countries";

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
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [addressPostcode, setAddressPostcode] = useState('');

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
      setAddressCountry(data.address_country || '');
      setAddressPostcode(data.address_postcode || '');
    } catch (error: any) {
      console.error('Error loading facility:', error);
      toast.error(error.message || 'Failed to load facility');
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

    if (!addressLine1.trim() || !addressCity.trim() || !addressCountry.trim()) {
      toast.error('Please complete the address fields');
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('facilities')
        .update({
          name: facilityName.trim(),
          functions: selectedFunctions,
          operational_control: operationalControl,
          address_line1: addressLine1.trim(),
          address_city: addressCity.trim(),
          address_country: addressCountry.trim(),
          address_postcode: addressPostcode.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', facilityId);

      if (error) throw error;

      toast.success('Facility updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating facility:', error);
      toast.error(error.message || 'Failed to update facility');
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="addressLine1">Street Address *</Label>
                  <Input
                    id="addressLine1"
                    placeholder="123 Main Street"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="addressCity">City *</Label>
                  <Input
                    id="addressCity"
                    placeholder="London"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                  />
                </div>

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

              <div>
                <Label htmlFor="addressCountry">Country *</Label>
                <Select value={addressCountry} onValueChange={setAddressCountry}>
                  <SelectTrigger id="addressCountry">
                    <SelectValue placeholder="Select country..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.label}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
