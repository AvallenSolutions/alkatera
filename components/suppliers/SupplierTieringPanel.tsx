'use client';

/**
 * Suggests which suppliers are your direct, material ones (Tier 1) based on
 * spend, with one-click apply and per-supplier override. The Tier 1 set is
 * what B Corp measures your supplier survey coverage against.
 */

import { useEffect, useState } from 'react';
import { PillButton } from '@/components/studio/pill-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Tier = 'tier_1' | 'tier_2' | 'tier_3' | 'none';

interface Suggestion {
  id: string;
  name: string;
  spend: number;
  currentTier: 'tier_1' | 'tier_2' | 'tier_3' | null;
  suggestedTier: 'tier_1' | 'tier_2' | 'tier_3' | null;
}

function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function SupplierTieringPanel({ organizationId }: { organizationId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [summary, setSummary] = useState<{ count: number; spendSharePct: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Tier>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/suppliers/tiers?organization_id=${organizationId}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setSuggestions(body.suggestions ?? []);
      setSummary(body.summary ?? null);
      setOverrides({});
    } else {
      setSuggestions([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  function tierFor(s: Suggestion): Tier {
    return overrides[s.id] ?? (s.suggestedTier ?? 'none');
  }

  async function apply() {
    if (!suggestions) return;
    setSaving(true);
    const tiers: Record<string, string | null> = {};
    for (const s of suggestions) {
      const t = tierFor(s);
      tiers[s.id] = t === 'none' ? null : t;
    }
    const res = await fetch('/api/suppliers/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId, tiers }),
    });
    if (res.ok) await load();
    setSaving(false);
  }

  if (suggestions === null) return null;
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add suppliers and connect Xero spend to get tier suggestions.
      </p>
    );
  }

  const anyChange = suggestions.some((s) => tierFor(s) !== (s.currentTier ?? 'none'));

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        We suggest your direct, material suppliers (Tier 1) from spend{summary ? `: ${summary.count} suppliers making up ${Math.round(summary.spendSharePct)}% of spend` : ''}.
        These become the set B Corp measures your survey coverage against. Adjust any below.
      </p>
      <ul className="divide-y divide-studio-hairline border-t border-studio-hairline">
        {suggestions.map((s) => {
          const current = tierFor(s);
          const isSuggested = (s.suggestedTier ?? 'none') === current && overrides[s.id] === undefined;
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">{s.name}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{gbp(s.spend)}</span>
              <Select value={current} onValueChange={(v) => setOverrides((o) => ({ ...o, [s.id]: v as Tier }))}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_1">Direct (Tier 1)</SelectItem>
                  <SelectItem value="tier_2">Tier 2</SelectItem>
                  <SelectItem value="tier_3">Tier 3</SelectItem>
                  <SelectItem value="none">Untiered</SelectItem>
                </SelectContent>
              </Select>
              {isSuggested && s.suggestedTier === 'tier_1' ? (
                <span className="w-16 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">Suggested</span>
              ) : (
                <span className="w-16" />
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-end">
        <PillButton variant="ink" onClick={apply} disabled={saving || !anyChange}>
          {saving ? 'Applying…' : 'Apply tiers'}
        </PillButton>
      </div>
    </div>
  );
}
