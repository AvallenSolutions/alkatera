'use client';

/**
 * Suggests which suppliers are your direct, material ones (Tier 1) based on
 * spend, with one-click apply and per-supplier override. The Tier 1 set is
 * what B Corp measures your supplier survey coverage against.
 */

import { useEffect, useState } from 'react';
import { Loader2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Add suppliers (and connect Xero spend) to get tier suggestions.
        </CardContent>
      </Card>
    );
  }

  const anyChange = suggestions.some((s) => tierFor(s) !== (s.currentTier ?? 'none'));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#ccff00]" />
          Supplier tiers
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We suggest your direct, material suppliers (Tier 1) from spend{summary ? ` — ${summary.count} suppliers making up ${Math.round(summary.spendSharePct)}% of spend` : ''}.
          These become the set B Corp measures your survey coverage against. Adjust any below.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {suggestions.map((s) => {
            const current = tierFor(s);
            const isSuggested = (s.suggestedTier ?? 'none') === current && overrides[s.id] === undefined;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{gbp(s.spend)}</span>
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
                {isSuggested && s.suggestedTier === 'tier_1' && (
                  <span className="w-16 text-[10px] uppercase tracking-wide text-[#9bbf00] dark:text-[#ccff00]">Suggested</span>
                )}
                {!isSuggested || s.suggestedTier !== 'tier_1' ? <span className="w-16" /> : null}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button onClick={apply} disabled={saving || !anyChange}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply tiers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
