'use client';

/**
 * Recipe editor — add ingredients and compute impact via the shared LCA engine.
 * Generic over recipe kind (meal / made-drink).
 *
 * A recipe is a `products` row. Ingredients are written to `product_materials`
 * (material_type='ingredient') client-side, then `calculateProductLCA` resolves
 * each ingredient to an emission factor and writes per-functional-unit impacts
 * to product_carbon_footprints. We read those back and divide by the portion
 * count to show per-portion impact.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { autoMatchEmissionFactor, type EmissionFactorMatch } from '@/lib/products/ef-auto-match';
import { useOrganization } from '@/lib/organizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  MEAL_INGREDIENT_UNITS,
  type HospitalityMealDetail,
  type MealIngredient,
} from '@/lib/hospitality/meal-types';
import type { RecipeKindConfig } from '@/lib/hospitality/recipe-kinds';

interface Row extends MealIngredient {
  key: string;
  /** undefined = not checked yet, null = checked but no factor found. */
  match?: EmissionFactorMatch | null;
  matching?: boolean;
}

let rowSeq = 0;
function newRow(partial?: Partial<MealIngredient>): Row {
  rowSeq += 1;
  return {
    key: `row-${rowSeq}`,
    material_name: partial?.material_name ?? '',
    quantity: partial?.quantity ?? 0,
    unit: partial?.unit ?? 'g',
  };
}

type MatchTone = 'good' | 'attention' | 'quiet';
/** Map a row's factor-match state to a typographic state chip. */
function matchStatus(row: Row): { label: string; tone: MatchTone } | null {
  if (row.matching) return { label: 'Checking factor…', tone: 'quiet' };
  if (row.match === undefined) return null;
  if (row.match === null) return { label: 'No factor match', tone: 'attention' };
  const grade = row.match.ef_data_quality_grade;
  const source = row.match.ef_source_type;
  if (source === 'primary' || grade === 'HIGH') return { label: 'Factor matched', tone: 'good' };
  if (grade === 'LOW') return { label: 'Approximate factor', tone: 'attention' };
  return { label: 'Factor matched', tone: 'good' };
}

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

export function RecipeEditor({
  cfg,
  recipeId,
  ingredientLabel,
  renderExtra,
}: {
  cfg: RecipeKindConfig
  recipeId: string
  /** Heading for the ingredient section (e.g. "Consumables" for rooms). */
  ingredientLabel?: string
  /** Optional content rendered below the recipe (passed the loaded recipe so it
   *  can show, e.g., a room's allocated energy + per-night total). */
  renderExtra?: (recipe: HospitalityMealDetail) => React.ReactNode
}) {
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;
  const portion = cfg.portionWord;
  const portionTitle = `${portion[0].toUpperCase()}${portion.slice(1)}`;

  const [recipe, setRecipe] = useState<HospitalityMealDetail | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [covers, setCovers] = useState('1');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'calculate'>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Ingredient names already used across this org's recipes — powers autocomplete
  // so common ingredients aren't retyped on every dish.
  const [knownIngredients, setKnownIngredients] = useState<string[]>([]);

  // Resolve an ingredient name to an emission factor so the user sees, before
  // calculating, whether it matched a real factor or only an approximate one.
  // The match is also persisted so the LCA uses the resolved factor (not just a
  // name guess). Stale results (name changed mid-flight) are discarded.
  const matchRow = useCallback(
    async (key: string, name: string) => {
      const q = name.trim();
      if (!orgId || !q) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, match: undefined, matching: false } : r)));
        return;
      }
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, matching: true } : r)));
      const match = await autoMatchEmissionFactor({ query: q, organizationId: orgId, materialType: 'ingredient' });
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== key || r.material_name.trim() !== q) return r;
          return { ...r, match: match ?? null, matching: false };
        }),
      );
    },
    [orgId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${cfg.apiBase}/${recipeId}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load ${cfg.label.toLowerCase()}`);
      }
      const body = await res.json();
      const m: HospitalityMealDetail = body.recipe;
      setRecipe(m);
      setCovers(String(m.covers));
      const loaded = m.ingredients.length ? m.ingredients.map((i) => newRow(i)) : [newRow()];
      setRows(loaded);
      // Rebuild factor-match badges for the loaded ingredients.
      loaded.forEach((r) => {
        if (r.material_name.trim()) void matchRow(r.key, r.material_name);
      });
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : `Failed to load ${cfg.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [cfg.apiBase, cfg.label, recipeId, matchRow]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/hospitality/ingredients', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { ingredients: [] }))
      .then((body) => {
        if (!cancelled) setKnownIngredients(body.ingredients ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const aiExtract = async () => {
    if (!aiText.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/hospitality/parse-recipe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not parse');
      const parsed: MealIngredient[] = body.ingredients ?? [];
      if (parsed.length === 0) {
        setAiError('No ingredients found in that text.');
        return;
      }
      // Replace empty rows; append the parsed ingredients.
      const added = parsed.map((p) => newRow(p));
      setRows((prev) => {
        const kept = prev.filter((r) => r.material_name.trim().length > 0);
        return [...kept, ...added];
      });
      added.forEach((r) => { if (r.material_name.trim()) void matchRow(r.key, r.material_name); });
      setAiOpen(false);
      setAiText('');
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Could not parse');
    } finally {
      setAiBusy(false);
    }
  };

  const persist = useCallback(async (): Promise<boolean> => {
    const coversNum = Number(covers);
    if (!Number.isFinite(coversNum) || coversNum <= 0) {
      setCalcError(`${portionTitle}s must be greater than 0.`);
      return false;
    }
    const clean = rows
      .map((r) => ({ ...r, material_name: r.material_name.trim(), quantity: Number(r.quantity) }))
      .filter((r) => r.material_name.length > 0);
    if (clean.some((r) => !Number.isFinite(r.quantity) || r.quantity <= 0)) {
      setCalcError('Every ingredient needs a quantity greater than 0.');
      return false;
    }

    const patchRes = await fetch(`${cfg.apiBase}/${recipeId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ covers: coversNum }),
    });
    if (!patchRes.ok) {
      const body = await patchRes.json().catch(() => ({}));
      setCalcError(body?.error || `Could not save ${portion}s.`);
      return false;
    }

    const productId = Number(recipeId);
    const { error: delErr } = await supabase
      .from('product_materials')
      .delete()
      .eq('product_id', productId)
      .eq('material_type', 'ingredient');
    if (delErr) {
      setCalcError(delErr.message);
      return false;
    }
    if (clean.length > 0) {
      const { error: insErr } = await supabase.from('product_materials').insert(
        clean.map((r) => {
          const base: Record<string, unknown> = {
            product_id: productId,
            material_name: r.material_name,
            quantity: r.quantity,
            unit: r.unit,
            material_type: 'ingredient',
          };
          // Attach the resolved emission factor so the LCA uses it (the
          // data_source_integrity CHECK requires the matching id alongside).
          const m = r.match;
          if (m && m.data_source === 'openlca' && m.data_source_id) {
            base.data_source = 'openlca';
            base.data_source_id = m.data_source_id;
            base.openlca_database = m.openlca_database ?? 'ecoinvent';
            base.matched_source_name = m.matched_source_name ?? null;
            base.cached_co2_factor = m.carbon_intensity ?? null;
          } else if (m && m.data_source === 'supplier' && m.supplier_product_id) {
            base.data_source = 'supplier';
            base.supplier_product_id = m.supplier_product_id;
            base.matched_source_name = m.matched_source_name ?? null;
            base.cached_co2_factor = m.carbon_intensity ?? null;
          }
          return base;
        }),
      );
      if (insErr) {
        setCalcError(insErr.message);
        return false;
      }
    }
    return true;
  }, [covers, rows, recipeId, cfg.apiBase, portion, portionTitle]);

  const saveRecipe = async () => {
    setBusy('save');
    setCalcError(null);
    try {
      if (await persist()) {
        toast({ title: 'Recipe saved' });
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  const calculate = async () => {
    setBusy('calculate');
    setCalcError(null);
    setProgress(null);
    try {
      if (!(await persist())) return;
      const result = await calculateProductLCA({
        productId: String(recipeId),
        systemBoundary: 'cradle-to-gate',
        onProgress: (step) => setProgress(step),
      });
      if (!result.success) {
        setCalcError(result.error || 'Calculation failed.');
        return;
      }
      toast({ title: 'Impact calculated' });
      await load();
    } catch (e: unknown) {
      setCalcError(e instanceof Error ? e.message : 'Calculation failed.');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const backLink = (
    <Link
      href={`${cfg.basePath}/`}
      className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
    >
      ← {cfg.labelPlural}
    </Link>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-[6px]" />
      </div>
    );
  }

  if (loadError || !recipe) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {backLink}
        <p className="text-sm text-studio-stale">{loadError || `${cfg.label} not found`}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      {backLink}

      <div className="min-w-0">
        <Statement
          eyebrow={`THE WORKBENCH · ${cfg.labelPlural.toUpperCase()}`}
          headline={recipe.name.endsWith('.') ? recipe.name : `${recipe.name}.`}
        >
          {recipe.impact && (
            <>
              <BigNumber
                size="display"
                value={fmt(recipe.impact.per_cover_co2e)}
                label={`KG CO₂E / ${portion.toUpperCase()}`}
              />
              <BigNumber
                size="display"
                value={fmt(recipe.impact.per_cover_water)}
                label={`M³ WATER / ${portion.toUpperCase()}`}
              />
              <BigNumber
                size="display"
                value={fmt(recipe.impact.per_cover_land)}
                label={`M² LAND / ${portion.toUpperCase()}`}
              />
            </>
          )}
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Add the ingredients in this {cfg.label.toLowerCase()}, then calculate its impact.
        </p>
      </div>

      <section className="border-t border-border pt-5">
        <Eyebrow className="mb-4">{ingredientLabel ?? 'Recipe'}</Eyebrow>
        <div className="space-y-3">
          <div className="w-40 space-y-1">
            <Label htmlFor="recipe-covers">{portionTitle}s</Label>
            <Input
              id="recipe-covers"
              type="number"
              min="1"
              step="1"
              value={covers}
              onChange={(e) => setCovers(e.target.value)}
            />
          </div>

          <datalist id="hospitality-known-ingredients">
            {knownIngredients.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr,7rem,8rem,2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ingredient</span>
              <span>Quantity</span>
              <span>Unit</span>
              <span />
            </div>
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,7rem,8rem,2.5rem]">
                <div className="space-y-1">
                  <Input
                    list="hospitality-known-ingredients"
                    placeholder={
                      cfg.kind === 'drink' ? 'e.g. Gin' : cfg.kind === 'room_night' ? 'e.g. Bread (breakfast)' : 'e.g. Beef mince'
                    }
                    value={row.material_name}
                    onChange={(e) => updateRow(row.key, { material_name: e.target.value, match: undefined })}
                    onBlur={() => matchRow(row.key, row.material_name)}
                  />
                  {(() => {
                    const status = matchStatus(row);
                    if (!status) return null;
                    return <StateChip tone={status.tone}>{status.label}</StateChip>;
                  })()}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={row.quantity === 0 ? '' : String(row.quantity)}
                  onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                />
                <Select value={row.unit} onValueChange={(v) => updateRow(row.key, { unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_INGREDIENT_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  aria-label="Remove ingredient"
                  className="justify-self-start rounded px-2 py-2 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale sm:justify-self-auto"
                  onClick={() => removeRow(row.key)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <PillButton variant="ghost" size="sm" onClick={addRow}>
              Add ingredient
            </PillButton>
            <PillButton variant="ghost" size="sm" onClick={() => { setAiError(null); setAiOpen(true); }}>
              Paste &amp; AI-fill
            </PillButton>
          </div>

          {calcError && <p className="text-sm text-studio-stale">{calcError}</p>}
          {progress && <p className="text-sm text-muted-foreground">{progress}…</p>}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <PillButton variant="outline" onClick={saveRecipe} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save recipe'}
        </PillButton>
        <PillButton variant="room" onClick={calculate} disabled={busy !== null}>
          {busy === 'calculate' ? 'Calculating…' : 'Calculate impact'}
        </PillButton>
      </div>

      {renderExtra && renderExtra(recipe)}

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste a recipe</DialogTitle>
            <DialogDescription>
              Paste an ingredient list or recipe and we&apos;ll extract the ingredients and
              quantities into the builder.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            placeholder={'600g beef mince\n2 onions, diced\n400g chopped tomatoes\n2 tbsp olive oil'}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)} disabled={aiBusy}>
              Cancel
            </Button>
            <Button onClick={aiExtract} disabled={aiBusy || !aiText.trim()}>
              {aiBusy ? 'Extracting…' : 'Extract ingredients'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
