'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { LocationPicker, type LocationData } from '@/components/shared/LocationPicker';
import type { ArableField, CropType, ArableCertification, SowingMethod } from '@/lib/types/arable';
import { CROP_TYPE_LABELS, SOWING_METHOD_LABELS, ARABLE_CERTIFICATION_LABELS } from '@/lib/arable-utils';

interface AddArableFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdField?: ArableField) => void;
  editField?: ArableField | null;
}

export function AddArableFieldDialog({
  open,
  onOpenChange,
  onSuccess,
  editField,
}: AddArableFieldDialogProps) {
  const { currentOrganization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);

  const [locationSearchValue, setLocationSearchValue] = useState('');

  const [form, setForm] = useState({
    name: '',
    hectares: '',
    crop_type: 'barley' as CropType,
    crop_varieties: '',
    annual_yield_tonnes: '',
    certification: 'conventional' as ArableCertification,
    climate_zone: 'temperate' as 'wet' | 'dry' | 'temperate',
    sowing_method: '' as SowingMethod | '',
    seed_rate_kg_per_ha: '',
    facility_id: '',
    address_city: '',
    address_country: '',
    address_lat: null as number | null,
    address_lng: null as number | null,
    location_country_code: '',
  });

  // Load facilities for "Connect to Facility" selector
  useEffect(() => {
    if (!currentOrganization?.id) return;

    supabase
      .from('facilities')
      .select('id, name')
      .eq('organization_id', currentOrganization.id)
      .then(({ data }) => {
        setFacilities(data || []);
      });
  }, [currentOrganization?.id]);

  // Populate form when editing
  useEffect(() => {
    if (editField) {
      const displayParts: string[] = [];
      if (editField.address_city) displayParts.push(editField.address_city);
      if (editField.address_country) displayParts.push(editField.address_country);
      setLocationSearchValue(displayParts.join(', '));

      setForm({
        name: editField.name,
        hectares: String(editField.hectares),
        crop_type: editField.crop_type,
        crop_varieties: (editField.crop_varieties || []).join(', '),
        annual_yield_tonnes: editField.annual_yield_tonnes
          ? String(editField.annual_yield_tonnes)
          : '',
        certification: editField.certification,
        climate_zone: editField.climate_zone,
        sowing_method: editField.sowing_method || '',
        seed_rate_kg_per_ha: editField.seed_rate_kg_per_ha
          ? String(editField.seed_rate_kg_per_ha)
          : '',
        facility_id: editField.facility_id || '',
        address_city: editField.address_city || '',
        address_country: editField.address_country || '',
        address_lat: editField.address_lat ?? null,
        address_lng: editField.address_lng ?? null,
        location_country_code: editField.location_country_code || '',
      });
    } else {
      setLocationSearchValue('');
      setForm({
        name: '',
        hectares: '',
        crop_type: 'barley',
        crop_varieties: '',
        annual_yield_tonnes: '',
        certification: 'conventional',
        climate_zone: 'temperate',
        sowing_method: '',
        seed_rate_kg_per_ha: '',
        facility_id: '',
        address_city: '',
        address_country: '',
        address_lat: null,
        address_lng: null,
        location_country_code: '',
      });
    }
  }, [editField, open]);

  async function handleSave() {
    if (!form.name || !form.hectares) {
      toast.error('Name and hectares are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        hectares: parseFloat(form.hectares),
        crop_type: form.crop_type,
        crop_varieties: form.crop_varieties
          ? form.crop_varieties.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
        annual_yield_tonnes: form.annual_yield_tonnes
          ? parseFloat(form.annual_yield_tonnes)
          : null,
        certification: form.certification,
        climate_zone: form.climate_zone,
        sowing_method: form.sowing_method || null,
        seed_rate_kg_per_ha: form.seed_rate_kg_per_ha
          ? parseInt(form.seed_rate_kg_per_ha)
          : null,
        facility_id: form.facility_id || null,
        address_city: form.address_city || null,
        address_country: form.address_country || null,
        address_lat: form.address_lat,
        address_lng: form.address_lng,
        location_country_code: form.location_country_code || null,
      };

      if (editField) {
        const { error } = await supabase
          .from('arable_fields')
          .update(payload)
          .eq('id', editField.id);

        if (error) throw error;
        toast.success('Arable field updated');
      } else {
        const response = await fetch('/api/arable-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create arable field');
        }
        toast.success('Arable field created');
        onSuccess(result.data as ArableField | undefined);
        onOpenChange(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save arable field');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editField ? 'Edit Arable Field' : 'Add Arable Field'}
          </DialogTitle>
          <DialogDescription>
            {editField
              ? 'Update your arable field details.'
              : 'Add an arable field to calculate the environmental impact of your grain growing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="name">Field name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Home Farm Barley Field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Crop type</Label>
              <Select
                value={form.crop_type}
                onValueChange={(v) =>
                  setForm({ ...form, crop_type: v as CropType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CROP_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hectares">Area (ha) *</Label>
              <Input
                id="hectares"
                type="number"
                step="0.01"
                min="0.01"
                value={form.hectares}
                onChange={(e) => setForm({ ...form, hectares: e.target.value })}
                placeholder="e.g. 12.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Sowing method</Label>
              <Select
                value={form.sowing_method}
                onValueChange={(v) =>
                  setForm({ ...form, sowing_method: v as SowingMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOWING_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seed-rate">Seed rate (kg/ha)</Label>
              <Input
                id="seed-rate"
                type="number"
                min="1"
                value={form.seed_rate_kg_per_ha}
                onChange={(e) => setForm({ ...form, seed_rate_kg_per_ha: e.target.value })}
                placeholder="e.g. 160"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="yield">Annual yield (tonnes)</Label>
            <Input
              id="yield"
              type="number"
              step="0.1"
              min="0"
              value={form.annual_yield_tonnes}
              onChange={(e) =>
                setForm({ ...form, annual_yield_tonnes: e.target.value })
              }
              placeholder="e.g. 80"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="varieties">Crop varieties</Label>
            <Input
              id="varieties"
              value={form.crop_varieties}
              onChange={(e) =>
                setForm({ ...form, crop_varieties: e.target.value })
              }
              placeholder="e.g. Maris Otter, Propino, Laureate"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple varieties with commas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Certification</Label>
              <Select
                value={form.certification}
                onValueChange={(v) =>
                  setForm({ ...form, certification: v as ArableCertification })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ARABLE_CERTIFICATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Climate zone</Label>
              <Select
                value={form.climate_zone}
                onValueChange={(v) =>
                  setForm({ ...form, climate_zone: v as 'wet' | 'dry' | 'temperate' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperate">Temperate (UK default)</SelectItem>
                  <SelectItem value="wet">Wet</SelectItem>
                  <SelectItem value="dry">Dry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Location</Label>
            <LocationPicker
              value={locationSearchValue}
              onLocationSelect={(location: LocationData) => {
                setLocationSearchValue(location.address);
                setForm({
                  ...form,
                  address_city: location.city || '',
                  address_country: location.country || '',
                  address_lat: location.lat,
                  address_lng: location.lng,
                  location_country_code: location.countryCode || '',
                });
              }}
              placeholder="Search for field location..."
            />
            <p className="text-xs text-muted-foreground">
              Search for the nearest town or the field address
            </p>
          </div>

          {facilities.length > 0 && (
            <div className="grid gap-2">
              <Label>Connect to facility</Label>
              <Select
                value={form.facility_id}
                onValueChange={(v) =>
                  setForm({ ...form, facility_id: v === 'none' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a facility (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editField ? 'Save Changes' : 'Add Arable Field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
