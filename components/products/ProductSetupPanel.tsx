'use client';

import Link from 'next/link';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { useRosaContext } from '@/lib/rosa/RosaContextProvider';
import { trackOnboarding } from '@/lib/onboarding/telemetry';
import { Eyebrow } from '@/components/studio/eyebrow';

interface ProductSetupPanelProps {
  organizationId: string | null | undefined;
  productId: string;
  productName: string;
  hasIngredients: boolean;
  hasPackaging: boolean;
  hasFacility: boolean;
  hasFootprint: boolean;
  passportEnabled: boolean;
  /** A multipack is made of products, not a recipe, so it is asked for less. */
  isMultipack: boolean;
}

interface SetupItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * What is left to do on this product, and a sentence about where you are.
 *
 * This is the room-setup-panel pattern brought down to a single product, and
 * it is most of what the old spotlight tour was actually for. A tour tells you
 * what the page contains once and then is gone; a checklist reads the product's
 * real data, so it stays true, moves as the work is done, and disappears when
 * there is nothing left to say.
 *
 * The per-product items cannot come from the growth score, which is org-level
 * ("add your first product"), so they are derived from what the hub has
 * already loaded.
 */
export function ProductSetupPanel({
  organizationId,
  productId,
  productName,
  hasIngredients,
  hasPackaging,
  hasFacility,
  hasFootprint,
  passportEnabled,
  isMultipack,
}: ProductSetupPanelProps) {
  const { state, isLoading, markProductGuideCompleted, dismissCoachmark } = useOnboarding();
  const { askRosa } = useRosaContext();

  const items: SetupItem[] = isMultipack
    ? [
        {
          id: 'contents',
          label: 'Say what is in the pack.',
          href: `/products/${productId}`,
          done: hasIngredients || hasPackaging,
        },
        {
          id: 'footprint',
          label: 'Open the footprint and confirm it.',
          href: `/products/${productId}/dossier`,
          done: hasFootprint,
        },
        {
          id: 'passport',
          label: 'Publish the passport.',
          href: `/products/${productId}`,
          done: passportEnabled,
        },
      ]
    : [
        {
          id: 'liquid',
          label: 'Add what goes in it.',
          href: `/products/${productId}/recipe?tab=ingredients`,
          done: hasIngredients,
        },
        {
          id: 'packaging',
          label: 'Add the packaging.',
          href: `/products/${productId}/recipe?tab=packaging`,
          done: hasPackaging,
        },
        {
          id: 'facility',
          label: 'Say where it is made.',
          href: `/products/${productId}?tab=facilities`,
          done: hasFacility,
        },
        {
          id: 'footprint',
          label: 'Open the footprint and confirm it.',
          href: `/products/${productId}/dossier`,
          done: hasFootprint,
        },
        {
          id: 'passport',
          label: 'Publish the passport.',
          href: `/products/${productId}`,
          done: passportEnabled,
        },
      ];

  const doneCount = items.filter((item) => item.done).length;
  const complete = doneCount === items.length;
  const hidden = state.coachmarks?.['product-setup'] ?? false;

  // `productGuideCompleted` is the old tour's flag, repurposed as "has seen the
  // intro". Anyone who walked or skipped the spotlight tour is therefore never
  // greeted again, which is the migration: no new key, no backfill.
  const introSeen = state.productGuideCompleted ?? false;

  if (isLoading || hidden || complete) return null;

  return (
    <section className="rounded-[6px] border border-studio-hairline bg-studio-cream p-5">
      <Eyebrow className="mb-3">Where you are</Eyebrow>

      {!introSeen && (
        <p className="mb-4 max-w-xl text-sm text-foreground">
          This is the product&apos;s one home. What it is made of, where it is made and the
          footprint that follows.
        </p>
      )}

      <ul className="divide-y divide-studio-hairline border-y border-studio-hairline">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span
              aria-hidden="true"
              className={
                item.done
                  ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-studio-good'
                  : 'h-1.5 w-1.5 shrink-0 rounded-full border border-studio-dim'
              }
            />
            {item.done ? (
              <span className="text-sm text-muted-foreground line-through">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                onClick={() => {
                  trackOnboarding({
                    organizationId,
                    flow: 'product_checklist',
                    step: 'product',
                    event: 'complete',
                    meta: { kind: 'product_checklist_item_clicked', itemId: item.id },
                  });
                  if (!introSeen) markProductGuideCompleted();
                }}
                className="text-sm text-foreground transition-colors duration-150 ease-studio hover:text-room-accent"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {doneCount} of {items.length} done.
        </span>
        <span className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => askRosa(`What should I do next for ${productName}?`)}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent hover:opacity-70"
          >
            Ask Rosa about this product.
          </button>
          <button
            type="button"
            onClick={() => {
              trackOnboarding({
                organizationId,
                flow: 'product_checklist',
                step: 'product',
                event: 'dismiss',
                meta: { kind: 'product_checklist_dismissed' },
              });
              dismissCoachmark('product-setup');
            }}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim hover:text-foreground"
          >
            Hide this.
          </button>
        </span>
      </div>
    </section>
  );
}
