'use client';

/**
 * Hospitality function chooser. Shown on first open (and from "Customise") so a
 * venue picks which functions it needs; the nav then only shows those sections.
 * Studio-quiet: selectable hairline rows with a typographic On/Off state.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HospitalitySettings } from '@/lib/hospitality/settings';

type FnKey = 'meals' | 'drinks' | 'rooms';

const FUNCTIONS: { key: FnKey; label: string; blurb: string }[] = [
  { key: 'meals', label: 'Food', blurb: 'Meals and recipes for a restaurant or kitchen.' },
  { key: 'drinks', label: 'Drinks', blurb: 'Cocktails, coffees and bar drinks.' },
  { key: 'rooms', label: 'Rooms', blurb: 'Accommodation and per-room-night impact.' },
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
    <div className="space-y-5 rounded-[6px] border border-border bg-card p-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-foreground">
          What does this venue offer?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the functions you need. We&apos;ll hide the rest from the menu; you can change
          this any time.
        </p>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {FUNCTIONS.map((f) => {
          const on = sel[f.key];
          return (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => toggle(f.key)}
                aria-pressed={on}
                className="flex w-full items-center gap-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'font-display text-sm font-semibold transition-colors',
                      on ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {f.label}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.blurb}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-colors',
                    on ? 'text-room-accent' : 'text-muted-foreground/50',
                  )}
                >
                  {on ? 'On' : 'Off'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button className="rounded-full" onClick={save} disabled={saving || !anySelected}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {onCancel && (
          <Button className="rounded-full" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
