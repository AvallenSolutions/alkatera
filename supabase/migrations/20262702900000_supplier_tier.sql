-- Supplier tier classification
-- Supports risk-based prioritisation of supplier due diligence, as expected by
-- the new B Corp standards (focus human rights and climate engagement on the
-- highest-risk, highest-spend, most direct suppliers first).
--
-- country, annual_spend and spend_currency already exist on suppliers, so only
-- the tier classification is added here.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_tier text;

ALTER TABLE public.suppliers
  ADD CONSTRAINT valid_supplier_tier
  CHECK (supplier_tier IS NULL OR supplier_tier IN ('tier_1', 'tier_2', 'tier_3'));

COMMENT ON COLUMN public.suppliers.supplier_tier IS
  'Buyer classification of supply-chain position: tier_1 (direct supplier), tier_2 (supplier''s supplier), tier_3 (further upstream). Drives risk-based due-diligence prioritisation.';
