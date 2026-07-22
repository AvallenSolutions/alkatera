"use client";

/**
 * What you make, as opposed to what you sell.
 *
 * A product is a composition: one liquid, at a fill volume, in one pack
 * format. This is the liquid half. Until L1 the recipe lived as rows on one
 * product and the only way to reuse it was to stamp a template, producing
 * copies that drifted. Now a liquid is owned once and linked, so correcting an
 * ingredient reaches every format that bottles it.
 *
 * The 1:1 migration gave every product its own liquid, which is the safe
 * starting state but not the true one. Identical recipes are proposed for
 * merging here; the user decides, and nothing is merged automatically.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { Panel } from "@/components/studio/panel";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { PageLoader } from "@/components/ui/page-loader";
import {
  findIdenticalLiquids,
  suggestLiquidSurvivor,
  type LiquidLike,
} from "@/lib/products/liquid-identity";

interface LiquidRow extends LiquidLike {
  products: { id: number; name: string }[];
}

export default function LiquidShelfPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<LiquidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data: liquids, error } = await supabase
        .from("liquids")
        .select("id, name, recipe_scale_mode, batch_yield_value, batch_yield_unit")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;

      const { data: products } = await supabase
        .from("products")
        .select("id, name, liquid_id")
        .eq("organization_id", orgId)
        .not("liquid_id", "is", null);

      const byLiquid = new Map<string, { id: number; name: string }[]>();
      for (const p of (products ?? []) as any[]) {
        const list = byLiquid.get(p.liquid_id) ?? [];
        list.push({ id: p.id, name: p.name });
        byLiquid.set(p.liquid_id, list);
      }

      // A liquid's recipe is the ingredient rows of the products that bottle
      // it. After a fan-out they agree, so reading the first product's rows is
      // enough to compare two liquids.
      const firstProductIds = Array.from(byLiquid.values())
        .map((list) => list[0]?.id)
        .filter(Boolean) as number[];

      const { data: materials } = firstProductIds.length
        ? await supabase
            .from("product_materials")
            .select("product_id, material_name, quantity, unit")
            .in("product_id", firstProductIds)
            .eq("material_type", "ingredient")
        : { data: [] as any[] };

      const linesByProduct = new Map<number, any[]>();
      for (const m of (materials ?? []) as any[]) {
        const list = linesByProduct.get(m.product_id) ?? [];
        list.push(m);
        linesByProduct.set(m.product_id, list);
      }

      setRows(
        (liquids ?? []).map((l: any) => {
          const linked = byLiquid.get(l.id) ?? [];
          return {
            ...l,
            products: linked,
            productCount: linked.length,
            lines: linesByProduct.get(linked[0]?.id) ?? [],
          };
        })
      );
    } catch (err) {
      console.error("[liquid shelf] load failed:", err);
      toast.error("Could not load your liquids");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const identical = useMemo(() => findIdenticalLiquids(rows), [rows]);

  /**
   * Rename a liquid.
   *
   * The 1:1 backfill named every liquid after whichever product it was lifted
   * from, which stops being right the moment two formats share one: "House Gin
   * 700ml" is a poor name for the liquid inside the 50ml as well.
   *
   * Renaming touches nothing but the label. It is not a merge, so no product
   * moves and no recipe changes.
   */
  const rename = async (row: LiquidRow) => {
    const next = draftName.trim();
    setRenaming(null);
    if (!next || next === row.name) return;

    // Optimistic: the shelf is a list of labels and a failed write is loud.
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: next } : r)));
    const { error } = await supabase.from("liquids").update({ name: next }).eq("id", row.id);
    if (error) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: row.name } : r)));
      toast.error(error.message || "Could not rename that liquid");
    }
  };

  const merge = async (survivorId: string, mergedIds: string[], fingerprint: string) => {
    setMerging(fingerprint);
    try {
      const response = await fetch("/api/liquids/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivorId, mergedIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? "Merge failed");

      toast.success(
        `Merged. ${result.productsMoved} product${result.productsMoved === 1 ? "" : "s"} now share this liquid.`
      );
      if (result.warning) toast.warning(result.warning);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not merge those liquids");
    } finally {
      setMerging(null);
    }
  };

  if (loading) return <PageLoader />;

  const shared = rows.filter((r) => r.productCount > 1).length;

  return (
    <div className="space-y-10">
      <Statement
        eyebrow={`THE CELLAR · ${rows.length} LIQUID${rows.length === 1 ? "" : "S"}`}
        headline={
          rows.length === 0
            ? "Nothing made yet."
            : `${rows.length} liquid${rows.length === 1 ? "" : "s"}, ${rows.reduce((n, r) => n + r.productCount, 0)} format${
                rows.reduce((n, r) => n + r.productCount, 0) === 1 ? "" : "s"
              }.`
        }
      >
        {rows.length > 0 && (
          <>
            <BigNumber value={String(shared)} label="bottled more than once" />
            <BigNumber value={String(identical.length)} label="identical recipes" />
          </>
        )}
      </Statement>

      {rows.length === 0 ? (
        <Panel>
          <p className="text-[13.5px] leading-relaxed text-studio-dim">
            A liquid is the recipe you actually make. Each product bottles one, so correcting an
            ingredient here reaches every format. Liquids appear as you save recipes.
          </p>
        </Panel>
      ) : (
        <>
          {identical.length > 0 && (
            <section className="space-y-4">
              <Eyebrow>The same drink, twice</Eyebrow>
              <Panel>
                <p className="mb-5 text-[13.5px] leading-relaxed text-studio-ink">
                  These liquids hold exactly the same recipe. Merging points their products at one
                  liquid, so a correction only has to be made once. No footprint changes: the
                  recipes are already identical.
                </p>
                <ul className="space-y-5">
                  {identical.map((group) => {
                    const keep = suggestLiquidSurvivor(group);
                    const others = group.members.filter((m) => m.id !== keep.id);
                    const busy = merging === group.fingerprint;
                    return (
                      <li key={group.fingerprint} className="border-t border-studio-hairline pt-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <span className="font-display text-[15px] font-semibold text-studio-ink">
                            {group.members.map((m) => m.name).join(" · ")}
                          </span>
                          <StateChip tone="attention">
                            {group.productCount} products
                          </StateChip>
                        </div>
                        <p className="mt-1 font-mono text-[10px] leading-relaxed text-studio-dim">
                          Keeping {keep.name}, which {keep.productCount} product
                          {keep.productCount === 1 ? "" : "s"} already bottle
                          {keep.productCount === 1 ? "s" : ""}.
                        </p>
                        <div className="mt-3">
                          <PillButton
                            onClick={() =>
                              merge(keep.id, others.map((o) => o.id), group.fingerprint)
                            }
                            disabled={busy}
                          >
                            {busy ? "Merging…" : `Merge into ${keep.name}`}
                          </PillButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </section>
          )}

          <section className="space-y-4">
            <Eyebrow>What you make</Eyebrow>
            <Panel flush>
              <ul>
                {rows.map((row, i) => (
                  <li
                    key={row.id}
                    className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 ${
                      i > 0 ? "border-t border-studio-hairline" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-3">
                        {renaming === row.id ? (
                          <input
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onBlur={() => rename(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") rename(row);
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="w-[260px] border-b border-studio-ink bg-transparent font-display text-[14.5px] font-semibold text-studio-ink outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRenaming(row.id);
                              setDraftName(row.name);
                            }}
                            title="Rename this liquid"
                            className="font-display text-[14.5px] font-semibold text-studio-ink underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-studio-hairline"
                          >
                            {row.name}
                          </button>
                        )}
                        {row.recipe_scale_mode === "per_batch" && row.batch_yield_value && (
                          <span className="font-mono text-[10px] text-studio-dim">
                            {Number(row.batch_yield_value).toLocaleString()}{" "}
                            {row.batch_yield_unit ?? ""} batch
                          </span>
                        )}
                        {row.productCount > 1 && (
                          <StateChip tone="good">{row.productCount} formats</StateChip>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-studio-dim">
                        {row.lines.length === 0
                          ? "No recipe yet."
                          : `${row.lines.length} ingredient${row.lines.length === 1 ? "" : "s"}.`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right font-mono text-[10px] text-studio-dim">
                      {row.products.length === 0 ? (
                        "Not bottled yet"
                      ) : (
                        <>
                          {row.products.slice(0, 3).map((p, idx) => (
                            <span key={p.id}>
                              {idx > 0 && ", "}
                              <Link
                                href={`/products/${p.id}/recipe?tab=ingredients`}
                                className="text-studio-ink underline decoration-studio-hairline underline-offset-2 hover:decoration-studio-ink"
                              >
                                {p.name}
                              </Link>
                            </span>
                          ))}
                          {row.products.length > 3 && ` +${row.products.length - 3}`}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
