"use client";

/**
 * The ingredient shelf: every ingredient the organisation buys, entered once.
 *
 * Until Phase 2 the `ingredients` table sat empty while the same malt's
 * emission factor and origin were retyped on every SKU. Now the recipe editor
 * fills it, this is where those records become visible: what you buy, how many
 * products use each one, and which ones look like the same thing entered
 * twice.
 *
 * Duplicates are proposed, never merged automatically. That is the decision
 * taken for duplicate liquids in tasks/liquid-and-pack-plan.md and it applies
 * with the same force here: the platform detects, the user decides.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { Panel } from "@/components/studio/panel";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PageLoader } from "@/components/ui/page-loader";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  findDuplicateIngredients,
  suggestSurvivor,
  type IngredientLike,
} from "@/lib/products/ingredient-duplicates";

interface IngredientRow extends IngredientLike {
  is_organic_certified: boolean | null;
  is_self_grown: boolean | null;
  match_status: string | null;
  usage: { productId: number; productName: string }[];
}

export default function IngredientShelfPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!orgId) return;
    let live = true;

    (async () => {
      setLoading(true);
      try {
        const { data: ingredients, error } = await supabase
          .from("ingredients")
          .select(
            "id, name, unit, matched_source_name, match_status, is_organic_certified, is_self_grown"
          )
          .eq("organization_id", orgId)
          .order("name");
        if (error) throw error;

        // Which products use each ingredient. The join is on
        // product_materials.material_id, which the recipe editor only started
        // populating in Phase 2, so rows saved before then show no usage until
        // their product is saved again.
        const { data: usage } = await supabase
          .from("product_materials")
          .select("material_id, products!inner(id, name, organization_id)")
          .eq("products.organization_id", orgId)
          .not("material_id", "is", null);

        const byIngredient = new Map<string, { productId: number; productName: string }[]>();
        for (const row of (usage ?? []) as any[]) {
          const list = byIngredient.get(row.material_id) ?? [];
          if (!list.some((u) => u.productId === row.products.id)) {
            list.push({ productId: row.products.id, productName: row.products.name });
          }
          byIngredient.set(row.material_id, list);
        }

        if (live) {
          setRows(
            (ingredients ?? []).map((i: any) => ({
              ...i,
              usage: byIngredient.get(i.id) ?? [],
            }))
          );
        }
      } catch (err) {
        console.error("[ingredient shelf] load failed:", err);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [orgId]);

  const duplicates = useMemo(() => findDuplicateIngredients(rows), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.matched_source_name ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const sharedCount = rows.filter((r) => r.usage.length > 1).length;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-10">
      <Statement
        eyebrow={`THE CELLAR · ${rows.length} INGREDIENT${rows.length === 1 ? "" : "S"}`}
        headline={
          rows.length === 0
            ? "Nothing on the shelf yet."
            : `${rows.length} ingredient${rows.length === 1 ? "" : "s"}, entered once.`
        }
      >
        {rows.length > 0 && (
          <>
            <BigNumber value={String(sharedCount)} label="shared across products" />
            <BigNumber value={String(duplicates.length)} label="possible duplicates" />
          </>
        )}
      </Statement>

      {rows.length === 0 ? (
        <Panel>
          <p className="text-[13.5px] leading-relaxed text-studio-dim">
            Ingredients appear here as you save recipes. Each one is stored once, so correcting
            its emission factor or its origin reaches every product that uses it.
          </p>
        </Panel>
      ) : (
        <>
          {duplicates.length > 0 && (
            <section className="space-y-4">
              <Eyebrow>Worth a look</Eyebrow>
              <Panel>
                <p className="mb-5 text-[13.5px] leading-relaxed text-studio-ink">
                  These look like the same ingredient entered more than once. Nothing has been
                  changed: merging is your call, and until you make it both records keep working.
                </p>
                <ul className="space-y-4">
                  {duplicates.map((group) => {
                    const keep = suggestSurvivor(group);
                    return (
                      <li key={group.key} className="border-t border-studio-hairline pt-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <span className="font-display text-[15px] font-semibold text-studio-ink">
                            {group.members.map((m) => m.name).join(" · ")}
                          </span>
                          <StateChip tone="attention">{group.members.length} records</StateChip>
                        </div>
                        <p className="mt-1 font-mono text-[10px] leading-relaxed text-studio-dim">
                          {group.reason} Keeping{" "}
                          <span className="text-studio-ink">{keep.name}</span>
                          {keep.matched_source_name
                            ? " would lose the least, since it already has a matched factor."
                            : " would lose the least."}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Eyebrow>The shelf</Eyebrow>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-studio-dim" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find an ingredient"
                  className="h-9 pl-9 text-[13px]"
                />
              </div>
            </div>

            <Panel flush>
              <ul>
                {visible.map((row, i) => (
                  <li
                    key={row.id}
                    className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4 ${
                      i > 0 ? "border-t border-studio-hairline" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-[14.5px] font-semibold text-studio-ink">
                          {row.name}
                        </span>
                        {row.unit && (
                          <span className="font-mono text-[10px] text-studio-dim">{row.unit}</span>
                        )}
                        {row.is_self_grown && <StateChip tone="good">Self grown</StateChip>}
                        {row.is_organic_certified && <StateChip tone="good">Organic</StateChip>}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-studio-dim">
                        {row.matched_source_name
                          ? `Matched to ${row.matched_source_name}.`
                          : "No emission factor matched yet."}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {row.usage.length === 0 ? (
                        <span className="font-mono text-[10px] text-studio-dim">
                          Not used yet
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-studio-dim">
                          {row.usage.length} product{row.usage.length === 1 ? "" : "s"} ·{" "}
                          {row.usage.slice(0, 2).map((u, idx) => (
                            <span key={u.productId}>
                              {idx > 0 && ", "}
                              <Link
                                href={`/products/${u.productId}/recipe?tab=ingredients`}
                                className="text-studio-ink underline decoration-studio-hairline underline-offset-2 hover:decoration-studio-ink"
                              >
                                {u.productName}
                              </Link>
                            </span>
                          ))}
                          {row.usage.length > 2 && ` +${row.usage.length - 2}`}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {visible.length === 0 && (
                  <li className="px-5 py-6 text-[13.5px] text-studio-dim">
                    Nothing matches {`"${query}"`}.
                  </li>
                )}
              </ul>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
