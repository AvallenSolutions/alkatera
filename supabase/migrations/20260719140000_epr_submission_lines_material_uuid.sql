-- 20260719140000_epr_submission_lines_material_uuid.sql
--
-- Why: epr_submission_lines.product_material_id is bigint, but
-- product_materials.id is uuid. app/api/epr/generate-submission/route.ts
-- inserts `product_material_id: material.id` (a uuid) into it, so Postgres
-- rejects the whole insert with
--   invalid input syntax for type bigint: "a0eebc99-..."
-- and the "Generate submission" action fails. Verified on production: all 6
-- existing epr_submission_lines rows have product_material_id NULL, i.e. the
-- column has never once been populated.
--
-- This is the same class as the EPR-breakdown blank-out: product_materials.id
-- became a uuid, and the integer-keyed callers were not all updated.
--
-- Safe to retype: every value is NULL, on prod and locally, so nothing is lost.
-- Adds the FK the column always implied, so a stale material id cannot linger
-- on a submission line after the recipe row is deleted.

ALTER TABLE public.epr_submission_lines
  ALTER COLUMN product_material_id TYPE uuid USING NULL::uuid;

ALTER TABLE public.epr_submission_lines
  ADD CONSTRAINT epr_submission_lines_product_material_id_fkey
  FOREIGN KEY (product_material_id)
  REFERENCES public.product_materials(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.epr_submission_lines.product_material_id IS
  'The product_materials row this RPD line was derived from. uuid, matching product_materials.id; was bigint until 20260719140000, which made every insert fail.';
