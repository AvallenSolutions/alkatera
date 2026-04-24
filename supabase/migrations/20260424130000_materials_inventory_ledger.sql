-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2: Materials inventory ledger
--
-- Purpose: eliminate cross-period double-counting. A Xero receipt dated 2025-10
-- that stocks ingredient X used in a production_log dated 2026-03 must book its
-- emission to 2026 (consumption period), not 2025 (purchase period).
--
--   material_receipts       : one row per inventory receipt (Xero or manual)
--   material_consumptions   : one row per (production_log, receipt) pair drawing down
--   material_ingredient_links : persistent user-set mapping from a Xero row → an
--                               ingredient, plus the physical quantity the spend
--                               represents (e.g. "£5,000 = 10,000 × 750ml bottles")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.material_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('xero_transaction', 'manual')),
  xero_transaction_id UUID REFERENCES public.xero_transactions(id) ON DELETE CASCADE,
  received_date DATE NOT NULL,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  quantity_unit TEXT NOT NULL,
  unit_cost_gbp NUMERIC,
  total_cost_gbp NUMERIC,
  emission_kg NUMERIC,
  quantity_consumed NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_consumed >= 0),
  status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (status IN ('in_stock', 'partially_consumed', 'fully_consumed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT material_receipts_consumed_lte_quantity CHECK (quantity_consumed <= quantity),
  CONSTRAINT material_receipts_xero_unique UNIQUE (xero_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_material_receipts_fifo
  ON public.material_receipts (organization_id, ingredient_id, received_date, id)
  WHERE ingredient_id IS NOT NULL AND status <> 'fully_consumed';

CREATE INDEX IF NOT EXISTS idx_material_receipts_org_date
  ON public.material_receipts (organization_id, received_date);

CREATE TABLE IF NOT EXISTS public.material_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_log_id UUID NOT NULL REFERENCES public.production_logs(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.material_receipts(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  consumed_quantity NUMERIC NOT NULL CHECK (consumed_quantity > 0),
  consumed_emission_kg NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'fifo' CHECK (method IN ('fifo', 'explicit')),
  consumption_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_consumptions_log
  ON public.material_consumptions (production_log_id);
CREATE INDEX IF NOT EXISTS idx_material_consumptions_receipt
  ON public.material_consumptions (receipt_id);
CREATE INDEX IF NOT EXISTS idx_material_consumptions_org_date
  ON public.material_consumptions (organization_id, consumption_date);

CREATE TABLE IF NOT EXISTS public.material_ingredient_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xero_transaction_id UUID NOT NULL UNIQUE REFERENCES public.xero_transactions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  quantity_unit TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_ingredient_links_ingredient
  ON public.material_ingredient_links (organization_id, ingredient_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_ingredient_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read material_receipts"
  ON public.material_receipts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members write material_receipts"
  ON public.material_receipts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members read material_consumptions"
  ON public.material_consumptions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members write material_consumptions"
  ON public.material_consumptions FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members read material_ingredient_links"
  ON public.material_ingredient_links FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Org members write material_ingredient_links"
  ON public.material_ingredient_links FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- updated_at trigger for material_receipts
CREATE OR REPLACE FUNCTION public.tg_material_receipts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS material_receipts_set_updated_at ON public.material_receipts;
CREATE TRIGGER material_receipts_set_updated_at
  BEFORE UPDATE ON public.material_receipts
  FOR EACH ROW EXECUTE FUNCTION public.tg_material_receipts_set_updated_at();
