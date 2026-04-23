'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpCircle, Loader2 } from 'lucide-react';

interface UpgradeFacilityDataButtonProps {
  allocationId: string;
  facilityName?: string;
  archetypeName?: string;
  onUpgraded?: (result: { upgradedAllocationId: string; supersededAllocationId: string }) => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
}

export function UpgradeFacilityDataButton({
  allocationId,
  facilityName,
  archetypeName,
  onUpgraded,
  variant = 'default',
  size = 'sm',
  disabled,
}: UpgradeFacilityDataButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalFacilityCo2eKg, setTotalFacilityCo2eKg] = useState('');
  const [scope1Kg, setScope1Kg] = useState('');
  const [scope2Kg, setScope2Kg] = useState('');
  const [allocatedWaterLitres, setAllocatedWaterLitres] = useState('');
  const [totalFacilityProductionVolume, setTotalFacilityProductionVolume] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    setError(null);

    const total = Number(totalFacilityCo2eKg);
    const s1 = Number(scope1Kg);
    const s2 = Number(scope2Kg);
    if (!Number.isFinite(total) || !Number.isFinite(s1) || !Number.isFinite(s2)) {
      setError('Please enter valid numeric values for total CO2e, Scope 1 and Scope 2.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/facilities/allocations/${allocationId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalFacilityCo2eKg: total,
          scope1Kg: s1,
          scope2Kg: s2,
          allocatedWaterLitres: allocatedWaterLitres ? Number(allocatedWaterLitres) : undefined,
          totalFacilityProductionVolume: totalFacilityProductionVolume
            ? Number(totalFacilityProductionVolume)
            : undefined,
          notes: notes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Upgrade failed');
      }

      setOpen(false);
      onUpgraded?.({
        upgradedAllocationId: json.upgradedAllocationId,
        supersededAllocationId: json.supersededAllocationId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          <ArrowUpCircle className="h-4 w-4 mr-2" />
          Upgrade to primary data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upgrade facility data to primary</DialogTitle>
          <DialogDescription>
            {facilityName ? `${facilityName}. ` : ''}
            {archetypeName ? `Currently using the ${archetypeName} archetype proxy. ` : ''}
            Enter the primary figures supplied by the facility. The existing proxy record will be
            preserved for audit; a new primary record will supersede it and a fresh LCA version
            will reflect the updated footprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="total">Total facility CO2e (kg)</Label>
              <Input
                id="total"
                type="number"
                inputMode="decimal"
                value={totalFacilityCo2eKg}
                onChange={(e) => setTotalFacilityCo2eKg(e.target.value)}
                placeholder="e.g. 42000"
              />
            </div>
            <div>
              <Label htmlFor="totalVol">Facility production volume</Label>
              <Input
                id="totalVol"
                type="number"
                inputMode="decimal"
                value={totalFacilityProductionVolume}
                onChange={(e) => setTotalFacilityProductionVolume(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <Label htmlFor="s1">Scope 1 (kg CO2e)</Label>
              <Input
                id="s1"
                type="number"
                inputMode="decimal"
                value={scope1Kg}
                onChange={(e) => setScope1Kg(e.target.value)}
                placeholder="e.g. 15000"
              />
            </div>
            <div>
              <Label htmlFor="s2">Scope 2 (kg CO2e)</Label>
              <Input
                id="s2"
                type="number"
                inputMode="decimal"
                value={scope2Kg}
                onChange={(e) => setScope2Kg(e.target.value)}
                placeholder="e.g. 27000"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="water">Allocated water (litres)</Label>
              <Input
                id="water"
                type="number"
                inputMode="decimal"
                value={allocatedWaterLitres}
                onChange={(e) => setAllocatedWaterLitres(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Verification notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Data source, methodology, verifier, etc."
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save primary data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
