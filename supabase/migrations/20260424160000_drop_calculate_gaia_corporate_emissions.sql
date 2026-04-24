-- Drop the legacy calculate_gaia_corporate_emissions RPC.
--
-- This function was the original "authoritative" corporate emissions calculator
-- for Gaia/Rosa AI responses. Over time it diverged from the TypeScript
-- aggregator in lib/calculations/corporate-emissions.ts:
--   - it did not honour upgrade_status on xero_transactions
--   - it missed Category 4 (upstream transport), Category 9 (downstream
--     transport) and Category 11 (use-phase) in Scope 3
--   - it could not observe the coverage-resolver suppression rules or the
--     inventory-ledger consumption-date re-booking introduced in Phase 2.
--
-- Gaia now calls POST /api/internal/authoritative-emissions instead, which
-- wraps the canonical TypeScript calculator. This migration removes the RPC
-- so no future code path can reach back to the stale implementation.

DROP FUNCTION IF EXISTS public.calculate_gaia_corporate_emissions(uuid, integer);
