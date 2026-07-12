-- Growth score snapshots — server-side history for the "forest gone quiet" nudge.
--
-- lib/desk/growth-score.ts computes the 0-100 growth score live from head counts;
-- nothing previously persisted it over time. The weekly stall sweep
-- (lib/inngest/functions/growth.ts) needs to compare today's score against the
-- score from 14+ days ago to detect an org whose forest hasn't grown, so this
-- table is the write-once-a-week history. Written by the service-role sweep only;
-- org members can read their own org's history (e.g. for a future sparkline).

CREATE TABLE IF NOT EXISTS "public"."growth_score_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "score" integer NOT NULL CHECK ("score" >= 0 AND "score" <= 100),
  "captured_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "growth_score_snapshots_org_captured_idx"
  ON "public"."growth_score_snapshots" ("organization_id", "captured_at" DESC);

ALTER TABLE "public"."growth_score_snapshots" ENABLE ROW LEVEL SECURITY;

-- Org members read their own org's history; only the service-role sweep writes
-- (no INSERT/UPDATE/DELETE policy for authenticated/anon — service role bypasses RLS).
CREATE POLICY "growth_score_snapshots_member_read" ON "public"."growth_score_snapshots"
  FOR SELECT USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));
