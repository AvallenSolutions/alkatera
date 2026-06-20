'use client';

/**
 * Hospitality function chooser. Shown on first open (and from "Customise") so a
 * venue picks which functions it needs — the nav then only shows those sections.
 */

import { useState } from 'react';
import { UtensilsCrossed, Wine, BedDouble, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HospitalitySettings } from '@/lib/hospitality/settings';

type FnKey = 'meals' | 'drinks' | 'rooms';

const FUNCTIONS: { key: FnKey; label: string; blurb: string; icon: typeof Wine }[] = [
  { key: 'meals', label: 'Food', blurb: 'Meals & recipes for a restaurant or kitchen.', icon: UtensilsCrossed },
  { key: 'drinks', label: 'Drinks', blurb: 'Cocktails, coffees and bar drinks.', icon: Wine },
  { key: 'rooms', label: 'Rooms', blurb: 'Accommodation and per-room-night impact.', icon: BedDouble },
];

export function HospitalitySetup({
  initial,
  onSaved,
  onCancel,
}: {
  initial: HospitalitySettings;
  onSaved: (next: HospitalitySettings) => void;
  onCancel?: () => void;
}) {
  const [sel, setSel] = useState<Record<FnKey, boolean>>({
    meals: initial.meals,
    drinks: initial.drinks,
    rooms: initial.rooms,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (k: FnKey) => setSel((s) => ({ ...s, [k]: !s[k] }));
  const anySelected = sel.meals || sel.drinks || sel.rooms;

  const save = async () => {
    if (!anySelected) {
      setError('Choose at least one function.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/hospitality/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sel),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not save');
      onSaved(body.settings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">What does this venue offer?</h2>
          <p className="text-sm text-muted-foreground">
            Pick the functions you need. We&apos;ll hide the rest from the menu — you can change
            this any time.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {FUNCTIONS.map((f) => {
            const Icon = f.icon;
            const on = sel[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggle(f.key)}
                aria-pressed={on}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  on ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
              >
                <span
                  className={cn(
                    'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <Icon className="h-6 w-6" />
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.blurb}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving || !anySelected}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
