-- Report share links (Phase E of the sustainability report programme).
--
-- A share is a private capability token for the interactive (screen-mode HTML)
-- sustainability report: the rendered document is stored once in Storage and
-- served through /report/[token] until the link is revoked or expires.
--
-- Access model:
--   - The PUBLIC route reads via the service role by EXACT token match only
--     (no anon policies here, mirroring brand_reports), so a token holder can
--     never enumerate other links.
--   - Org members manage (read, create, revoke) their own org's links via RLS.
--   - Revocation is an UPDATE (revoked_at); rows are never deleted by users,
--     so the audit trail of what was shared survives.

-- Private bucket for the stored share documents. NOT public and no storage
-- policies: only the service role reads/writes it, and the public route
-- re-serves the bytes itself so revocation genuinely cuts access.
-- (report-assets is unsuitable: it is public and only allows images + PDF.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-shares', 'report-shares', false, 26214400, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS "public"."report_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id" uuid NOT NULL REFERENCES "public"."generated_reports"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "html_path" text NOT NULL,
  "created_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "revoked_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_report_shares_report" ON "public"."report_shares" ("report_id");
CREATE INDEX IF NOT EXISTS "idx_report_shares_org" ON "public"."report_shares" ("organization_id");

ALTER TABLE "public"."report_shares" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_shares_member_read" ON "public"."report_shares"
  FOR SELECT USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

CREATE POLICY "report_shares_member_insert" ON "public"."report_shares"
  FOR INSERT WITH CHECK (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

CREATE POLICY "report_shares_member_update" ON "public"."report_shares"
  FOR UPDATE USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )))
  WITH CHECK (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));
