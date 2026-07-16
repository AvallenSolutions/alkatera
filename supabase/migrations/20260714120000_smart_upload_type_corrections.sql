-- Smart Upload wrong-type corrections.
--
-- ingest_jobs gains reclassification bookkeeping: original_result_type is the
-- classifier's first answer (set once, on the first reclassify), so the final
-- result_type can be overwritten in place and every consumer keeps working.
--
-- ingest_feedback gains corrected_result_type + misclassified so type-level
-- errors become visible. They were structurally invisible before: when the
-- classifier picked the wrong type, the user simply closed the wrong review
-- panel and nothing was recorded.

alter table public.ingest_jobs
  add column if not exists original_result_type text,
  add column if not exists reclassify_count integer not null default 0;

comment on column public.ingest_jobs.original_result_type is
  'Classifier''s first result_type before any user-driven reclassify. Null when never corrected.';
comment on column public.ingest_jobs.reclassify_count is
  'How many times the user re-ran extraction with a forced document type on this job.';

alter table public.ingest_feedback
  add column if not exists corrected_result_type text,
  add column if not exists misclassified boolean not null default false;

comment on column public.ingest_feedback.corrected_result_type is
  'Document type the user corrected to via reclassify. Null when the classifier''s type was accepted.';
comment on column public.ingest_feedback.misclassified is
  'True when the user changed the document type. result_type remains the classifier''s ORIGINAL answer.';

create index if not exists ingest_feedback_misclassified_idx
  on public.ingest_feedback (created_at desc)
  where misclassified;
