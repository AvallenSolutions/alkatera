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
import { ChevronLeft, Plus, Trash2, Calculator, Leaf, Droplets, Trees, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
      setRows(m.ingredients.length ? m.ingredients.map((i) => newRow(i)) : [newRow()]);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : `Failed to load ${cfg.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [cfg.apiBase, cfg.label, recipeId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (key: string, patch: Partial<MealIngredient>) => {
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
      setRows((prev) => {
        const kept = prev.filter((r) => r.material_name.trim().length > 0);
        return [...kept, ...parsed.map((p) => newRow(p))];
      });
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
        clean.map((r) => ({
          product_id: productId,
          material_name: r.material_name,
          quantity: r.quantity,
          unit: r.unit,
          material_type: 'ingredient',
        })),
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

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError || !recipe) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Link href={`${cfg.basePath}/`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {cfg.labelPlural}
        </Link>
        <p className="text-sm text-destructive">{loadError || `${cfg.label} not found`}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <Link href={`${cfg.basePath}/`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        {cfg.labelPlural}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{recipe.name}</h1>
        <p className="text-sm text-muted-foreground">
          Add the ingredients in this {cfg.label.toLowerCase()}, then calculate its impact.
        </p>
      </div>

      {recipe.impact && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Leaf className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Carbon / {portion}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fmt(recipe.impact.per_cover_co2e)}</p>
              <p className="text-xs text-muted-foreground">kg CO₂e</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Droplets className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Water / {portion}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fmt(recipe.impact.per_cover_water)}</p>
              <p className="text-xs text-muted-foreground">m³</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Trees className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Land / {portion}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fmt(recipe.impact.per_cover_land)}</p>
              <p className="text-xs text-muted-foreground">m²</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ingredientLabel ?? 'Recipe'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr,7rem,8rem,2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ingredient</span>
              <span>Quantity</span>
              <span>Unit</span>
              <span />
            </div>
            {rows.map((row) => (
              <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,7rem,8rem,2.5rem]">
                <Input
                  placeholder={
                    cfg.kind === 'drink' ? 'e.g. Gin' : cfg.kind === 'room_night' ? 'e.g. Bread (breakfast)' : 'e.g. Beef mince'
                  }
                  value={row.material_name}
                  onChange={(e) => updateRow(row.key, { material_name: e.target.value })}
                />
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeRow(row.key)}
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add ingredient
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAiError(null); setAiOpen(true); }}>
              <Sparkles className="mr-2 h-4 w-4" />
              Paste &amp; AI-fill
            </Button>
          </div>

          {calcError && <p className="text-sm text-destructive">{calcError}</p>}
          {progress && <p className="text-sm text-muted-foreground">{progress}…</p>}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={saveRecipe} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save recipe'}
        </Button>
        <Button onClick={calculate} disabled={busy !== null}>
          <Calculator className="mr-2 h-4 w-4" />
          {busy === 'calculate' ? 'Calculating…' : 'Calculate impact'}
        </Button>
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
              <Sparkles className="mr-2 h-4 w-4" />
              {aiBusy ? 'Extracting…' : 'Extract ingredients'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
