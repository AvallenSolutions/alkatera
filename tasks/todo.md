# Data Security & Privacy: cut the AI assistant / local dev off from production data

**Goal:** Make it impossible for Claude (or anyone with the repo checked out) to read or write
real organisations' private data from the local workspace. Then verify the in-app multi-tenancy
fixes from the May review are actually live.

**Decisions (Tim, 2026-06-18):** Close both exposures, *agent/local-dev access first*. Local dev
runs against a **local Supabase** with seeded synthetic data.

---

## The exposure (confirmed)

`.env.local` points `NEXT_PUBLIC_SUPABASE_URL` at the **production** project
(`dfcezkyaejrxmbwunhry.supabase.co`) and contains `SUPABASE_SERVICE_ROLE_KEY`. The service-role
key bypasses RLS entirely, so any script or the dev server run in this workspace has unrestricted
read/write over every tenant's live data. This is a higher-privilege hole than CRIT-1/CRIT-2,
because it doesn't even go through RLS. The same file also carries live Stripe / Resend / OAuth /
Anthropic secrets.

---

## Phase 1 — Isolate local dev from production (do first)

- [x] 1. Preserved current prod secrets OUT of the repo: `~/.alkatera/prod-env.backup` (chmod 600).
- [x] 2. Docker running.
- [x] 3. `supabase start` -> local API at `http://127.0.0.1:54321`; all 11 services healthy.
- [~] 4. Migrations: found 24 duplicate version numbers (fixed via git mv -> unique versions) AND a
      deeper problem — the history has CHRONOLOGICAL INVERSIONS (e.g. `add_vineyard_luc_fields`
      alters `vineyards` 4 weeks before `viticulture_support` creates it). The 334 historical
      migrations cannot be replayed start-to-finish. **Needs the Phase 1b decision below.**
- [ ] 5. Seed synthetic, non-customer data — blocked on a clean schema (step 4 / 1b).
- [x] 6. **Repointed `.env.local` Supabase vars to local** (option a: other keys untouched). Verified:
      URL=127.0.0.1, keys issued by `supabase-demo`, prod ref `dfcezkyaejrxmbwunhry` = 0 occurrences.
      **PRIVACY GOAL MET: this workspace can no longer reach prod org data via Supabase.**
- [x] 7. Verified isolation (above). Removed stray /tmp copies that held the prod key.
- [ ] 8. Document the rule in CLAUDE.md + LOCAL_DEV.md (after 1b).

## Phase 1b — Rebuild a clean, usable local schema (DECISION NEEDED)

The migration history isn't replayable. To get a working local DB:
- **(A) Squash to a baseline from prod's real schema** (`supabase db dump --schema-only`, DDL only,
  zero customer rows). Accurate, makes the repo rebuildable forever. Recommended. One-time
  schema-only prod read (no org data).
- **(B) Reorder the 334 historical migrations** until `db reset` replays. Fragile, slow, correctness
  depends on guessing prod's true order.
- **(C) Defer** — privacy is already delivered; local app stays partially broken until A/B.

### Tim's action (production blast radius — not done by Claude)
- [ ] 9. **Rotate the production Supabase service-role key** (and ideally the other live secrets that
      have sat in the local dotfile), keeping prod secrets only in Netlify. This kills the value that
      has been on disk. Needs a Netlify env update + redeploy.

## Phase 2 — In-app multi-tenancy (circle back)

- [ ] 10. Confirm the CRIT-1/CRIT-2 migrations are applied to production (metadata-only check via
      `supabase migration list` or Studio): `20262702500000_harden_get_current_organization_id`,
      `20262702530000_org_context_app_metadata`, `20262702510000_lock_down_public_greenwash_scans`,
      `20262702540000_restrict_ef_selection_log_read`. Apply any still pending (post SQL in chat).
- [ ] 11. Add a regression test (now possible locally): assert hardened
      `get_current_organization_id()` returns NULL for a forged org id with no membership.

---

## Phase 2 — In-app multi-tenancy (VERIFIED from the prod schema dump)

- [x] 10. All four May "pending apply" security migrations are confirmed LIVE in production:
      `get_current_organization_id()` verifies membership + reads server-only `app_metadata`;
      `public_greenwash_scans` has no public-read policy; `ef_selection_log` is own-rows only.
      (Read straight from the schema-only dump — no customer data touched.)
- [ ] 11. Optional regression test: assert `get_current_organization_id()` returns NULL for a
      forged org with no membership. Now trivial to add against local. Not yet written.

---

## Review

**Delivered**
- **Privacy goal met:** `.env.local` now points at local Supabase; the prod project ref and
  service-role key are gone from the workspace. This agent / any clone can no longer read or write
  production org data. Verified: local-only URL, `supabase-demo`-issued keys, 0 prod-ref occurrences.
- **Local dev fully functional & reproducible:** local stack up; schema rebuilt from a single
  schema-only baseline (328 tables, 978 policies); roles + synthetic org seeded; local login works
  end-to-end (`dev@local.test`). `LOCAL_DEV.md` documents the whole flow; CLAUDE.md has the rule.
- **Fixed two latent repo defects:** 24 duplicate migration versions; an `on_auth_user_created`
  trigger that prod had but the repo never version-controlled.
- **Phase 2 verified:** the May RLS hardening is confirmed deployed to production.

**Handoffs to Tim**
- **Rotate the prod Supabase service-role key** (+ other live secrets that sat in `.env.local`),
  keeping prod secrets only in Netlify. This is the step that kills the on-disk copy for good.
- Decide whether to commit the squash (large diff: baseline + 334 archive moves + seed + script + docs).

**Known gaps (follow-ups, optional)**
- Storage buckets/policies not recreated locally (baseline excluded the `storage` schema).
- Reference data beyond roles (emission factors, tiers, templates) not in `seed.sql`; use
  `/admin/demo-seed` for rich data.
- Regression test (step 11) not yet written.
