"use client";

/**
 * What this product is made from, above its recipe.
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
import { switchProductLiquid } from "@/lib/products/switch-liquid";
import { Eyebrow } from "@/components/studio/eyebrow";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface LiquidOption {
  id: string;
  name: string;
  productCount: number;
}

interface LiquidStripProps {
  /**
   * The PRODUCT's organisation, not whichever one the browser is switched to.
   * They normally agree, but when they diverge the liquid list would come from
   * the wrong organisation and the picker would silently offer nothing.
   */
  organizationId: string;
  productId: string;
  liquidId: string | null;
  /** Called after the product's liquid changes, so the editor can reload. */
  onChanged: () => void;
}

export function LiquidStrip({
  organizationId,
  productId,
  liquidId,
  onChanged,
}: LiquidStripProps) {
  const [options, setOptions] = useState<LiquidOption[]>([]);
  const [siblings, setSiblings] = useState<{ id: number; name: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let live = true;

    (async () => {
      const { data: liquids } = await supabase
        .from("liquids")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name");

      const { data: products } = await supabase
        .from("products")
        .select("id, name, liquid_id")
        .eq("organization_id", organizationId)
        .not("liquid_id", "is", null);

      if (!live) return;

      const counts = new Map<string, number>();
      const others: { id: number; name: string }[] = [];
      for (const p of (products ?? []) as any[]) {
        counts.set(p.liquid_id, (counts.get(p.liquid_id) ?? 0) + 1);
        if (liquidId && p.liquid_id === liquidId && String(p.id) !== String(productId)) {
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
      // The ordering rules live in switchProductLiquid, where they can be
      // tested: read the donor before clearing, link last, never clear when
      // there is nothing to put in place.
      const result = await switchProductLiquid(
        {
          async donorFor(liquidId, excludingProductId) {
            const { data } = await supabase
              .from("products")
              .select("id")
              .eq("liquid_id", liquidId)
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
              .eq("material_type", "ingredient");
            if (error) throw error;
            return data ?? [];
          },
          async replaceIngredients(targetProductId, rows) {
            const { error: clearError } = await supabase
              .from("product_materials")
              .delete()
              .eq("product_id", targetProductId)
              .eq("material_type", "ingredient");
            if (clearError) throw clearError;
            if (rows.length === 0) return;
            const { error: insertError } = await supabase
              .from("product_materials")
              .insert(rows);
            if (insertError) throw insertError;
          },
          async setLiquid(targetProductId, liquidId) {
            const { error } = await supabase
              .from("products")
              .update({ liquid_id: liquidId })
              .eq("id", targetProductId);
            if (error) throw error;
          },
        },
        Number(productId),
        pendingId
      );

      toast.success(
        result.adoptedRecipe
          ? `Now made from ${pending?.name}, with its ${result.rowsCopied} ingredient${result.rowsCopied === 1 ? "" : "s"}.`
          : `Now made from ${pending?.name}.`
      );
      setPendingId(null);
      setPicking(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Could not switch this product's liquid");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-studio-hairline pb-4">
        <div className="min-w-0">
          <Eyebrow>Made from</Eyebrow>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[15px] font-semibold text-studio-ink">
              {current ? current.name : "No liquid yet"}
            </span>
            {siblings.length > 0 && (
              <StateChip tone="good">
                Shared with {siblings.length} other format{siblings.length === 1 ? "" : "s"}
              </StateChip>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-studio-dim">
            {siblings.length > 0 ? (
              <>
                Editing this recipe also updates{" "}
                {siblings.slice(0, 2).map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/products/${s.id}/recipe?tab=ingredients`}
                      className="text-studio-ink underline decoration-studio-hairline underline-offset-2"
                    >
                      {s.name}
                    </Link>
                  </span>
                ))}
                {siblings.length > 2 && ` +${siblings.length - 2}`}.
              </>
            ) : current ? (
              "Only this product uses it. Point another format at it to share the recipe."
            ) : (
              "Save a recipe and this product gets a liquid of its own."
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {picking ? (
            <>
              <Select value={pendingId ?? ""} onValueChange={setPendingId}>
                <SelectTrigger className="h-9 w-[240px] text-xs">
                  <SelectValue placeholder="Choose a liquid you make" />
                </SelectTrigger>
                <SelectContent>
                  {options
                    .filter((o) => o.id !== liquidId)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">
                        {o.name}
                        {o.productCount > 0 &&
                          ` · ${o.productCount} format${o.productCount === 1 ? "" : "s"}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
            </>
          ) : (
            <PillButton variant="outline" onClick={() => setPicking(true)}>
              Use another liquid
            </PillButton>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(pendingId) && picking} onOpenChange={(o) => !o && setPendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make this product from {pending?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This product&apos;s ingredients will be replaced with {pending?.name}&apos;s recipe,
              and from then on the two stay in step: correcting one corrects both. Its packaging,
              fill volume and everything else are untouched.
              {current && siblings.length === 0 && (
                <> The liquid it uses now, {current.name}, will be left with no products.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Keep as it is</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applySwitch(); }} disabled={switching}>
              {switching ? "Switching…" : "Use this liquid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
