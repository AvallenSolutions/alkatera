-- Trial reminder log — idempotency for the daily "your trial ends soon" sweep.
--
-- The sweep (lib/inngest/functions/trial-reminders.ts) runs once a day and emails trial
-- orgs approaching their charge date. This table records which milestone reminders
-- (7/3/1 days before) have already been sent, keyed by the trial's expiry, so a reminder
-- is sent exactly once even if the cron runs late, twice, or retries. Service-role only.

CREATE TABLE IF NOT EXISTS "public"."trial_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "milestone" text NOT NULL,                 -- '7day' | '3day' | '1day'
  "trial_expires_at" timestamptz NOT NULL,   -- the trial end this reminder was for
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "trial_reminders_unique" UNIQUE ("organization_id", "milestone", "trial_expires_at")
);

CREATE INDEX IF NOT EXISTS "trial_reminders_org_idx"
  ON "public"."trial_reminders" ("organization_id", "trial_expires_at");

-- Only the service-role sweep reads/writes this; enable RLS with no policies so the
-- anon/authenticated roles have no access (service role bypasses RLS).
ALTER TABLE "public"."trial_reminders" ENABLE ROW LEVEL SECURITY;
