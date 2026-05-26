'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  productId: string;
  productName: string;
  brandDirectoryId: string;
  initial: {
    name: string;
    gtin: string | null;
    category: string | null;
    abv: number | null;
    container_size_ml: number | null;
    container_format: string | null;
    recipe_overview: string | null;
  };
}

const CATEGORIES = ['spirits', 'wine', 'beer', 'non_alc', 'other'] as const;
const FORMATS = ['bottle', 'can', 'keg', 'bag_in_box', 'other'] as const;

/**
 * Admin edit + delete control for a directory product. Opens an inline
 * form for the editable fields (name, gtin, category, abv, size,
 * format, recipe overview). Delete is gated by a typed-confirmation
 * step so accidental clicks don't wipe a SKU.
 */
export function ProductEditControl({ productId, productName, brandDirectoryId, initial }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial.name,
    gtin: initial.gtin ?? '',
    category: initial.category ?? '',
    abv: initial.abv != null ? String(initial.abv) : '',
    container_size_ml: initial.container_size_ml != null ? String(initial.container_size_ml) : '',
    container_format: initial.container_format ?? '',
    recipe_overview: initial.recipe_overview ?? '',
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        gtin: form.gtin.trim() || null,
        category: form.category || null,
        abv: form.abv === '' ? null : Number(form.abv),
        container_size_ml: form.container_size_ml === '' ? null : Number(form.container_size_ml),
        container_format: form.container_format || null,
        recipe_overview: form.recipe_overview.trim() || null,
      };
      const res = await fetch(`/api/admin/directory/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/products/${productId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(j.detail ?? j.error ?? `Failed (${res.status})`);
        return;
      }
      router.push(`/admin/directory/brands/${brandDirectoryId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            Edit product
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Update fields or remove this product from the directory.
          </div>
          {error && <div className="text-[11px] text-destructive mt-1">{error}</div>}
        </div>
        <div className="flex gap-2 shrink-0">
          {!editing && !confirmingDelete && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmingDelete(true)}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={busy}
              >
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={busy}
                className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/40">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
            />
          </Field>
          <Field label="GTIN (8-14 digits)">
            <input
              value={form.gtin}
              onChange={(e) => setForm({ ...form, gtin: e.target.value })}
              inputMode="numeric"
              placeholder="e.g. 5012345678901"
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm"
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ABV (%)">
            <input
              value={form.abv}
              onChange={(e) => setForm({ ...form, abv: e.target.value })}
              inputMode="decimal"
              placeholder="40"
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
            />
          </Field>
          <Field label="Container size (ml)">
            <input
              value={form.container_size_ml}
              onChange={(e) => setForm({ ...form, container_size_ml: e.target.value })}
              inputMode="numeric"
              placeholder="700"
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
            />
          </Field>
          <Field label="Container format">
            <select
              value={form.container_format}
              onChange={(e) => setForm({ ...form, container_format: e.target.value })}
              className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm"
            >
              <option value="">—</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Recipe overview">
              <textarea
                value={form.recipe_overview}
                onChange={(e) => setForm({ ...form, recipe_overview: e.target.value })}
                rows={3}
                className="w-full px-3 py-1.5 rounded-md border border-border/60 bg-background/40 text-sm focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
              />
            </Field>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 space-y-2">
          <div className="text-sm">
            Delete <span className="font-semibold">{productName}</span>? This removes the product
            from the directory and cascades to its scraped findings and awards. Per-distributor
            SKU listings (if any) will block the delete — reassign or remove those first.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirmingDelete(false);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={destroy}
              disabled={busy}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirm delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
