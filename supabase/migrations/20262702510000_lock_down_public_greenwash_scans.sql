-- Lock down public_greenwash_scans (HIGH-3, security review 2026-05-29)
--
-- public_greenwash_scans stores marketing-lead emails captured by the free
-- Greenwash Guardian scan tool. Its SELECT policy was `USING (true)`, so ANY
-- anonymous caller could read every lead's email and scanned URL.
--
-- The feature does not need a public read policy: the marketing site polls
-- scan status through the service-role API route
-- (GET /api/greenwash/public?scanId=...), which bypasses RLS, and that
-- response never returns the email column.
--
-- Fix: remove the public read policy (RLS then default-denies anon /
-- authenticated reads; the service role retains full access). Also clear the
-- existing backlog of lead PII older than 24h - the retention that the
-- original migration described in a comment but never implemented. Ongoing
-- enforcement runs via the new cron route
-- /api/cron/purge-public-greenwash-scans.

DROP POLICY IF EXISTS "Anyone can read public scans" ON public.public_greenwash_scans;

-- One-time retention cleanup of historical lead data.
DELETE FROM public.public_greenwash_scans
WHERE created_at < now() - interval '24 hours';
