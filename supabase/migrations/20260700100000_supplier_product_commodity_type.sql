-- Migration: Supplier Product Commodity Type
-- FLAG and EU Deforestation Regulation commodity classification on supplier products.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_products'
      AND column_name = 'commodity_type'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN commodity_type text NOT NULL DEFAULT 'none'
        CHECK (commodity_type IN ('cattle', 'cocoa', 'palm_oil', 'soy', 'timber', 'coffee', 'rubber', 'none'));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.commodity_type IS
  'FLAG and EU Deforestation Regulation commodity classification. Deforestation commitment checks are only triggered when this is not none.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_products'
      AND column_name = 'deforestation_commitment_verified'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN deforestation_commitment_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.deforestation_commitment_verified IS
  'Set to true when supplier has a verified no-deforestation commitment covering this commodity. Auto-set from verified ESG assessment env_09 answer.';
