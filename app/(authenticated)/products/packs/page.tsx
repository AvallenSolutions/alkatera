"use client";

/**
 * What you pack it in.
 *
 * The other half of the composition. A product is one liquid, at a fill
 * volume, in one pack format. L1 gave the liquid a home; this is the pack's.
 *
 * Until now the only way to reuse a bottle spec was to stamp a packaging
 * template, which produced copies that drifted the moment one glass weight was
 * corrected. A pack format is owned once and linked, so a correction reaches
 * every product in that bottle.
 *
 * As with liquids, the 1:1 backfill gave every product its own format.
 * Identical specifications are proposed for merging; the user decides.
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
import { COMPOSABLE_PRODUCT_KIND } from "@/lib/products/composable-kind";
import {
  findIdenticalPacks,
  suggestPackSurvivor,
  type PackFormatLike,
} from "@/lib/products/pack-identity";

interface PackRow extends PackFormatLike {
  products: { id: number; name: string }[];
}

/** A pack in a phrase: what the container is, from its own component row. */
function describePack(row: PackRow): string {
  const container = row.components.find((c) => c.packaging_category === "container");
  if (!container) {
    return row.components.length === 0
      ? "Nothing specified yet."
      : `${row.components.length} component${row.components.length === 1 ? "" : "s"}, no container.`;
  }
  const bits: string[] = [];
  if (container.packaging_material_class) bits.push(String(container.packaging_material_class));
  if (container.packaging_material_variant) bits.push(String(container.packaging_material_variant));
  const weight = Number(container.net_weight_g);
  const weightBit = Number.isFinite(weight) && weight > 0 ? `${weight} g` : null;
  const head = bits.length > 0 ? bits.join(" ") : "container";
  return [
    `${head}${weightBit ? `, ${weightBit}` : ""}`,
    `${row.components.length} component${row.components.length === 1 ? "" : "s"}.`,
  ].join(" · ");
}

export default function PackShelfPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<PackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data: packs, error } = await supabase
        .from("pack_formats")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;

      const { data: products } = await supabase
        .from("products")
        .select("id, name, pack_format_id")
        .eq("organization_id", orgId)
        .eq("product_kind", COMPOSABLE_PRODUCT_KIND)
        .not("pack_format_id", "is", null);

      const byPack = new Map<string, { id: number; name: string }[]>();
      for (const p of (products ?? []) as any[]) {
        const list = byPack.get(p.pack_format_id) ?? [];
        list.push({ id: p.id, name: p.name });
        byPack.set(p.pack_format_id, list);
      }

      // A pack's specification is the packaging rows of the products packed in
      // it. After a fan-out they agree, so the first product's rows are enough.
      const firstProductIds = Array.from(byPack.values())
        .map((list) => list[0]?.id)
        .filter(Boolean) as number[];

      const { data: materials } = firstProductIds.length
        ? await supabase
            .from("product_materials")
            .select(
              "product_id, material_name, packaging_category, packaging_material_class, packaging_material_variant, net_weight_g, recycled_content_percentage, units_per_group"
            )
            .in("product_id", firstProductIds)
            .eq("material_type", "packaging")
        : { data: [] as any[] };

      const componentsByProduct = new Map<number, any[]>();
      for (const m of (materials ?? []) as any[]) {
        const list = componentsByProduct.get(m.product_id) ?? [];
        list.push(m);
        componentsByProduct.set(m.product_id, list);
      }

      setRows(
        (packs ?? []).map((p: any) => {
          const linked = byPack.get(p.id) ?? [];
          return {
            ...p,
            products: linked,
            productCount: linked.length,
            components: componentsByProduct.get(linked[0]?.id) ?? [],
          };
        })
      );
    } catch (err) {
      console.error("[pack shelf] load failed:", err);
      toast.error("Could not load your pack formats");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const identical = useMemo(() => findIdenticalPacks(rows), [rows]);

  /** Renaming touches the label only. It is not a merge. */
  const rename = async (row: PackRow) => {
    const next = draftName.trim();
    setRenaming(null);
    if (!next || next === row.name) return;

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: next } : r)));
    // A pack's default name is derived from its container component, and is
    // re-derived when the components change. The moment a person names it —
    // producers have internal names for their packs — that stops: their name
    // outranks anything we could work out.
    const { error } = await supabase
      .from("pack_formats")
      .update({ name: next, name_is_custom: true })
      .eq("id", row.id);
    if (error) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: row.name } : r)));
      toast.error(error.message || "Could not rename that pack format");
    }
  };

  const merge = async (survivorId: string, mergedIds: string[], fingerprint: string) => {
    setMerging(fingerprint);
    try {
      const response = await fetch("/api/compositions/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivorId, mergedIds, kind: "pack" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? "Merge failed");

      toast.success(
        `Merged. ${result.productsMoved} product${result.productsMoved === 1 ? "" : "s"} now share this pack.`
      );
      if (result.warning) toast.warning(result.warning);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not merge those pack formats");
    } finally {
      setMerging(null);
    }
  };

  if (loading) return <PageLoader />;

  const shared = rows.filter((r) => r.productCount > 1).length;
  const totalProducts = rows.reduce((n, r) => n + r.productCount, 0);

  return (
    <div className="space-y-10">
      <Statement
        eyebrow={`THE CELLAR · ${rows.length} PACK FORMAT${rows.length === 1 ? "" : "S"}`}
        headline={
          rows.length === 0
            ? "Nothing packed yet."
            : `${rows.length} pack format${rows.length === 1 ? "" : "s"}, ${totalProducts} product${
                totalProducts === 1 ? "" : "s"
              }.`
        }
      >
        {rows.length > 0 && (
          <>
            <BigNumber value={String(shared)} label="used more than once" />
            <BigNumber value={String(identical.length)} label="identical specs" />
          </>
        )}
      </Statement>

      {rows.length === 0 ? (
        <Panel>
          <p className="text-[13.5px] leading-relaxed text-studio-dim">
            A pack format is the bottle or can with its closure, label and outer packaging. Each
            product is packed in one, so correcting a glass weight here reaches every product in
            that bottle. Pack formats appear as you save packaging.
          </p>
        </Panel>
      ) : (
        <>
          {identical.length > 0 && (
            <section className="space-y-4">
              <Eyebrow>The same pack, twice</Eyebrow>
              <Panel>
                <p className="mb-5 text-[13.5px] leading-relaxed text-studio-ink">
                  These pack formats hold exactly the same specification. Merging points their
                  products at one format, so a correction only has to be made once. No footprint
                  changes: the specifications are already identical.
                </p>
                <ul className="space-y-5">
                  {identical.map((group) => {
                    const keep = suggestPackSurvivor(group);
                    const others = group.members.filter((m) => m.id !== keep.id);
                    const busy = merging === group.fingerprint;
                    return (
                      <li key={group.fingerprint} className="border-t border-studio-hairline pt-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <span className="font-display text-[15px] font-semibold text-studio-ink">
                            {group.members.map((m) => m.name).join(" · ")}
                          </span>
                          <StateChip tone="attention">{group.productCount} products</StateChip>
                        </div>
                        <p className="mt-1 font-mono text-[10px] leading-relaxed text-studio-dim">
                          Keeping {keep.name}, which {keep.productCount} product
                          {keep.productCount === 1 ? " uses" : "s use"} already.
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
            <Eyebrow>What you pack in</Eyebrow>
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
                            title="Rename this pack format"
                            className="font-display text-[14.5px] font-semibold text-studio-ink underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-studio-hairline"
                          >
                            {row.name}
                          </button>
                        )}
                        {row.productCount > 1 && (
                          <StateChip tone="good">{row.productCount} products</StateChip>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-studio-dim">
                        {describePack(row)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right font-mono text-[10px] text-studio-dim">
                      {row.products.length === 0 ? (
                        "Not used yet"
                      ) : (
                        <>
                          {row.products.slice(0, 3).map((p, idx) => (
                            <span key={p.id}>
                              {idx > 0 && ", "}
                              <Link
                                href={`/products/${p.id}/recipe?tab=packaging`}
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
