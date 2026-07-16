-- Data revolution Phase A / Pillar 3: make agent_exceptions sweeps genuinely
-- idempotent. Several code comments (app/api/agents/exceptions/route.ts,
-- app/api/agents/footprint/run/route.ts) already claimed a partial unique
-- index on source_ref->>'ingestJobId' existed and backed their dedup logic
-- — it never actually did (dedup was app-level pre-check only, a real race
-- window). Add it now, plus matching indexes for the two new job tables the
-- footprint sweep lifts (product_import_jobs, supplier_product_import_jobs),
-- so a concurrent sweep can never double-queue the same source job.
--
-- Verified against the local DB before writing this migration: no existing
-- duplicate ingestJobId values, so the unique index is safe to add without a
-- backfill/dedup step.

CREATE UNIQUE INDEX IF NOT EXISTS agent_exceptions_source_ref_ingest_job_idx
  ON public.agent_exceptions ((source_ref ->> 'ingestJobId'))
  WHERE source_ref ->> 'ingestJobId' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_exceptions_source_ref_product_import_job_idx
  ON public.agent_exceptions ((source_ref ->> 'productImportJobId'))
  WHERE source_ref ->> 'productImportJobId' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_exceptions_source_ref_supplier_import_job_idx
  ON public.agent_exceptions ((source_ref ->> 'supplierImportJobId'))
  WHERE source_ref ->> 'supplierImportJobId' IS NOT NULL;
