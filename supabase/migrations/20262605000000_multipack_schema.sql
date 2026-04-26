-- Multipack schema: adds the is_multipack flag to products and creates the
-- multipack_components / multipack_secondary_packaging tables that the app
-- already references in lib/multipacks.ts and the URL-import flow.

-- ── products.is_multipack ────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_multipack boolean NOT NULL DEFAULT false;

-- ── multipack_components ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.multipack_components (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multipack_product_id  bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id  bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity              integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT multipack_components_no_self_ref CHECK (multipack_product_id <> component_product_id),
  CONSTRAINT multipack_components_unique_pair UNIQUE (multipack_product_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS multipack_components_multipack_idx
  ON public.multipack_components (multipack_product_id);
CREATE INDEX IF NOT EXISTS multipack_components_component_idx
  ON public.multipack_components (component_product_id);

ALTER TABLE public.multipack_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY multipack_components_select ON public.multipack_components
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_components.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_components_insert ON public.multipack_components
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_components.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_components_update ON public.multipack_components
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_components.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_components.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_components_delete ON public.multipack_components
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_components.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

-- ── multipack_secondary_packaging ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.multipack_secondary_packaging (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multipack_product_id        bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_name               text NOT NULL,
  material_type               text NOT NULL,
  weight_grams                numeric NOT NULL CHECK (weight_grams >= 0),
  is_recyclable               boolean,
  recycled_content_percentage numeric CHECK (
    recycled_content_percentage IS NULL
    OR (recycled_content_percentage >= 0 AND recycled_content_percentage <= 100)
  ),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS multipack_secondary_packaging_multipack_idx
  ON public.multipack_secondary_packaging (multipack_product_id);

ALTER TABLE public.multipack_secondary_packaging ENABLE ROW LEVEL SECURITY;

CREATE POLICY multipack_secondary_packaging_select ON public.multipack_secondary_packaging
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_secondary_packaging.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_secondary_packaging_insert ON public.multipack_secondary_packaging
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_secondary_packaging.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_secondary_packaging_update ON public.multipack_secondary_packaging
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_secondary_packaging.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_secondary_packaging.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY multipack_secondary_packaging_delete ON public.multipack_secondary_packaging
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = multipack_secondary_packaging.multipack_product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

-- ── updated_at triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS multipack_components_set_updated_at ON public.multipack_components;
CREATE TRIGGER multipack_components_set_updated_at
  BEFORE UPDATE ON public.multipack_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS multipack_secondary_packaging_set_updated_at ON public.multipack_secondary_packaging;
CREATE TRIGGER multipack_secondary_packaging_set_updated_at
  BEFORE UPDATE ON public.multipack_secondary_packaging
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
