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
import type { Orchard, OrchardType, OrchardCertification, TrainingSystem } from '@/lib/types/orchard';
import { ORCHARD_TYPE_LABELS, TRAINING_SYSTEM_LABELS } from '@/lib/orchard-utils';

interface AddOrchardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdOrchard?: Orchard) => void;
  editOrchard?: Orchard | null;
}

export function AddOrchardDialog({
  open,
  onOpenChange,
  onSuccess,
  editOrchard,
}: AddOrchardDialogProps) {
  const { currentOrganization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);

  const [locationSearchValue, setLocationSearchValue] = useState('');

  const [form, setForm] = useState({
    name: '',
    hectares: '',
    orchard_type: 'apple' as OrchardType,
    fruit_varieties: '',
    annual_yield_tonnes: '',
    certification: 'conventional' as OrchardCertification,
    climate_zone: 'temperate' as 'wet' | 'dry' | 'temperate',
    planting_year: '',
    tree_density_per_ha: '',
    rootstock_type: '',
    training_system: '' as TrainingSystem | '',
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
    if (editOrchard) {
      const displayParts: string[] = [];
      if (editOrchard.address_city) displayParts.push(editOrchard.address_city);
      if (editOrchard.address_country) displayParts.push(editOrchard.address_country);
      setLocationSearchValue(displayParts.join(', '));

      setForm({
        name: editOrchard.name,
        hectares: String(editOrchard.hectares),
        orchard_type: editOrchard.orchard_type,
        fruit_varieties: (editOrchard.fruit_varieties || []).join(', '),
        annual_yield_tonnes: editOrchard.annual_yield_tonnes
          ? String(editOrchard.annual_yield_tonnes)
          : '',
        certification: editOrchard.certification,
        climate_zone: editOrchard.climate_zone,
        planting_year: editOrchard.planting_year ? String(editOrchard.planting_year) : '',
        tree_density_per_ha: editOrchard.tree_density_per_ha
          ? String(editOrchard.tree_density_per_ha)
          : '',
        rootstock_type: editOrchard.rootstock_type || '',
        training_system: editOrchard.training_system || '',
        facility_id: editOrchard.facility_id || '',
        address_city: editOrchard.address_city || '',
        address_country: editOrchard.address_country || '',
        address_lat: editOrchard.address_lat ?? null,
        address_lng: editOrchard.address_lng ?? null,
        location_country_code: editOrchard.location_country_code || '',
      });
    } else {
      setLocationSearchValue('');
      setForm({
        name: '',
        hectares: '',
        orchard_type: 'apple',
        fruit_varieties: '',
        annual_yield_tonnes: '',
        certification: 'conventional',
        climate_zone: 'temperate',
        planting_year: '',
        tree_density_per_ha: '',
        rootstock_type: '',
        training_system: '',
        facility_id: '',
        address_city: '',
        address_country: '',
        address_lat: null,
        address_lng: null,
        location_country_code: '',
      });
    }
  }, [editOrchard, open]);

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
        orchard_type: form.orchard_type,
        fruit_varieties: form.fruit_varieties
          ? form.fruit_varieties.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
        annual_yield_tonnes: form.annual_yield_tonnes
          ? parseFloat(form.annual_yield_tonnes)
          : null,
        certification: form.certification,
        climate_zone: form.climate_zone,
        planting_year: form.planting_year ? parseInt(form.planting_year) : null,
        tree_density_per_ha: form.tree_density_per_ha
          ? parseInt(form.tree_density_per_ha)
          : null,
        rootstock_type: form.rootstock_type || null,
        training_system: form.training_system || null,
        facility_id: form.facility_id || null,
        address_city: form.address_city || null,
        address_country: form.address_country || null,
        address_lat: form.address_lat,
        address_lng: form.address_lng,
        location_country_code: form.location_country_code || null,
      };

      if (editOrchard) {
        const { error } = await supabase
          .from('orchards')
          .update(payload)
          .eq('id', editOrchard.id);

        if (error) throw error;
        toast.success('Orchard updated');
      } else {
        const response = await fetch('/api/orchards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create orchard');
        }
        toast.success('Orchard created');
        onSuccess(result.data as Orchard | undefined);
        onOpenChange(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save orchard');
    } finally {
      setSaving(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editOrchard ? 'Edit Orchard' : 'Add Orchard'}
          </DialogTitle>
          <DialogDescription>
            {editOrchard
              ? 'Update your orchard details.'
              : 'Add an orchard to calculate the environmental impact of your fruit growing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="name">Orchard name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Home Estate Orchard"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Orchard type</Label>
              <Select
                value={form.orchard_type}
                onValueChange={(v) =>
                  setForm({ ...form, orchard_type: v as OrchardType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORCHARD_TYPE_LABELS).map(([value, label]) => (
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
                placeholder="e.g. 5.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="planting-year">Planting year</Label>
              <Input
                id="planting-year"
                type="number"
                min="1900"
                max={currentYear}
                value={form.planting_year}
                onChange={(e) => setForm({ ...form, planting_year: e.target.value })}
                placeholder={`e.g. ${currentYear - 10}`}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tree-density">Trees per hectare</Label>
              <Input
                id="tree-density"
                type="number"
                min="1"
                value={form.tree_density_per_ha}
                onChange={(e) => setForm({ ...form, tree_density_per_ha: e.target.value })}
                placeholder="e.g. 800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rootstock">Rootstock type</Label>
              <Input
                id="rootstock"
                value={form.rootstock_type}
                onChange={(e) => setForm({ ...form, rootstock_type: e.target.value })}
                placeholder="e.g. M9, MM106"
              />
            </div>
            <div className="grid gap-2">
              <Label>Training system</Label>
              <Select
                value={form.training_system}
                onValueChange={(v) =>
                  setForm({ ...form, training_system: v as TrainingSystem })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select system" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRAINING_SYSTEM_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              placeholder="e.g. 30"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="varieties">Fruit varieties</Label>
            <Input
              id="varieties"
              value={form.fruit_varieties}
              onChange={(e) =>
                setForm({ ...form, fruit_varieties: e.target.value })
              }
              placeholder="e.g. Dabinett, Kingston Black, Michelin"
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
                  setForm({ ...form, certification: v as OrchardCertification })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conventional">Conventional</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                  <SelectItem value="biodynamic">Biodynamic</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
              placeholder="Search for orchard location..."
            />
            <p className="text-xs text-muted-foreground">
              Search for the nearest town or the orchard address
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
            {editOrchard ? 'Save Changes' : 'Add Orchard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
