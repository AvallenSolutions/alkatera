-- PCF lifecycle and critical-review fixes.
--
-- 1. Drop the redundant valid_status CHECK: product_carbon_footprints has TWO
--    overlapping status constraints and the narrower one (valid_status) blocks the
--    'superseded' value that product_carbon_footprints_status_check already allows.
--    The aggregator has been demoting superseded records to 'draft' as a workaround,
--    which the wizard then resumed as in-progress drafts.
-- 2. Add review_status: the critical-review flow was writing 'ready_for_review' /
--    'approved' into status, which the CHECK rejected silently. Review state gets its
--    own column so lifecycle consumers filtering on status='completed' keep working.
-- 3. Add calculation_fingerprint: persists the calculator's existing in-memory
--    SHA-256 input fingerprint so staleness can be detected server-side.

alter table public.product_carbon_footprints
  drop constraint if exists valid_status;

alter table public.product_carbon_footprints
  add column if not exists review_status text not null default 'none'
    constraint pcf_review_status_check
    check (review_status in ('none', 'ready_for_review', 'in_review', 'approved', 'rejected')),
  add column if not exists calculation_fingerprint text,
  add column if not exists error_message text;

comment on column public.product_carbon_footprints.error_message is
  'Why the last calculation failed (status = failed); shown so the wizard can resume instead of the old behaviour of hard-deleting the draft.';

comment on column public.product_carbon_footprints.review_status is
  'ISO critical-review workflow state, separate from the calculation lifecycle in status.';
comment on column public.product_carbon_footprints.calculation_fingerprint is
  'SHA-256 of the calculation inputs (boundary, facilities, factors, materials, year) written at calc time; used for staleness detection.';
