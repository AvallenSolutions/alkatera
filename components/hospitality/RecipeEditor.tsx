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
import { autoMatchEmissionFactor, type EmissionFactorMatch } from '@/lib/products/ef-auto-match';
import { IngredientFactorPicker } from '@/components/hospitality/IngredientFactorPicker';
import { COOKING_METHOD_OPTIONS } from '@/lib/hospitality/cooking-energy';
import { DIETARY_TAGS, ALLERGENS, dietaryLabel, allergenLabel } from '@/lib/hospitality/dietary';
import { useOrganization } from '@/lib/organizationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  /** undefined = not checked yet, null = checked but no factor found. */
  match?: EmissionFactorMatch | null;
  matching?: boolean;
  /** True once the user has manually picked a factor — auto-match must not overwrite it. */
  matchLocked?: boolean;
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

type BadgeTone = 'ok' | 'warn' | 'muted';
/** Map a row's factor-match state to a small status badge. */
function matchStatus(row: Row): { label: string; tone: BadgeTone } | null {
  if (row.matching) return { label: 'Checking factor…', tone: 'muted' };
  if (row.match === undefined) return null;
  if (row.match === null) return { label: 'No factor match', tone: 'warn' };
  const grade = row.match.ef_data_quality_grade;
  const source = row.match.ef_source_type;
  if (source === 'primary' || grade === 'HIGH') return { label: 'Factor matched', tone: 'ok' };
  if (grade === 'LOW') return { label: 'Approximate factor', tone: 'warn' };
  return { label: 'Factor matched', tone: 'ok' };
}

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'border-transparent bg-primary/15 text-primary',
  warn: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
};

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

  const COOKING_NONE = '__none__';
  const canCook = cfg.kind === 'meal';

  const [recipe, setRecipe] = useState<HospitalityMealDetail | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [covers, setCovers] = useState('1');
  const [prepWaste, setPrepWaste] = useState('0');
  const [cookingMethod, setCookingMethod] = useState<string>(COOKING_NONE);
  const [cookingMinutes, setCookingMinutes] = useState('');
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const canTag = cfg.kind !== 'room_night';
  const toggle = (list: string[], setter: (v: string[]) => void, value: string) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
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
      // A user-picked factor is authoritative — never let an auto-match overwrite it.
      let locked = false;
      setRows((prev) => {
        const row = prev.find((r) => r.key === key);
        locked = !!row?.matchLocked;
        return prev;
      });
      if (locked) return;
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
      setPrepWaste(String(m.prep_waste_pct ?? 0));
      setCookingMethod(m.cooking_method ?? COOKING_NONE);
      setCookingMinutes(m.cooking_minutes != null ? String(m.cooking_minutes) : '');
      setDietaryTags(Array.isArray(m.dietary_tags) ? m.dietary_tags : []);
      setAllergens(Array.isArray(m.allergens) ? m.allergens : []);
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

    // Saving real quantities clears any import-placeholder / AI-estimate flag.
    const patchBody: Record<string, unknown> = { covers: coversNum, quantities_status: 'confirmed' };
    const prepPct = Number(prepWaste);
    patchBody.prep_waste_pct = Number.isFinite(prepPct) ? Math.min(100, Math.max(0, prepPct)) : 0;
    if (canCook) {
      patchBody.cooking_method = cookingMethod === COOKING_NONE ? null : cookingMethod;
      patchBody.cooking_minutes = cookingMinutes === '' ? null : Number(cookingMinutes);
    }
    if (canTag) {
      patchBody.dietary_tags = dietaryTags;
      patchBody.allergens = allergens;
    }
    const patchRes = await fetch(`${cfg.apiBase}/${recipeId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
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
  }, [covers, rows, recipeId, cfg.apiBase, portion, portionTitle, prepWaste, cookingMethod, cookingMinutes, canCook, COOKING_NONE, canTag, dietaryTags, allergens]);

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

      {recipe.quantities_status === 'unconfirmed' && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          This {cfg.label.toLowerCase()} was imported with placeholder quantities of 1 g/ml. Set the real
          amounts and save the recipe before calculating its impact.
        </div>
      )}

      {recipe.impact && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <Leaf className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium text-muted-foreground">Carbon / {portion}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fmt(recipe.impact.per_cover_display_co2e)}</p>
              <p className="text-xs text-muted-foreground">kg CO₂e</p>
              {recipe.impact.per_cover_cooking_co2e > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  incl. {Math.round(recipe.impact.per_cover_cooking_co2e * 1000)} g cooking energy
                </p>
              )}
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

      {recipe.impact && (
        <p className="text-xs text-muted-foreground">
          Covers ingredient production from farm to kitchen{canCook ? ', plus cooking energy' : ''}. Your venue&apos;s
          heating, lighting and waste are tracked separately in your facility figures, so they are not added again here.
        </p>
      )}

      {recipe.nature_score && recipe.nature_score.ratings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Trees className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Nature &amp; sourcing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                Plant-forward: <span className="font-semibold">{recipe.nature_score.plant_forward_pct}%</span>
              </span>
              <Badge
                variant="outline"
                className={
                  recipe.nature_score.risk_level === 'high'
                    ? 'border-red-500/50 text-red-600 dark:text-red-400'
                    : recipe.nature_score.risk_level === 'medium'
                      ? 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                      : 'border-primary/40 text-primary'
                }
              >
                {recipe.nature_score.risk_level} nature risk
              </Badge>
            </div>
            {recipe.nature_score.high_risk.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Hot-spots: {recipe.nature_score.high_risk.map((h) => `${h.name} (${h.note})`).join('; ')}.
                Swapping or certifying these lowers the recipe&apos;s land and biodiversity pressure.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ingredientLabel ?? 'Recipe'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="w-32 space-y-1">
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
            <div className="w-32 space-y-1">
              <Label htmlFor="recipe-prep-waste">Prep waste %</Label>
              <Input
                id="recipe-prep-waste"
                type="number"
                min="0"
                max="100"
                step="1"
                value={prepWaste}
                onChange={(e) => setPrepWaste(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Trim, peel and spoilage bought beyond what is served.</p>
            </div>
            {canCook && (
              <>
                <div className="w-44 space-y-1">
                  <Label htmlFor="recipe-cooking-method">Cooking method</Label>
                  <Select value={cookingMethod} onValueChange={setCookingMethod}>
                    <SelectTrigger id="recipe-cooking-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COOKING_NONE}>Not set</SelectItem>
                      {COOKING_METHOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <Label htmlFor="recipe-cooking-minutes">Cooking mins</Label>
                  <Input
                    id="recipe-cooking-minutes"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={cookingMinutes}
                    onChange={(e) => setCookingMinutes(e.target.value)}
                    disabled={cookingMethod === COOKING_NONE || cookingMethod === 'no_cook'}
                  />
                </div>
              </>
            )}
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
                    onChange={(e) => updateRow(row.key, { material_name: e.target.value, match: undefined, matchLocked: false })}
                    onBlur={() => matchRow(row.key, row.material_name)}
                  />
                  {(() => {
                    const status = matchStatus(row);
                    const showPicker =
                      orgId &&
                      row.material_name.trim().length > 0 &&
                      (row.matchLocked || (row.match !== undefined && !row.matching));
                    if (!status && !showPicker) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1">
                        {status && (
                          <Badge variant="outline" className={`text-[10px] font-normal ${TONE_CLASS[status.tone]}`}>
                            {status.label}
                          </Badge>
                        )}
                        {showPicker && (
                          <IngredientFactorPicker
                            organizationId={orgId}
                            ingredientName={row.material_name}
                            label={row.matchLocked || row.match ? 'Change factor' : 'Pick factor'}
                            onPicked={(m) => updateRow(row.key, { match: m, matchLocked: true, matching: false })}
                          />
                        )}
                      </div>
                    );
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

      {canTag && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dietary &amp; allergens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dietary labels (shown on the public menu)</Label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((t) => {
                  const on = dietaryTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggle(dietaryTags, setDietaryTags, t)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                    >
                      {dietaryLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Allergens present (14 UK/EU declarable)</Label>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => {
                  const on = allergens.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggle(allergens, setAllergens, a)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'border-border text-muted-foreground hover:bg-accent'}`}
                    >
                      {allergenLabel(a)}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={saveRecipe} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save recipe'}
        </Button>
        <Button onClick={calculate} disabled={busy !== null || recipe.quantities_status === 'unconfirmed'}>
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
