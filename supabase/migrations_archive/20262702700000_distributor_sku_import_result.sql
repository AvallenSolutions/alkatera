-- ============================================================
-- DISTRIBUTOR SKU IMPORT — async result payload
-- ============================================================
-- The SKU-list import moved from a synchronous confirm request to a
-- Netlify background function (real distributor catalogues run ~1-2k
-- serial DB round-trips and 504'd the synchronous handler). The
-- background function writes the completion-screen payload here so the
-- upload wizard can read it after polling the row to status='complete'.
-- ============================================================

alter table public.distributor_sku_lists
  add column if not exists import_result jsonb;
