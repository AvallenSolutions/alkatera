'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { getCompositionFacts, type CompositionFacts } from '@/lib/products/composition-facts';
import type {
  ProductIngredient,
  ProductPackaging,
  ProductMaturation,
} from '@/hooks/data/useProductData';
import { BARREL_TYPE_LABELS, CLIMATE_ZONE_LABELS } from '@/lib/types/maturation';

interface CompositionSectionProps {
  productId: string;
  liquidId: string | null;
  packFormatId: string | null;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  maturation: ProductMaturation | null;
}

/** The provenance of a matched material, read as a working tone. */
function MaterialSourceChip({ material }: { material: ProductIngredient | ProductPackaging }) {
  const isProxy =
    material.matched_source_name && material.matched_source_name !== material.material_name;
  if (isProxy) return <StateChip tone="attention">Proxy</StateChip>;
  if (material.data_source === 'supplier') return <StateChip tone="good">Primary</StateChip>;
  if (material.data_source === 'openlca') return <StateChip tone="quiet">Secondary</StateChip>;
  return null;
}

/** "shared with 2 other formats", or the quiet truth that it is not shared. */
function sharingNote(
  fact: { rowCount: number; sharedWith: unknown[] } | null,
  rowNoun: string,
  sharedNoun: string,
): string {
  if (!fact) return '';
  const rows = `${fact.rowCount} ${rowNoun}${fact.rowCount === 1 ? '' : 's'}`;
  const shared = fact.sharedWith.length;
  if (shared === 0) return `${rows} · only this product uses it`;
  return `${rows} · shared with ${shared} other ${sharedNoun}${shared === 1 ? '' : 's'}`;
}

/**
 * What the product is made of: one liquid, in one pack.
 *
 * The composition model has been live since the liquid and pack shelves were
 * built, but the busiest page in the room never mentioned it. A founder could
 * not tell from a product's own page that its recipe was shared with two other
 * formats, which is the entire point of the model. The specification content
 * (top ingredients, packaging, maturation) sits underneath, one column, where
 * it used to be a separate tab of two-column cards.
 */
export function CompositionSection({
  productId,
  liquidId,
  packFormatId,
  ingredients,
  packaging,
  maturation,
}: CompositionSectionProps) {
  const [facts, setFacts] = useState<CompositionFacts | null>(null);

  useEffect(() => {
    let live = true;
    getCompositionFacts(getSupabaseBrowserClient() as any, productId, liquidId, packFormatId)
      .then((f) => {
        if (live) setFacts(f);
      })
      .catch(() => {
        // Non-fatal: the section still shows the specification below.
      });
    return () => {
      live = false;
    };
  }, [productId, liquidId, packFormatId]);

  const topIngredients = [...ingredients].sort((a, b) => b.quantity - a.quantity).slice(0, 3);
  const primaryContainer =
    packaging.find((p) => p.packaging_category === 'primary_container') ?? packaging[0];

  return (
    <section className="border-t border-studio-hairline pt-8">
      <Eyebrow className="mb-6">WHAT IT IS MADE OF</Eyebrow>

      <dl className="divide-y divide-studio-hairline border-y border-studio-hairline">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
          <dt className="w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Made from
          </dt>
          <dd className="min-w-0 flex-1">
            {facts?.liquid ? (
              <>
                <Link
                  href="/products/liquids"
                  className="font-display text-[15px] font-semibold text-foreground transition-colors duration-150 ease-studio hover:text-room-accent"
                >
                  {facts.liquid.name}
                </Link>
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {sharingNote(facts.liquid, 'ingredient', 'format')}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No liquid yet. Save a recipe and this product gets one of its own.
              </span>
            )}
          </dd>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
          <dt className="w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Packed in
          </dt>
          <dd className="min-w-0 flex-1">
            {facts?.pack ? (
              <>
                <Link
                  href="/products/packs"
                  className="font-display text-[15px] font-semibold text-foreground transition-colors duration-150 ease-studio hover:text-room-accent"
                >
                  {facts.pack.name}
                </Link>
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {sharingNote(facts.pack, 'component', 'product')}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No pack format yet. Save packaging and this product gets one of its own.
              </span>
            )}
          </dd>
        </div>
      </dl>

      {(topIngredients.length > 0 || primaryContainer) && (
        <dl className="mt-6 space-y-4">
          {topIngredients.length > 0 && (
            <div>
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Most of it, by weight
              </dt>
              <dd className="mt-2 space-y-1.5">
                {topIngredients.map((ingredient) => (
                  <div key={ingredient.id} className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {ingredient.material_name}
                    </span>
                    <MaterialSourceChip material={ingredient} />
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                  </div>
                ))}
                {ingredients.length > 3 && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    and {ingredients.length - 3} more
                  </p>
                )}
              </dd>
            </div>
          )}

          {primaryContainer && (
            <div>
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                The container
              </dt>
              <dd className="mt-2 flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {primaryContainer.material_name}
                </span>
                <MaterialSourceChip material={primaryContainer} />
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {primaryContainer.quantity} {primaryContainer.unit}
                </span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {maturation?.barrel_type && (
        <div className="mt-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Maturation
          </p>
          <p className="mt-2 text-sm text-foreground">
            {[
              BARREL_TYPE_LABELS[maturation.barrel_type as keyof typeof BARREL_TYPE_LABELS] ??
                maturation.barrel_type,
              maturation.maturation_years
                ? `${maturation.maturation_years} year${maturation.maturation_years === 1 ? '' : 's'}`
                : null,
              maturation.climate_zone
                ? CLIMATE_ZONE_LABELS[maturation.climate_zone as keyof typeof CLIMATE_ZONE_LABELS] ??
                  maturation.climate_zone
                : null,
              maturation.angels_share_percent
                ? `${maturation.angels_share_percent}% to the angels`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <PillButton variant="outline" href={`/products/${productId}/recipe`}>
          Edit the recipe
        </PillButton>
        {facts?.liquid && (
          <Link
            href={`/products/new/compose?liquid=${facts.liquid.id}`}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 ease-studio hover:text-foreground"
          >
            Same liquid, different pack →
          </Link>
        )}
      </div>
    </section>
  );
}
