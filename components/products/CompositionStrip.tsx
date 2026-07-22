"use client";

/**
 * What this product is made from, or packed in, above its rows.
 *
 * One component for both halves of the composition, because the interaction is
 * the same: say what it uses, warn when an edit will reach other products, and
 * let the user point it at one they already have.
 *
 * The composition model says a product is one liquid at a fill volume in one
 * pack format. Until now the liquid was invisible: the entity existed and the
 * fan-out worked, but nothing told a user their recipe was shared, or let them
 * point a second format at a liquid they already make.
 *
 * This is the "same liquid, different pack" case the whole model exists for.
 * Switching a product onto an existing liquid replaces its ingredients with
 * that liquid's, which is a real change to a saved recipe, so it asks first.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { switchProductComposition } from "@/lib/products/switch-composition";
import { Eyebrow } from "@/components/studio/eyebrow";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { RecordPicker } from "@/components/studio/record-picker";
import { COMPOSABLE_PRODUCT_KIND } from "@/lib/products/composable-kind";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CompositionOption {
  id: string;
  name: string;
  productCount: number;
}

/** Everything that differs between the liquid half and the pack half. */
const KINDS = {
  liquid: {
    table: 'liquids',
    linkColumn: 'liquid_id',
    materialType: 'ingredient',
    eyebrow: 'Made from',
    empty: 'No liquid yet',
    emptyHint: 'Save a recipe and this product gets a liquid of its own.',
    loneHint: 'Only this product uses it. Point another format at it to share the recipe.',
    pick: 'Use another liquid',
    placeholder: 'Search the liquids you make',
    sharedNoun: 'format',
    editNoun: 'recipe',
    tab: 'ingredients',
    rowsNoun: 'ingredient',
  },
  pack: {
    table: 'pack_formats',
    linkColumn: 'pack_format_id',
    materialType: 'packaging',
    eyebrow: 'Packed in',
    empty: 'No pack format yet',
    emptyHint: 'Save packaging and this product gets a pack format of its own.',
    loneHint: 'Only this product uses it. Point another product at it to share the spec.',
    pick: 'Use another pack',
    placeholder: 'Search the packs you already use',
    sharedNoun: 'product',
    editNoun: 'packaging',
    tab: 'packaging',
    rowsNoun: 'component',
  },
} as const;

export type CompositionStripKind = keyof typeof KINDS;

interface CompositionStripProps {
  /** Which half of the composition this strip governs. */
  kind: CompositionStripKind;
  /**
   * The PRODUCT's organisation, not whichever one the browser is switched to.
   * They normally agree, but when they diverge the liquid list would come from
   * the wrong organisation and the picker would silently offer nothing.
   */
  organizationId: string;
  productId: string;
  /** The product's current composition id for this kind. */
  liquidId: string | null;
  /** Called after the product's composition changes, so the editor can reload. */
  onChanged: () => void;
}

export function CompositionStrip({
  kind,
  organizationId,
  productId,
  liquidId,
  onChanged,
}: CompositionStripProps) {
  const K = KINDS[kind];
  const [options, setOptions] = useState<CompositionOption[]>([]);
  const [siblings, setSiblings] = useState<{ id: number; name: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let live = true;

    (async () => {
      const { data: liquids } = await supabase
        .from(K.table)
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name");

      const { data: products } = await supabase
        .from("products")
        .select(`id, name, ${K.linkColumn}`)
        .eq("organization_id", organizationId)
        .eq("product_kind", COMPOSABLE_PRODUCT_KIND)
        .not(K.linkColumn, "is", null);

      if (!live) return;

      const counts = new Map<string, number>();
      const others: { id: number; name: string }[] = [];
      for (const p of (products ?? []) as any[]) {
        const link = p[K.linkColumn];
        counts.set(link, (counts.get(link) ?? 0) + 1);
        if (liquidId && link === liquidId && String(p.id) !== String(productId)) {
          others.push({ id: p.id, name: p.name });
        }
      }

      setOptions(
        (liquids ?? []).map((l: any) => ({
          id: l.id,
          name: l.name,
          productCount: counts.get(l.id) ?? 0,
        }))
      );
      setSiblings(others);
    })();

    return () => {
      live = false;
    };
  }, [organizationId, productId, liquidId]);

  const current = options.find((o) => o.id === liquidId) ?? null;
  const pending = options.find((o) => o.id === pendingId) ?? null;

  const applySwitch = async () => {
    if (!pendingId) return;
    setSwitching(true);
    try {
      // The ordering rules live in switchProductComposition, where they can be
      // tested: read the donor before clearing, link last, never clear when
      // there is nothing to put in place.
      const result = await switchProductComposition(
        {
          async donorFor(liquidId, excludingProductId) {
            const { data } = await supabase
              .from("products")
              .select("id")
              .eq(K.linkColumn, pendingId)
              .neq("id", excludingProductId)
              .limit(1)
              .maybeSingle();
            return (data?.id as number) ?? null;
          },
          async ingredientRows(donorProductId) {
            const { data, error } = await supabase
              .from("product_materials")
              .select("*")
              .eq("product_id", donorProductId)
              .eq("material_type", K.materialType);
            if (error) throw error;
            return data ?? [];
          },
          async replaceIngredients(targetProductId, rows) {
            const { error: clearError } = await supabase
              .from("product_materials")
              .delete()
              .eq("product_id", targetProductId)
              .eq("material_type", K.materialType);
            if (clearError) throw clearError;
            if (rows.length === 0) return;
            const { error: insertError } = await supabase
              .from("product_materials")
              .insert(rows);
            if (insertError) throw insertError;
          },
          async setLiquid(targetProductId, compositionId) {
            const { error } = await supabase
              .from("products")
              .update({ [K.linkColumn]: compositionId })
              .eq("id", targetProductId);
            if (error) throw error;
          },
        },
        Number(productId),
        pendingId
      );

      toast.success(
        result.adoptedRecipe
          ? `Now ${K.eyebrow.toLowerCase()} ${pending?.name}, with its ${result.rowsCopied} ${K.rowsNoun}${result.rowsCopied === 1 ? "" : "s"}.`
          : `Now ${K.eyebrow.toLowerCase()} ${pending?.name}.`
      );
      setPendingId(null);
      setPicking(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? `Could not switch this product's ${kind === "pack" ? "pack format" : "liquid"}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-studio-hairline pb-4">
        <div className="min-w-0">
          <Eyebrow>{K.eyebrow}</Eyebrow>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[15px] font-semibold text-studio-ink">
              {current ? current.name : K.empty}
            </span>
            {siblings.length > 0 && (
              <StateChip tone="good">
                Shared with {siblings.length} other {K.sharedNoun}{siblings.length === 1 ? "" : "s"}
              </StateChip>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-studio-dim">
            {siblings.length > 0 ? (
              <>
                Editing this {K.editNoun} also updates{" "}
                {siblings.slice(0, 2).map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/products/${s.id}/recipe?tab=${K.tab}`}
                      className="text-studio-ink underline decoration-studio-hairline underline-offset-2"
                    >
                      {s.name}
                    </Link>
                  </span>
                ))}
                {siblings.length > 2 && ` +${siblings.length - 2}`}.
              </>
            ) : current ? (
              K.loneHint
            ) : (
              K.emptyHint
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {picking ? (
            <button
              type="button"
              onClick={() => {
                setPicking(false);
                setPendingId(null);
              }}
              className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim underline decoration-studio-hairline underline-offset-4 hover:text-studio-ink"
            >
              Cancel
            </button>
          ) : (
            <>
              {/*
                The under-a-minute case the whole composition model exists for:
                a producer who already makes this gin adds the 50 ml. The
                compose surface opens with the liquid slot already filled, so
                nothing about the recipe is asked again.
              */}
              {kind === "liquid" && current && (
                <Link
                  href={`/products/new/compose?liquid=${current.id}`}
                  className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim underline decoration-studio-hairline underline-offset-4 hover:text-studio-ink"
                >
                  Same liquid, different pack
                </Link>
              )}
              <PillButton variant="outline" onClick={() => setPicking(true)}>
                {K.pick}
              </PillButton>
            </>
          )}
        </div>

        {picking && (
          <div className="w-full max-w-md">
            <RecordPicker
              id={`composition-picker-${kind}`}
              placeholder={K.placeholder}
              emptyLabel={K.emptyHint}
              options={options
                .filter((o) => o.id !== liquidId)
                .map((o) => ({
                  id: o.id,
                  name: o.name,
                  hint:
                    o.productCount > 0
                      ? `${o.productCount} ${K.sharedNoun}${o.productCount === 1 ? "" : "s"}`
                      : undefined,
                }))}
              onSelect={setPendingId}
            />
          </div>
        )}
      </div>

      {/*
        Gated on the RESOLVED option, not the raw id. The options list reloads
        whenever the composition changes, and an id that outlives its option
        (mid-reload, or after a switch) rendered a dialog headed "Pack this
        product in undefined?" offering to replace the recipe with nothing.
        No option, no question.
      */}
      <AlertDialog open={Boolean(pending) && picking} onOpenChange={(o) => !o && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === "pack"
                ? `Pack this product in ${pending?.name}?`
                : `Make this product from ${pending?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This product&apos;s {K.editNoun} will be replaced with {pending?.name}&apos;s, and
              from then on the two stay in step: correcting one corrects both.{" "}
              {kind === "pack"
                ? "Its recipe, fill volume and everything else are untouched."
                : "Its packaging, fill volume and everything else are untouched."}
              {current && siblings.length === 0 && (
                <> The one it uses now, {current.name}, will be left with no products.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Keep as it is</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applySwitch(); }} disabled={switching}>
              {switching ? "Switching…" : kind === "pack" ? "Use this pack" : "Use this liquid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
