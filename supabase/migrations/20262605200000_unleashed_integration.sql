-- Unleashed integration: cache tables for synced data + webhook event log.
-- Mirrors the Breww pattern (see 20260420* migrations) but flattened for the
-- shapes Unleashed returns over its REST API.

-- ── Products / SKU master ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unleashed_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Unleashed Guid surfaced as ProductCode in the UI; we use Guid as external id.
  external_id text NOT NULL,
  product_code text,
  product_description text,
  product_group text,
  brand text,
  unit_of_measure text,
  pack_size numeric(14, 4),
  weight_kg numeric(14, 4),
  default_purchase_price numeric(18, 4),
  default_sell_price numeric(18, 4),
  is_assembled_product boolean NOT NULL DEFAULT false,
  is_component boolean NOT NULL DEFAULT false,
  obsolete boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_unleashed_products_org_code
  ON public.unleashed_products(organization_id, product_code);

-- ── Bill of Materials lines ───────────────────────────────────────────────────
-- One row per (assembly product, component product) pair.
CREATE TABLE IF NOT EXISTS public.unleashed_bom_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assembly_external_id text NOT NULL,
  assembly_code text,
  assembly_description text,
  component_external_id text NOT NULL,
  component_code text,
  component_description text,
  quantity numeric(18, 6) NOT NULL DEFAULT 0,
  unit_of_measure text,
  wastage_percent numeric(8, 4),
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, assembly_external_id, component_external_id)
);

CREATE INDEX IF NOT EXISTS idx_unleashed_bom_lines_assembly
  ON public.unleashed_bom_lines(organization_id, assembly_external_id);

-- ── Suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unleashed_suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  supplier_code text,
  supplier_name text NOT NULL,
  contact_email text,
  country text,
  currency text,
  obsolete boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

-- ── Warehouses (multi-site facilities) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unleashed_warehouses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  warehouse_code text,
  warehouse_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  city text,
  country text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

-- ── Purchase order lines ──────────────────────────────────────────────────────
-- Header + line flattened. One row per PO line. Powers Scope 3 spend categorisation.
CREATE TABLE IF NOT EXISTS public.unleashed_purchase_order_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_external_id text NOT NULL,
  order_number text,
  order_date date,
  order_status text,
  supplier_external_id text,
  supplier_name text,
  supplier_currency text,
  product_external_id text,
  product_code text,
  product_description text,
  quantity numeric(18, 6),
  unit_price numeric(18, 6),
  line_total numeric(18, 6),
  line_number integer,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, order_external_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_unleashed_po_lines_supplier
  ON public.unleashed_purchase_order_lines(organization_id, supplier_external_id, order_date DESC);

-- ── Product links (alkatera product ↔ unleashed product) ─────────────────────
CREATE TABLE IF NOT EXISTS public.unleashed_product_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alkatera_product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unleashed_external_id text NOT NULL,
  linked_by uuid NOT NULL REFERENCES auth.users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, alkatera_product_id),
  UNIQUE (organization_id, unleashed_external_id)
);

-- ── Webhook events audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unleashed_webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  object_type text,
  object_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  process_error text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unleashed_webhook_events_org
  ON public.unleashed_webhook_events(organization_id, received_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'unleashed_products',
      'unleashed_bom_lines',
      'unleashed_suppliers',
      'unleashed_warehouses',
      'unleashed_purchase_order_lines',
      'unleashed_product_links',
      'unleashed_webhook_events'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Org members can view %1$I" ON public.%1$I FOR SELECT TO authenticated USING (public.user_has_organization_access(organization_id))',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Service role manages %1$I" ON public.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ── Extend product_materials data_source whitelist ───────────────────────────
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS data_source_integrity;

ALTER TABLE public.product_materials
  ADD CONSTRAINT data_source_integrity CHECK (
    (data_source = 'openlca' AND data_source_id IS NOT NULL)
    OR (data_source = 'supplier' AND supplier_product_id IS NOT NULL)
    OR (data_source = 'breww_recipe_avg' AND data_source_id IS NOT NULL)
    OR (data_source = 'breww_sku_container')
    OR (data_source = 'unleashed_bom' AND data_source_id IS NOT NULL)
    OR (data_source IS NULL)
  );

ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS valid_data_source;

ALTER TABLE public.product_materials
  ADD CONSTRAINT valid_data_source CHECK (
    data_source IS NULL
    OR data_source = ANY (ARRAY['openlca', 'supplier', 'breww_recipe_avg', 'breww_sku_container', 'unleashed_bom'])
  );

ALTER TABLE public.product_carbon_footprint_materials
  DROP CONSTRAINT IF EXISTS data_source_integrity;

ALTER TABLE public.product_carbon_footprint_materials
  ADD CONSTRAINT data_source_integrity CHECK (
    (data_source = 'openlca' AND data_source_id IS NOT NULL)
    OR (data_source = 'supplier' AND supplier_product_id IS NOT NULL)
    OR (data_source = 'breww_recipe_avg' AND data_source_id IS NOT NULL)
    OR (data_source = 'breww_sku_container')
    OR (data_source = 'unleashed_bom' AND data_source_id IS NOT NULL)
    OR (data_source IS NULL)
  );

ALTER TABLE public.product_carbon_footprint_materials
  DROP CONSTRAINT IF EXISTS valid_data_source;

ALTER TABLE public.product_carbon_footprint_materials
  ADD CONSTRAINT valid_data_source CHECK (
    data_source IS NULL
    OR data_source = ANY (ARRAY['openlca', 'supplier', 'breww_recipe_avg', 'breww_sku_container', 'unleashed_bom'])
  );
