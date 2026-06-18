-- Xero Phase 2: Travel, Accommodation & Freight Upgrades
-- Additive columns only - no breaking changes

-- 1. Add data_source to corporate_overheads for tracking Xero-originated entries
ALTER TABLE public.corporate_overheads
  ADD COLUMN IF NOT EXISTS data_source TEXT,
  ADD COLUMN IF NOT EXISTS source_xero_transaction_ids UUID[];

COMMENT ON COLUMN public.corporate_overheads.data_source IS 'Origin of this entry: manual, xero_upgrade, or NULL for legacy';
COMMENT ON COLUMN public.corporate_overheads.source_xero_transaction_ids IS 'Array of xero_transaction IDs that this entry was created from (audit trail)';

-- 2. Add extracted_metadata to xero_transactions for auto-extraction results
ALTER TABLE public.xero_transactions
  ADD COLUMN IF NOT EXISTS extracted_metadata JSONB;

COMMENT ON COLUMN public.xero_transactions.extracted_metadata IS 'Auto-extracted data from invoice descriptions: airport codes, night counts, weights, quantities';
