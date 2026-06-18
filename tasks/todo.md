# Platform Dashboard: Admin Audit Trail

**Goal:** Add an accountability trail recording which alka**tera** staff member did what
admin action to which org, and surface it on the Platform Dashboard. Fits the data-privacy
work: makes operator access to identifiable tenant data accountable.

**Design:** append-only `admin_audit_log` (actor captured, unlike the anonymised
`platform_activity_log`). Writes via a `SECURITY DEFINER` `log_admin_action()` RPC that derives
the actor from `auth.uid()`. Reads via `get_admin_audit_log()` (admin-gated, filtered, paginated).

## Tasks

- [ ] 1. Migration `20260618120000_admin_audit_log.sql`:
      - table `public.admin_audit_log` (actor_id/email, action, target_type/id/label, metadata, created_at) + indexes
      - RLS: admins SELECT only; no insert/update/delete policy (append-only via RPC)
      - `log_admin_action(action, target_type, target_id, target_label, metadata)` SECURITY DEFINER
      - `get_admin_audit_log(limit, offset, action, actor, target)` SECURITY DEFINER, admin-gated
- [ ] 2. Apply locally (`supabase migration up`) + verify objects exist.
- [ ] 3. Wire logging into `PATCH /api/admin/organizations/[id]/subscription`: capture old tier/status,
      log `org.subscription_update` with {tier:{from,to}, status:{from,to}} after a successful update.
      Non-fatal if logging errors.
- [ ] 4. UI: `AdminAuditLogSection` component (self-contained: fetch via `get_admin_audit_log`,
      action filter, load-more). Add to platform page + a type in types.ts.
- [ ] 5. Verify locally: make dev user an admin, change an org's tier, confirm an audit row appears
      in the widget with correct actor/action/from-to.
- [ ] 6. Post the full migration SQL in chat for Tim to run in the Supabase SQL editor (prod).

## Review

**Shipped (local, verified):**
- Migration `20260618120000_admin_audit_log.sql`: append-only `admin_audit_log` table (RLS:
  admins read only; no write policy), `log_admin_action()` (actor from auth.uid(), admin-gated),
  `get_admin_audit_log()` (admin-gated, filtered, paginated).
- Server-side logging wired into `PATCH /api/admin/organizations/[id]/subscription` — records
  `org.subscription_update` with {tier/status from→to}, non-fatal on logging error.
- `AdminAuditLogSection` widget added to the Platform Dashboard (action filter + load-more),
  plus `AdminAuditEntry`/`AdminAuditLog` types.

**Verified:** end-to-end via the real auth path (logged an action with a user token, read it back
with correct actor/action/target/metadata, confirmed a non-admin is refused); typecheck clean;
platform page compiles + serves 200 with the widget.

**Outstanding:**
- Run the migration SQL in the Supabase SQL editor (prod) — posted in chat.
- Commit (not yet committed).
- Natural extensions: log drill-downs/exports and other admin mutations through the same RPC.
