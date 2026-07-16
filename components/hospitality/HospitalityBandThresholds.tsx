'use client';

/**
 * Org setting: the low/medium carbon-band thresholds (kg CO2e per serving) used
 * on the public QR menu. Stored on
 * organizations.report_defaults.hospitality_band_thresholds via
 * /api/hospitality/footprint-settings.
 */

import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BAND_THRESHOLDS } from '@/lib/hospitality/carbon-band';

export function HospitalityBandThresholds() {
  const { toast } = useToast();
  const [low, setLow] = useState(String(BAND_THRESHOLDS.low));
  const [medium, setMedium] = useState(String(BAND_THRESHOLDS.medium));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/hospitality/footprint-settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b?.band_thresholds) {
          setLow(String(b.band_thresholds.low));
          setMedium(String(b.band_thresholds.medium));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const lowN = Number(low);
    const medN = Number(medium);
    if (!Number.isFinite(lowN) || !Number.isFinite(medN) || lowN <= 0 || medN <= lowN) {
      toast({ title: 'Check the thresholds', description: 'Low must be above 0 and below medium.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/hospitality/footprint-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ band_thresholds: { low: lowN, medium: medN } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save');
      toast({ title: 'Menu bands updated' });
    } catch (e: unknown) {
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Gauge className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <Label className="text-sm font-medium">Public menu carbon bands</Label>
            <p className="text-xs text-muted-foreground">
              Per-serving thresholds (kg CO₂e) for the low / medium / high labels on your QR menu. Dishes at or below
              the low value show green; at or below medium, amber; above, red.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32 space-y-1">
            <Label htmlFor="band-low" className="text-xs">Low up to</Label>
            <Input id="band-low" type="number" min="0" step="0.1" value={low} onChange={(e) => setLow(e.target.value)} />
          </div>
          <div className="w-32 space-y-1">
            <Label htmlFor="band-medium" className="text-xs">Medium up to</Label>
            <Input id="band-medium" type="number" min="0" step="0.1" value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>
          <Button onClick={save} disabled={loading || saving} size="sm">
            {saving ? 'Saving…' : 'Save bands'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
