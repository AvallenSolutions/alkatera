-- A liquid is what goes in a bottle, a can or a keg. Nothing else.
--
-- The L1 backfill gave a liquid to every product that had a recipe, without
-- asking what kind of product it was. Hospitality reuses `products` for meals,
-- drinks, menus and room nights (`product_kind`), so the cellar's liquid shelf
-- filled up with "Heritage tomato salad, Bacchus vinaigrette", "Warm chocolate
-- and Calvados pudding" and — with no defence at all — "Cellar Loft Suite".
--
-- One of those is not merely untidy. Two room nights, Garden Twin and Vineyard
-- View Double, ended up SHARING a single liquid, because they were seeded with
-- identical inputs and identity matched them. A double and a twin do not use
-- the same bed linen, and the fan-out means correcting one would silently
-- rewrite the other. Nothing has been lost yet; this removes the trap before
-- anything is.
--
-- Hospitality already has its own surfaces (/hospitality/meals, /drinks,
-- /rooms, /menus) and does not use the cellar's recipe editor, so these links
-- are inert today: no hospitality behaviour changes here. Their material rows
-- are untouched — only the liquid LINK goes, and the liquid records that
-- existed for no other reason.
--
-- Deliberately not done: inventing a parallel "dishes" entity. A meal's recipe
-- may well deserve to be owned once and shared across menus, but that is a
-- hospitality decision to make on its own terms, not a side effect of tidying
-- up the cellar.

-- ---------------------------------------------------------------------------
-- Which liquids exist only to serve hospitality products
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE hospitality_only_liquids ON COMMIT DROP AS
SELECT l.id
FROM public.liquids l
WHERE EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.liquid_id = l.id
          AND coalesce(p.product_kind, 'product') <> 'product'
      )
  -- Keep any liquid that a real drinks product also uses: unlinking the
  -- hospitality side is enough, and deleting it would strip a genuine recipe.
  AND NOT EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.liquid_id = l.id
          AND coalesce(p.product_kind, 'product') = 'product'
      );

-- ---------------------------------------------------------------------------
-- Unlink, then delete what is left over
-- ---------------------------------------------------------------------------

UPDATE public.products
SET liquid_id = NULL,
    updated_at = now()
WHERE coalesce(product_kind, 'product') <> 'product'
  AND liquid_id IS NOT NULL;

-- Same for pack formats. None exist on hospitality products today, but a meal
-- acquiring a "pack format" is the same category error and costs nothing to
-- rule out.
UPDATE public.products
SET pack_format_id = NULL,
    updated_at = now()
WHERE coalesce(product_kind, 'product') <> 'product'
  AND pack_format_id IS NOT NULL;

DELETE FROM public.liquids l
USING hospitality_only_liquids h
WHERE l.id = h.id;

COMMENT ON TABLE "public"."liquids" IS
  'The recipe as an entity for DRINKS products only: what goes in a bottle, a can or a keg, owned once and linked into every product that fills it. Hospitality meals, drinks, menus and room nights are not liquids and must never be linked here — they have their own surfaces under /hospitality. Products link via products.liquid_id.';
