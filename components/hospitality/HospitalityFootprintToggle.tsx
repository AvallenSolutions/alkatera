'use client';

/**
 * Org setting: whether the hospitality element counts toward the company total.
 * Governs carbon, water and waste together. Default ON. Stored on
 * organizations.report_defaults.include_hospitality via /api/hospitality/footprint-settings.
 */

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function HospitalityFootprintToggle() {
  const { toast } = useToast();
  const [include, setInclude] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/hospitality/footprint-settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b) setInclude(b.include_hospitality !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const onChange = async (next: boolean) => {
    const prev = include;
    setInclude(next);
    setSaving(true);
    try {
      const res = await fetch('/api/hospitality/footprint-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_hospitality: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save');
      toast({ title: next ? 'Hospitality counted in your total' : 'Hospitality excluded from your total' });
    } catch (e: unknown) {
      setInclude(prev);
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="include-hospitality" className="text-sm font-medium">
              Count hospitality in the company total
            </Label>
            <p className="text-xs text-muted-foreground">
              When on, hospitality carbon, water and waste roll into your company footprint. When off, it&apos;s
              tracked and reported here but excluded from the company total.
            </p>
          </div>
        </div>
        <Switch
          id="include-hospitality"
          checked={include}
          onCheckedChange={onChange}
          disabled={loading || saving}
        />
      </CardContent>
    </Card>
  );
}
