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
import type { Vineyard, VineyardCertification, VineyardClimateZone } from '@/lib/types/viticulture';

interface AddVineyardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdVineyard?: Vineyard) => void;
  editVineyard?: Vineyard | null;
}

export function AddVineyardDialog({
  open,
  onOpenChange,
  onSuccess,
  editVineyard,
}: AddVineyardDialogProps) {
  const { currentOrganization } = useOrganization();
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);

  const [locationSearchValue, setLocationSearchValue] = useState('');

  const [form, setForm] = useState({
    name: '',
    hectares: '',
    grape_varieties: '',
    annual_yield_tonnes: '',
    vine_planting_year: '',
    certification: 'conventional' as VineyardCertification,
    climate_zone: 'temperate' as VineyardClimateZone,
    facility_id: '',
    address_city: '',
    address_country: '',
    address_lat: null as number | null,
    address_lng: null as number | null,
    location_country_code: '',
  });

  // Load facilities for "Connect to Winery" selector
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
    if (editVineyard) {
      const displayParts: string[] = [];
      if (editVineyard.address_city) displayParts.push(editVineyard.address_city);
      if (editVineyard.address_country) displayParts.push(editVineyard.address_country);
      setLocationSearchValue(displayParts.join(', '));

      setForm({
        name: editVineyard.name,
        hectares: String(editVineyard.hectares),
        grape_varieties: (editVineyard.grape_varieties || []).join(', '),
        annual_yield_tonnes: editVineyard.annual_yield_tonnes
          ? String(editVineyard.annual_yield_tonnes)
          : '',
        vine_planting_year: editVineyard.vine_planting_year
          ? String(editVineyard.vine_planting_year)
          : '',
        certification: editVineyard.certification,
        climate_zone: editVineyard.climate_zone,
        facility_id: editVineyard.facility_id || '',
        address_city: editVineyard.address_city || '',
        address_country: editVineyard.address_country || '',
        address_lat: editVineyard.address_lat ?? null,
        address_lng: editVineyard.address_lng ?? null,
        location_country_code: editVineyard.location_country_code || '',
      });
    } else {
      setLocationSearchValue('');
      setForm({
        name: '',
        hectares: '',
        grape_varieties: '',
        annual_yield_tonnes: '',
        vine_planting_year: '',
        certification: 'conventional',
        climate_zone: 'temperate',
        facility_id: '',
        address_city: '',
        address_country: '',
        address_lat: null,
        address_lng: null,
        location_country_code: '',
      });
    }
  }, [editVineyard, open]);

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
        grape_varieties: form.grape_varieties
          ? form.grape_varieties.split(',').map((v) => v.trim()).filter(Boolean)
          : [],
        annual_yield_tonnes: form.annual_yield_tonnes
          ? parseFloat(form.annual_yield_tonnes)
          : null,
        vine_planting_year: form.vine_planting_year
          ? parseInt(form.vine_planting_year, 10)
          : null,
        certification: form.certification,
        climate_zone: form.climate_zone,
        facility_id: form.facility_id || null,
        address_city: form.address_city || null,
        address_country: form.address_country || null,
        address_lat: form.address_lat,
        address_lng: form.address_lng,
        location_country_code: form.location_country_code || null,
      };

      if (editVineyard) {
        const { error } = await supabase
          .from('vineyards')
          .update(payload)
          .eq('id', editVineyard.id);

        if (error) throw error;
        toast.success('Vineyard updated');
      } else {
        const response = await fetch('/api/vineyards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create vineyard');
        }
        toast.success('Vineyard created');
        onSuccess(result.data as Vineyard | undefined);
        onOpenChange(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save vineyard');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editVineyard ? 'Edit Vineyard' : 'Add Vineyard'}
          </DialogTitle>
          <DialogDescription>
            {editVineyard
              ? 'Update your vineyard details.'
              : 'Add a vineyard to calculate the environmental impact of your grape growing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Vineyard name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Home Estate Vineyard"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="hectares">Area under vines (ha) *</Label>
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vine_planting_year">Vine planting year</Label>
            <Input
              id="vine_planting_year"
              type="number"
              step="1"
              min="1800"
              max={new Date().getFullYear()}
              value={form.vine_planting_year}
              onChange={(e) =>
                setForm({ ...form, vine_planting_year: e.target.value })
              }
              placeholder={`e.g. ${new Date().getFullYear() - 10}`}
            />
            <p className="text-xs text-muted-foreground">
              The year your vines were planted. Used to calculate above-ground biomass carbon removal and calibrate pruning dry matter estimates.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="varieties">Grape varieties</Label>
            <Input
              id="varieties"
              value={form.grape_varieties}
              onChange={(e) =>
                setForm({ ...form, grape_varieties: e.target.value })
              }
              placeholder="e.g. Chardonnay, Pinot Noir, Pinot Meunier"
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
                  setForm({ ...form, certification: v as VineyardCertification })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conventional">Conventional</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                  <SelectItem value="biodynamic">Biodynamic</SelectItem>
                  <SelectItem value="leaf">LEAF Marque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Climate zone</Label>
              <Select
                value={form.climate_zone}
                onValueChange={(v) =>
                  setForm({ ...form, climate_zone: v as VineyardClimateZone })
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
              placeholder="Search for vineyard location..."
            />
            <p className="text-xs text-muted-foreground">
              Search for the nearest town or the vineyard address
            </p>
          </div>

          {facilities.length > 0 && (
            <div className="grid gap-2">
              <Label>Connect to winery</Label>
              <Select
                value={form.facility_id}
                onValueChange={(v) =>
                  setForm({ ...form, facility_id: v === 'none' ? '' : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a winery (optional)" />
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
            {editVineyard ? 'Save Changes' : 'Add Vineyard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
