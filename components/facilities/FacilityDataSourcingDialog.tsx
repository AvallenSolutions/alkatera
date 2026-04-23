'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { FacilityArchetypeProxyForm } from '@/components/facilities/FacilityArchetypeProxyForm';
import type { DataCollectionMode, HybridOverrides } from '@/lib/facility-archetypes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  initialMode: DataCollectionMode;
  initialArchetypeId: string | null;
  initialJustification: string;
  onSaved?: () => void;
}

export function FacilityDataSourcingDialog({
  open,
  onOpenChange,
  facilityId,
  initialMode,
  initialArchetypeId,
  initialJustification,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<DataCollectionMode>(initialMode);
  const [archetypeId, setArchetypeId] = useState<string | null>(initialArchetypeId);
  const [justification, setJustification] = useState(initialJustification);
  const [hybridOverrides, setHybridOverrides] = useState<HybridOverrides>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setArchetypeId(initialArchetypeId);
      setJustification(initialJustification);
    }
  }, [open, initialMode, initialArchetypeId, initialJustification]);

  const handleSave = async () => {
    if (mode !== 'primary') {
      if (!archetypeId) {
        toast.error('Please choose a facility type');
        return;
      }
      if (mode === 'archetype_proxy' && !justification.trim()) {
        toast.error("Please add a short reason why the facility can't share their data");
        return;
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .update({
          default_data_collection_mode: mode,
          default_archetype_id: mode === 'primary' ? null : archetypeId,
          default_proxy_justification: mode === 'primary' ? null : justification || null,
        })
        .eq('id', facilityId);

      if (error) throw error;
      toast.success('Data sourcing updated');
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How will this facility share their data?</DialogTitle>
          <DialogDescription>
            Pick the option that best matches what this contract facility can actually give you. You can change this later if things change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as DataCollectionMode)} className="space-y-3">
            <Card
              className={`cursor-pointer transition-all ${mode === 'primary' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setMode('primary')}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <RadioGroupItem value="primary" id="mode-primary-existing" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-primary-existing" className="font-medium cursor-pointer">
                    Yes, they send me real energy and water data
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick this if the facility shares monthly bills, meter readings, or a spreadsheet of their energy and water use.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Example: your canning partner emails you their electricity kWh every month.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${mode === 'archetype_proxy' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setMode('archetype_proxy')}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <RadioGroupItem value="archetype_proxy" id="mode-proxy-existing" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-proxy-existing" className="font-medium cursor-pointer">
                    No, use an industry average instead
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick this if the facility can&apos;t or won&apos;t share data. We&apos;ll use a published industry average for this type of facility so you can still run an LCA. Your report will clearly label this as an estimate.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Example: a shared canning line that runs many brands and can&apos;t separate your production from everyone else&apos;s.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${mode === 'hybrid' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setMode('hybrid')}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <RadioGroupItem value="hybrid" id="mode-hybrid-existing" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="mode-hybrid-existing" className="font-medium cursor-pointer">
                    Partly, they share some data but not all of it
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick this if you have a few real numbers (say, water use) but are missing others (like electricity). We&apos;ll use the industry average to fill the gaps.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Example: they send you a water meter total but no electricity breakdown.
                  </p>
                </div>
              </CardContent>
            </Card>
          </RadioGroup>

          {mode !== 'primary' && (
            <FacilityArchetypeProxyForm
              mode={mode}
              selectedArchetypeId={archetypeId}
              onArchetypeChange={setArchetypeId}
              justification={justification}
              onJustificationChange={setJustification}
              hybridOverrides={hybridOverrides}
              onHybridOverridesChange={setHybridOverrides}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
