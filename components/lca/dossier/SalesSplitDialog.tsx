'use client';

/**
 * The sales split: roughly how much of this product goes down each route.
 *
 * One question, asked once, worth the difference between the cheapest and the
 * dearest channel. Answering it turns the headline from "the main route" into
 * the volume-weighted mix, which is the most defensible single number a
 * multi-channel product has and the one corporate reporting should consume.
 *
 * Deliberately refuses a split that does not add to 100 rather than
 * normalising it. A typo silently rescaled into confident arithmetic is worse
 * than a number the user is asked to fix.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PillButton } from '@/components/studio';
import type { DossierScenario } from '@/lib/lca/dossier';

interface SalesSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarios: DossierScenario[];
  onSave: (shares: Record<string, number>) => Promise<void>;
}

export function SalesSplitDialog({ open, onOpenChange, scenarios, onSave }: SalesSplitDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Seed from whatever is already known each time the dialog opens, so a
  // reader correcting one number does not have to retype the others.
  useEffect(() => {
    if (!open) return;
    setValues(
      Object.fromEntries(
        scenarios.map((s) => [s.id, s.sharePct === null ? '' : String(s.sharePct)]),
      ),
    );
  }, [open, scenarios]);

  const numbers = scenarios.map((s) => Number(values[s.id] ?? ''));
  const allFilled = numbers.every((n) => Number.isFinite(n));
  const total = numbers.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
  const addsUp = allFilled && Math.abs(total - 100) < 0.5;

  const handleSave = async () => {
    if (!addsUp) return;
    setSaving(true);
    try {
      await onSave(
        Object.fromEntries(scenarios.map((s) => [s.id, Number(values[s.id])])),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How do sales of this product split?</DialogTitle>
          <DialogDescription>
            A rough percentage is fine. This is what lets us show one honest number across every
            route rather than picking one.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{s.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                  {s.totalKgCo2e === null ? '—' : `${s.totalKgCo2e.toFixed(3)} kg CO₂e`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={values[s.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
                  className="w-20 rounded-md border border-studio-rule bg-transparent px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground"
                />
                <span className="font-mono text-[10px] text-studio-dim">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span
            className={
              addsUp
                ? 'font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim'
                : 'font-mono text-[10px] uppercase tracking-[0.18em] text-studio-attention'
            }
          >
            {allFilled ? `Adds up to ${Math.round(total)}%` : 'Fill in every route'}
          </span>
          <div className="flex gap-3">
            <PillButton variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </PillButton>
            <PillButton variant="room" size="sm" disabled={!addsUp || saving} onClick={handleSave}>
              {saving ? 'Saving' : 'Save the split'}
            </PillButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
