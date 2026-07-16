-- Email-in intake channel (data-revolution-plan.md Pillar 1).
--
-- Extends the ingest_jobs.channel vocabulary added in
-- 20260716130000_ingest_jobs_channel.sql with a fourth value: 'email_intake',
-- for attachments the IMAP poller (lib/inngest/functions/email-intake.ts)
-- pulls out of intake+{token}@alkatera.com and stashes through the same
-- enqueue path Smart Upload uses (lib/ingest/enqueue.ts). Purely additive —
-- widens an existing CHECK, no new column, no backfill.

alter table public.ingest_jobs
  drop constraint if exists ingest_jobs_channel_check;

alter table public.ingest_jobs
  add constraint ingest_jobs_channel_check
  check (channel is null or channel = any (array['smart_upload', 'rosa', 'supplier_import', 'email_intake']));

comment on column public.ingest_jobs.channel is
  'Which intake surface created this job: null/''smart_upload'' = the Smart Upload dropzone, ''rosa'' = the Rosa drawer upload, ''supplier_import'' = a supplier smart-import classification pass, ''email_intake'' = an attachment pulled from the org''s intake+{token}@alkatera.com mailbox. Lets all document pipelines share ingest_jobs + the learning loop while staying distinguishable in admin views.';
