"use client";

import { useState, useEffect } from "react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { supabase } from "@/lib/supabaseClient";
import type { ProductIngredient, ProductPackaging } from "@/hooks/data/useProductData";
import type { MaturationProfile } from "@/lib/types/maturation";
import {
  BARREL_TYPE_LABELS,
  CLIMATE_ZONE_LABELS,
  resolveMaturationAbv,
} from "@/lib/types/maturation";
import { calculateMaturationImpacts } from "@/lib/maturation-calculator";

interface SpecificationTabProps {
  productId: string;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  productCategory?: string | null;
  productAbvPercent?: number | null;
  onManageIngredients?: () => void;
  onManagePackaging?: () => void;
}

/** The provenance of a matched material, read as a working tone. */
function MaterialSourceChip({ ingredient }: { ingredient: ProductIngredient | ProductPackaging }) {
  const isProxy =
    ingredient.matched_source_name && ingredient.matched_source_name !== ingredient.material_name;
  return (
    <>
      {isProxy && <StateChip tone="attention">Proxy</StateChip>}
      {ingredient.data_source === "supplier" && <StateChip tone="good">Primary</StateChip>}
      {ingredient.data_source === "openlca" && <StateChip tone="quiet">Secondary</StateChip>}
    </>
  );
}

export function SpecificationTab({
  productId,
  ingredients,
  packaging,
  productCategory,
  productAbvPercent,
  onManageIngredients,
  onManagePackaging,
}: SpecificationTabProps) {
  const [maturationProfile, setMaturationProfile] = useState<MaturationProfile | null>(null);

  useEffect(() => {
    async function fetchMaturation() {
      const { data } = await supabase
        .from("maturation_profiles")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      setMaturationProfile(data as MaturationProfile | null);
    }
    fetchMaturation();
  }, [productId]);

  const maturationImpacts = maturationProfile
    ? (() => {
        const abv = resolveMaturationAbv({
          profileCaskFillAbvPercent: maturationProfile.cask_fill_abv_percent as number | null,
          productCategory,
          productAbvPercent,
        });
        return calculateMaturationImpacts(maturationProfile, {
          warehouseCountryCode: maturationProfile.warehouse_country_code ?? null,
          caskFillAbvPercent: abv.caskFillAbvPercent,
          bottleAbvPercent: abv.bottleAbvPercent,
        });
      })()
    : null;

  // Calculate total ingredient weight
  const totalIngredientWeight = ingredients.reduce((sum, ing) => {
    const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
    return sum + weight;
  }, 0);

  // Get top 3 ingredients by weight
  const topIngredients = [...ingredients]
    .sort((a, b) => {
      const aWeight = a.unit === 'kg' ? a.quantity : a.quantity / 1000;
      const bWeight = b.unit === 'kg' ? b.quantity : b.quantity / 1000;
      return bWeight - aWeight;
    })
    .slice(0, 3);

  // Calculate total packaging weight (convert to grams if needed)
  const totalPackagingWeight = packaging.reduce((sum, pkg) => {
    const weightInGrams = pkg.unit === 'kg' ? pkg.quantity * 1000 : pkg.quantity;
    return sum + weightInGrams;
  }, 0);

  // Get primary container
  const primaryContainer = packaging.find(p => p.packaging_category === 'container');

  const ingredientsWeightValue =
    totalIngredientWeight < 0.01
      ? (totalIngredientWeight * 1000).toFixed(1)
      : totalIngredientWeight.toFixed(2);
  const ingredientsWeightUnit = totalIngredientWeight < 0.01 ? "G NET" : "KG NET";

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
      {/* Ingredients summary */}
      <section className="border-t border-border pt-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Eyebrow>Ingredients</Eyebrow>
          {ingredients.length > 0 && (
            <BigNumber value={ingredientsWeightValue} label={ingredientsWeightUnit} />
          )}
        </div>

        {ingredients.length === 0 ? (
          <p className="mb-4 text-sm text-studio-dim">
            No ingredients yet. Add them to complete the recipe.
          </p>
        ) : (
          <div className="mb-4 divide-y divide-border">
            {topIngredients.map((ing, idx) => {
              const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
              const percentage = (weight / totalIngredientWeight) * 100;
              return (
                <div key={ing.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-mono text-[10px] text-studio-dim">{idx + 1}</span>
                    <span className="truncate text-sm text-foreground">{ing.material_name}</span>
                    <MaterialSourceChip ingredient={ing} />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {weight < 0.01 ? `${(weight * 1000).toFixed(1)} g` : `${weight.toFixed(2)} kg`}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
            {ingredients.length > 3 && (
              <p className="pt-2 text-xs text-studio-dim">
                + {ingredients.length - 3} more ingredient{ingredients.length - 3 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {onManageIngredients ? (
          <PillButton variant="outline" size="sm" onClick={onManageIngredients}>
            {ingredients.length === 0 ? 'Add ingredients' : 'Manage ingredients'}
          </PillButton>
        ) : (
          <PillButton variant="outline" size="sm" href={`/products/${productId}/recipe?tab=ingredients`}>
            {ingredients.length === 0 ? 'Add ingredients' : 'Manage ingredients'}
          </PillButton>
        )}
      </section>

      {/* Packaging summary */}
      <section className="border-t border-border pt-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Eyebrow>Packaging</Eyebrow>
          {packaging.length > 0 && (
            <BigNumber value={totalPackagingWeight.toFixed(1)} label="G TOTAL" />
          )}
        </div>

        {packaging.length === 0 ? (
          <p className="mb-4 text-sm text-studio-dim">
            No packaging yet. Add materials to complete the product.
          </p>
        ) : (
          <div className="mb-4 space-y-4">
            {primaryContainer && (
              <div>
                <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                  Primary container
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-foreground">{primaryContainer.material_name}</span>
                    <MaterialSourceChip ingredient={primaryContainer} />
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {primaryContainer.unit === 'kg' && primaryContainer.quantity < 1
                      ? `${(primaryContainer.quantity * 1000).toFixed(0)} g`
                      : `${primaryContainer.quantity.toFixed(2)} ${primaryContainer.unit}`}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 border-t border-border pt-3">
              {['container', 'label', 'closure', 'secondary'].map(cat => {
                const count = packaging.filter(p => p.packaging_category === cat).length;
                return (
                  <div key={cat}>
                    <div className="font-display text-lg font-bold tabular-nums text-foreground">{count}</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-dim">{cat}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {onManagePackaging ? (
          <PillButton variant="outline" size="sm" onClick={onManagePackaging}>
            {packaging.length === 0 ? 'Add packaging' : 'Manage packaging'}
          </PillButton>
        ) : (
          <PillButton variant="outline" size="sm" href={`/products/${productId}/recipe?tab=packaging`}>
            {packaging.length === 0 ? 'Add packaging' : 'Manage packaging'}
          </PillButton>
        )}
      </section>

      {/* Maturation summary (only shown if profile exists) */}
      {maturationProfile && maturationImpacts && (
        <section className="border-t border-border pt-5 md:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <Eyebrow>Maturation</Eyebrow>
            <StateChip tone="quiet">
              {(maturationProfile.aging_duration_months / 12).toFixed(1)} years
            </StateChip>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-dim">Barrel type</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {BARREL_TYPE_LABELS[maturationProfile.barrel_type] || maturationProfile.barrel_type}
              </div>
              <div className="text-xs text-muted-foreground">
                {maturationProfile.barrel_use_number === 1 ? 'New barrel' : `${maturationProfile.barrel_use_number}${maturationProfile.barrel_use_number === 2 ? 'nd' : 'rd+'} fill`}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-dim">Climate zone</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {CLIMATE_ZONE_LABELS[maturationProfile.climate_zone] || maturationProfile.climate_zone}
              </div>
              <div className="text-xs text-muted-foreground">
                Angel&apos;s share: {maturationProfile.angel_share_percent_per_year}%/yr
              </div>
            </div>
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-dim">Volume loss</div>
              <div className="mt-1 text-sm font-medium tabular-nums text-studio-attention">
                {maturationImpacts.angel_share_loss_percent_total.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {maturationImpacts.angel_share_volume_loss_litres.toFixed(1)} L lost
              </div>
            </div>
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-dim">Maturation CO2e</div>
              <div className="mt-1 text-sm font-medium tabular-nums text-foreground">
                {maturationImpacts.total_maturation_co2e.toFixed(2)} kg
              </div>
              <div className="text-xs text-muted-foreground">
                {maturationImpacts.total_maturation_co2e_per_litre_output.toFixed(3)} kg/L output
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
