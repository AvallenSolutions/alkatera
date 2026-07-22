"use client";

/**
 * A product is a composition: one liquid, at a fill volume, in one pack format.
 *
 * This is L3 of tasks/liquid-and-pack-plan.md and §4 of
 * tasks/liquid-pack-entry-design.md. "New product" stops being forty fields and
 * becomes three picks, with the footprint forming as you pick rather than
 * arriving days later.
 *
 * Two rules govern the screen:
 *
 * The number forms live. As soon as the liquid and the pack are both held, the
 * estimate appears, labelled as an estimate, with the count of lines behind it.
 * That is the estimate-first birth of the dossier plan's phase 4, moved to the
 * moment of creation.
 *
 * Nothing is retyped. Picking a liquid adopts its recipe, its batch scale and
 * the fill volume of the products already bottling it; picking a pack adopts
 * its components. The rows are copied through `recipeRowsFor`, the same helper
 * the switch flow uses, so there is one story about how a composition's rows
 * reach a product.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { useProductLimit } from "@/hooks/useSubscription";
import { UpgradePromptModal } from "@/components/subscription";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { RecordPicker } from "@/components/studio/record-picker";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/page-loader";
import { recipeRowsFor } from "@/lib/products/switch-composition";
import {
  estimateComposition,
  describeEstimate,
} from "@/lib/products/composition-estimate";
import { formatPreviewKg } from "@/lib/products/impact-preview";

/** One side of the composition, as the screen needs it. */
interface Slot {
  id: string;
  name: string;
  /** Products already using it — the donor for the rows, and the count shown. */
  productIds: number[];
}

interface DonorFacts {
  category: string | null;
  unitSizeValue: number | null;
  unitSizeUnit: string | null;
  recipeScaleMode: string | null;
  bottlesPerBatch: number | null;
}

const KINDS = {
  liquid: {
    table: "liquids",
    linkColumn: "liquid_id",
    materialType: "ingredient",
    eyebrow: "Made from",
    placeholder: "Search the liquids you make",
    empty: "You have no liquids yet. Name the first one.",
    newLabel: "or name a new liquid",
    newPlaceholder: "e.g. Botanical gin",
    sharedNoun: "format",
  },
  pack: {
    table: "pack_formats",
    linkColumn: "pack_format_id",
    materialType: "packaging",
    eyebrow: "Packed in",
    placeholder: "Search the packs you already use",
    empty: "You have no pack formats yet. Name the first one.",
    newLabel: "or name a new pack format",
    newPlaceholder: "e.g. 700 ml flint bottle",
    sharedNoun: "product",
  },
} as const;

type Kind = keyof typeof KINDS;

export default function ComposeProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const { checkLimit } = useProductLimit();

  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [options, setOptions] = useState<Record<Kind, Slot[]>>({
    liquid: [],
    pack: [],
  });

  const [liquidId, setLiquidId] = useState<string | null>(null);
  const [packId, setPackId] = useState<string | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [fillUnit, setFillUnit] = useState("ml");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  /** Rows of whichever donors are currently selected, for the live number. */
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [donorFacts, setDonorFacts] = useState<DonorFacts | null>(null);
  const [creating, setCreating] = useState(false);

  const liquid = options.liquid.find((o) => o.id === liquidId) ?? null;
  const pack = options.pack.find((o) => o.id === packId) ?? null;

  // ---------------------------------------------------------------------
  // What the organisation already has
  // ---------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [{ data: liquids }, { data: packs }, { data: products }] =
        await Promise.all([
          supabase
            .from("liquids")
            .select("id, name")
            .eq("organization_id", orgId)
            .order("name"),
          supabase
            .from("pack_formats")
            .select("id, name")
            .eq("organization_id", orgId)
            .order("name"),
          supabase
            .from("products")
            .select("id, liquid_id, pack_format_id")
            .eq("organization_id", orgId),
        ]);

      const byLiquid = new Map<string, number[]>();
      const byPack = new Map<string, number[]>();
      for (const p of (products ?? []) as any[]) {
        if (p.liquid_id) {
          byLiquid.set(p.liquid_id, [...(byLiquid.get(p.liquid_id) ?? []), p.id]);
        }
        if (p.pack_format_id) {
          byPack.set(p.pack_format_id, [
            ...(byPack.get(p.pack_format_id) ?? []),
            p.id,
          ]);
        }
      }

      setOptions({
        liquid: (liquids ?? []).map((l: any) => ({
          id: l.id,
          name: l.name,
          productIds: byLiquid.get(l.id) ?? [],
        })),
        pack: (packs ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          productIds: byPack.get(p.id) ?? [],
        })),
      });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The second-format flow: "Same liquid, different pack" arrives with the
  // liquid already decided, so the screen opens with one slot filled.
  useEffect(() => {
    const preset = searchParams?.get("liquid");
    if (preset && !liquidId && options.liquid.some((o) => o.id === preset)) {
      setLiquidId(preset);
    }
  }, [searchParams, options.liquid, liquidId]);

  // ---------------------------------------------------------------------
  // The rows behind the number, and the facts worth inheriting
  // ---------------------------------------------------------------------
  useEffect(() => {
    let live = true;

    (async () => {
      const liquidDonor = liquid?.productIds[0] ?? null;
      const packDonor = pack?.productIds[0] ?? null;
      if (liquidDonor === null && packDonor === null) {
        setRows([]);
        setDonorFacts(null);
        return;
      }

      const donorIds = [liquidDonor, packDonor].filter(
        (id): id is number => id !== null
      );

      const [{ data: materials }, { data: donorProducts }, { data: liquidRow }] =
        await Promise.all([
          supabase
            .from("product_materials")
            .select("*")
            .in("product_id", donorIds),
          supabase
            .from("products")
            .select("id, product_category, unit_size_value, unit_size_unit")
            .in("id", donorIds),
          liquidId
            ? supabase
                .from("liquids")
                .select("recipe_scale_mode, batch_yield_value")
                .eq("id", liquidId)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);

      if (!live) return;

      // Only the liquid's donor may contribute ingredients and only the pack's
      // may contribute packaging. Reading both from one donor would double a
      // product's own rows into the estimate.
      const kept = ((materials ?? []) as any[]).filter((row) => {
        if (row.material_type === "packaging") return row.product_id === packDonor;
        return row.product_id === liquidDonor;
      });
      setRows(kept);

      // Facts a new format should not be asked for again: the category and the
      // fill volume of the products already bottling this liquid.
      const liquidDonorProduct = ((donorProducts ?? []) as any[]).find(
        (p) => p.id === liquidDonor
      );
      const scaleMode = (liquidRow as any)?.data?.recipe_scale_mode ?? null;
      const yieldValue = Number((liquidRow as any)?.data?.batch_yield_value) || null;
      const unitMl = liquidDonorProduct?.unit_size_value
        ? Number(liquidDonorProduct.unit_size_value)
        : null;

      setDonorFacts({
        category: liquidDonorProduct?.product_category ?? null,
        unitSizeValue: unitMl,
        unitSizeUnit: liquidDonorProduct?.unit_size_unit ?? null,
        recipeScaleMode: scaleMode,
        bottlesPerBatch:
          scaleMode === "per_batch" && yieldValue && unitMl
            ? (yieldValue * 1000) / unitMl
            : null,
      });
    })();

    return () => {
      live = false;
    };
  }, [liquid, pack, liquidId]);

  // Inheriting the fill volume, until the user says otherwise.
  useEffect(() => {
    if (!donorFacts || fillValue) return;
    if (donorFacts.unitSizeValue) {
      setFillValue(String(donorFacts.unitSizeValue));
      setFillUnit(donorFacts.unitSizeUnit || "ml");
    }
  }, [donorFacts, fillValue]);

  const unitSizeMl = useMemo(() => {
    const value = parseFloat(fillValue);
    if (!value || value <= 0) return null;
    return fillUnit === "l" ? value * 1000 : value;
  }, [fillValue, fillUnit]);

  const estimate = useMemo(
    () =>
      estimateComposition(rows as any[], {
        bottlesPerBatch: donorFacts?.bottlesPerBatch ?? undefined,
        unitSizeMl,
        category: donorFacts?.category,
      }),
    [rows, donorFacts, unitSizeMl]
  );

  const derivedName = useMemo(() => {
    if (!liquid) return "";
    const size = fillValue ? ` ${fillValue} ${fillUnit}` : "";
    return `${liquid.name}${size}`;
  }, [liquid, fillValue, fillUnit]);

  const effectiveName = nameTouched ? name : derivedName;
  const ready = Boolean(liquid && pack && effectiveName.trim());

  // ---------------------------------------------------------------------
  // Starting one inline, without leaving the composition
  // ---------------------------------------------------------------------
  const createRecord = async (kind: Kind, recordName: string) => {
    if (!orgId) return;
    const K = KINDS[kind];
    const { data, error } = await supabase
      .from(K.table)
      .insert({ organization_id: orgId, name: recordName.trim() })
      .select("id, name")
      .single();
    if (error) {
      toast.error(error.message ?? `Could not create that ${kind}`);
      return;
    }
    const slot: Slot = { id: data.id, name: data.name, productIds: [] };
    setOptions((prev) => ({
      ...prev,
      [kind]: [...prev[kind], slot].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    if (kind === "liquid") setLiquidId(slot.id);
    else setPackId(slot.id);
  };

  // ---------------------------------------------------------------------
  // The product, once there is one
  // ---------------------------------------------------------------------
  const createProduct = async () => {
    if (!orgId || !liquid || !pack || creating) return;

    const limitCheck = await checkLimit();
    if (!limitCheck.allowed) {
      setShowUpgradeModal(true);
      toast.error(limitCheck.reason || "Product limit reached");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const value = parseFloat(fillValue);
      const { data: product, error } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name: effectiveName.trim(),
          product_category: donorFacts?.category ?? null,
          unit_size_value: isNaN(value) ? null : value,
          unit_size_unit: fillValue ? fillUnit : null,
          functional_unit: fillValue ? `${fillValue} ${fillUnit}` : null,
          created_by: user.id,
          is_draft: false,
          liquid_id: liquid.id,
          pack_format_id: pack.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // The rows the composition already knows. Copied through the same helper
      // the switch flow uses, so a product born here and a product switched
      // onto the same liquid end up with identical rows.
      if (rows.length > 0) {
        const { error: rowError } = await supabase
          .from("product_materials")
          .insert(recipeRowsFor(rows, product.id));
        if (rowError) throw rowError;
      }

      await supabase.rpc("increment_product_count", { p_organization_id: orgId });

      toast.success(
        rows.length > 0
          ? `${effectiveName.trim()} is in your cellar, with ${rows.length} line${rows.length === 1 ? "" : "s"} already filled in.`
          : `${effectiveName.trim()} is in your cellar.`
      );
      router.push(`/products/${product.id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not create this product");
      setCreating(false);
    }
  };

  if (!currentOrganization) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <p className="text-sm text-muted-foreground">
          Please select an organisation to create a product.
        </p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <UpgradePromptModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType="products"
      />

      <div className="space-y-4">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          The products
        </Link>
        <Statement
          eyebrow="THE CELLAR · NEW PRODUCT"
          headline={derivedName ? `${derivedName}.` : "A new product."}
        />
        <p className="max-w-xl text-sm text-muted-foreground">
          One liquid, a fill volume, one pack format. Pick what you already make
          and the rest is already known.
        </p>
      </div>

      <CompositionSlot
        kind="liquid"
        options={options.liquid}
        selected={liquid}
        onSelect={setLiquidId}
        onClear={() => setLiquidId(null)}
        onCreate={(value) => createRecord("liquid", value)}
      />

      <section className="space-y-3 border-t border-studio-hairline pt-6">
        <Eyebrow>Filled to</Eyebrow>
        <div className="flex items-center gap-3">
          <Input
            value={fillValue}
            onChange={(e) => setFillValue(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="700"
            className="h-9 w-32 text-xs"
            aria-label="Fill volume"
          />
          <div className="flex items-center gap-4">
            {(["ml", "l"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setFillUnit(u)}
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-opacity ${
                  fillUnit === u ? "opacity-100" : "opacity-50 hover:opacity-100"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        {donorFacts?.unitSizeValue && (
          <p className="font-mono text-[10px] text-studio-dim">
            Taken from the products already bottling this liquid. Change it for a
            different size.
          </p>
        )}
      </section>

      <CompositionSlot
        kind="pack"
        options={options.pack}
        selected={pack}
        onSelect={setPackId}
        onClear={() => setPackId(null)}
        onCreate={(value) => createRecord("pack", value)}
      />

      {/* The number, as soon as there is one to show. */}
      <section className="space-y-3 border-t border-studio-hairline pt-6">
        <Eyebrow>The footprint, so far</Eyebrow>
        {estimate ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-4">
              <BigNumber value={formatPreviewKg(estimate.perUnitKgCo2e)} label="kg CO₂e / unit" />
              <StateChip tone="quiet">Estimated</StateChip>
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-studio-dim">
              Recipe {formatPreviewKg(estimate.ingredientKgCo2e)} · pack{" "}
              {formatPreviewKg(estimate.packagingKgCo2e)}. {describeEstimate(estimate)}{" "}
              The confirmed figure comes from the full calculation once this
              product is in the cellar.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {liquid || pack
              ? "Nothing priceable yet. Pick a liquid and a pack you have already specified, and the number appears here."
              : "Pick a liquid and a pack, and the number forms here as you go."}
          </p>
        )}
      </section>

      {/* Naming is a correction, not a question: it is already filled in. */}
      {liquid && (
        <section className="space-y-3 border-t border-studio-hairline pt-6">
          <Eyebrow>Called</Eyebrow>
          <Input
            value={effectiveName}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            className="h-9 max-w-md text-xs"
            aria-label="Product name"
          />
        </section>
      )}

      <div className="flex items-center justify-between border-t border-studio-hairline pt-6">
        <PillButton variant="ghost" href="/products">
          Cancel
        </PillButton>
        <PillButton variant="room" onClick={createProduct} disabled={!ready || creating}>
          {creating ? "Adding…" : "Add it to the cellar"}
        </PillButton>
      </div>
    </div>
  );
}

/**
 * One slot: what it holds, or the two ways to fill it. Pick existing first,
 * naming a new one second and never punished.
 */
function CompositionSlot({
  kind,
  options,
  selected,
  onSelect,
  onClear,
  onCreate,
}: {
  kind: Kind;
  options: Slot[];
  selected: Slot | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onCreate: (name: string) => void;
}) {
  const K = KINDS[kind];
  const [draft, setDraft] = useState("");

  if (selected) {
    const count = selected.productIds.length;
    return (
      <section className="space-y-2 border-t border-studio-hairline pt-6">
        <Eyebrow>{K.eyebrow}</Eyebrow>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[15px] font-semibold text-studio-ink">
              {selected.name}
            </span>
            {count > 0 && (
              <StateChip tone="good">
                Already on {count} {K.sharedNoun}
                {count === 1 ? "" : "s"}
              </StateChip>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim underline decoration-studio-hairline underline-offset-4 hover:text-studio-ink"
          >
            Change
          </button>
        </div>
        {count > 0 && (
          <p className="font-mono text-[10px] text-studio-dim">
            Its {kind === "liquid" ? "recipe" : "components"} come across, and
            stay in step from then on.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 border-t border-studio-hairline pt-6">
      <Eyebrow>{K.eyebrow}</Eyebrow>
      <div className="max-w-md">
        <RecordPicker
          id={`compose-${kind}`}
          placeholder={K.placeholder}
          emptyLabel={K.empty}
          options={options.map((o) => ({
            id: o.id,
            name: o.name,
            hint:
              o.productIds.length > 0
                ? `${o.productIds.length} ${K.sharedNoun}${o.productIds.length === 1 ? "" : "s"}`
                : undefined,
          }))}
          onSelect={onSelect}
          autoFocus={false}
        />
      </div>
      <div className="flex max-w-md items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onCreate(draft);
              setDraft("");
            }
          }}
          placeholder={K.newPlaceholder}
          className="h-9 text-xs"
          aria-label={K.newLabel}
        />
        <PillButton
          variant="outline"
          size="sm"
          disabled={!draft.trim()}
          onClick={() => {
            onCreate(draft);
            setDraft("");
          }}
        >
          Start it
        </PillButton>
      </div>
      <p className="font-mono text-[10px] text-studio-dim">{K.newLabel}.</p>
    </section>
  );
}
