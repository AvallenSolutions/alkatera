/**
 * Recognising two liquids that are the same recipe.
 *
 * The 1:1 migration gave every product its own liquid, which is the safe
 * starting state but not the true one: a distillery with a 700ml and a 50ml of
 * the same gin now has two liquids holding an identical recipe. Decision 2 of
 * tasks/liquid-and-pack-plan.md settles what to do about it: the platform
 * detects and proposes, the user holds the authority to merge, never silent.
 *
 * The comparison is deliberately exact. A fuzzy "these look similar" would be
 * proposing that someone collapse two recipes that differ, and a recipe is the
 * product. Same ingredients, same amounts, same units, same batch scale, or it
 * is not the same liquid.
 */

import { normaliseIngredientName } from './ingredient-duplicates';
import {
  groupByFingerprint,
  suggestSurvivor,
  type CompositionLike,
  type IdenticalGroup,
} from './composition-identity';

export interface LiquidRecipeLine {
  material_name: string;
  quantity: number | string | null;
  unit: string | null;
}

export interface LiquidLike extends CompositionLike {
  recipe_scale_mode?: string | null;
  batch_yield_value?: number | string | null;
  batch_yield_unit?: string | null;
  /** The liquid's recipe, from the material rows of the products that bottle it. */
  lines: LiquidRecipeLine[];
}

/**
 * A stable string for a liquid's recipe.
 *
 * Lines are sorted, so the order they were entered in does not matter, and
 * ingredient names go through the same normalisation the ingredient shelf
 * uses, so "Juniper Berries" and "juniper berry" do not split a liquid in two.
 * Quantities are compared as numbers so "12" and 12 agree.
 *
 * Units are NOT converted. 12 g and 0.012 kg are the same amount, but treating
 * them as the same recipe means guessing at a density for every volume unit,
 * and a wrong guess here proposes merging two liquids that differ. Leaving
 * them distinct costs a merge the user can still make by hand.
 */
export function liquidRecipeFingerprint(liquid: LiquidLike): string {
  const lines = liquid.lines
    .map((line) => {
      const name = normaliseIngredientName(line.material_name ?? '');
      const qty = Number(line.quantity);
      const amount = Number.isFinite(qty) ? qty : 0;
      const unit = (line.unit ?? '').trim().toLowerCase();
      return `${name}:${amount}:${unit}`;
    })
    .filter((line) => !line.startsWith(':'))
    .sort();

  if (lines.length === 0) return '';

  const mode = liquid.recipe_scale_mode ?? 'per_unit';
  const yieldValue = Number(liquid.batch_yield_value);
  const scale =
    mode === 'per_batch' && Number.isFinite(yieldValue)
      ? `${mode}:${yieldValue}:${(liquid.batch_yield_unit ?? '').toLowerCase()}`
      : mode;

  return `${scale}|${lines.join('|')}`;
}

export type IdenticalLiquidGroup = IdenticalGroup<LiquidLike>;

/**
 * Group liquids whose recipes are identical. The grouping itself is shared
 * with pack formats (`composition-identity`); only the fingerprint differs.
 */
export function findIdenticalLiquids(liquids: LiquidLike[]): IdenticalLiquidGroup[] {
  return groupByFingerprint(liquids, liquidRecipeFingerprint);
}

/**
 * Which liquid of an identical group to keep: the one already bottled by the
 * most products, so a merge repoints the fewest. Only a suggestion.
 */
export const suggestLiquidSurvivor = suggestSurvivor<LiquidLike>;
