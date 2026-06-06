'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  /** PATCH endpoint accepting { category, country_of_origin }. */
  endpoint: string;
  initialCategory: string | null;
  initialCountry: string | null;
  canEdit: boolean;
  /** Optional autocomplete suggestions for the category input. */
  categorySuggestions?: string[];
  /** One-line note explaining where the edit is saved (scope). */
  scopeNote?: string;
}

/**
 * Inline editor for a brand's product category + country of origin.
 *
 * Shared by the alka**tera** admin brand page (writes the canonical
 * brand_directory record) and the distributor brand page (writes their
 * listing). The deterministic inference covers most of the catalogue, but
 * unusual categories (cachaça-style spirits we haven't mapped) and missing
 * countries need a manual override — that's what this is for.
 */
export function KeyDetailsEditor({
  endpoint,
  initialCategory,
  initialCountry,
  canEdit,
  categorySuggestions = [],
  scopeNote,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(initialCategory ?? '');
  const [country, setCountry] = useState(initialCountry ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  function startEdit() {
    setCategory(initialCategory ?? '');
    setCountry(initialCountry ?? '');
    setError(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.trim() || null,
          country_of_origin: country.trim() || null,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Save failed (${b.error ?? res.status}).`);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-3 w-3" /> Edit category &amp; country
      </button>
    );
  }

  const listId = `kde-cat-${endpoint.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Category
          </label>
          <Input
            list={listId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Cachaça, Shochu, Soju"
            disabled={busy}
          />
          {categorySuggestions.length > 0 && (
            <datalist id={listId}>
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Country of origin
          </label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Brazil, Japan, Peru"
            disabled={busy}
          />
        </div>
      </div>
      {scopeNote && <p className="text-[11px] text-muted-foreground leading-relaxed">{scopeNote}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={save}
          disabled={busy}
          className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Save
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="border-border/60"
        >
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}
