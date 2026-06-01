# Performance — Quick Wins Bundle (2026-05-30)

Goal: make the platform (especially the Rosa landing page) feel faster. This
bundle is the low-risk, boot-path subset of the 10-item performance audit.

## Plan
- [x] **#1 Hot-path DB indexes** — migration `supabase/migrations/20262702600000_perf_hot_path_indexes.sql`
  - `organization_members(user_id)` — hottest query in the app, currently seq-scans
  - `products(organization_id, created_at DESC)` — products had no org index at all
  - `product_carbon_footprints(organization_id, status)` — ~6 Rosa hub queries/load
  - [ ] **Tim to run the SQL in Supabase SQL editor (prod)** — see chat for CONCURRENTLY version
- [x] **#2 Middleware auth scoping** — `middleware.ts`
  - `getUser()` (a network round-trip to Supabase Auth) ran on every request but
    was only used for the distributor redirect. Now early-returns for all
    non-distributor paths. Safe: browser client refreshes session into cookies.
- [x] **#6 Instant shell skeleton** — `components/layouts/AppLayout.tsx`
  - Replaced the blank full-screen spinner with an `AppShellSkeleton` that mirrors
    the real sidebar + header + content layout.
- [x] **#10 (partial) Sidebar nav memoisation** — `components/layouts/Sidebar.tsx`
  - The recursive nav tree (~40 items) rebuilt on every render. Now `useMemo`'d on
    org/tier/feature deps; hoisted `TIER_DISPLAY_NAMES` to module scope.

## Verification
- [x] `pnpm typecheck` passes (exit 0, zero errors)
- [x] Main-repo dev server compiles + serves all critical-path routes:
      `/login` → 200, `/rosa` → 200, `/` → 200, no error output in build logs.
      `/rosa` exercises the AppLayout skeleton + memoised Sidebar (SSR, no crash);
      every route runs the new middleware (no 500).
- [x] Distributor redirect preserved by construction — the distributor branch
      logic is byte-for-byte unchanged; only a non-distributor early-return was
      added above it.
- [~] Logged-in visual (skeleton flash, nav gating) NOT captured: the skeleton is
      a transient loading state and local login hits production. The nav memo
      returns identical output to before (pure caching), so behaviour is unchanged.

## Review
- 4 changes shipped, all low-risk and on the boot path:
  1. **Indexes** — migration file written; **SQL still needs running in prod** (chat).
  2. **Middleware** — removed a Supabase Auth network round-trip from every
     non-distributor request. Safe because the @supabase/ssr browser client
     refreshes the session into the same cookies the server reads, and the
     authenticated layout is a pass-through to the client `AppLayout` (no
     server-side session gate).
  3. **AppShellSkeleton** — blank spinner → layout-shaped skeleton (perceived perf).
  4. **Sidebar memo** — nav tree no longer rebuilt on every render; only on
     org/tier/feature changes. `hasFeature` (useCallback) + `usage` confirmed
     stable, `completedMilestones`/`viticultureVisible` memoised, deps verified.
- No behavioural changes intended; outputs identical, just fewer round-trips and
  fewer recomputations.

---

# Performance — Rosa Deep Fix (#3 + #4) (2026-05-30)

Plan: `~/.claude/plans/elegant-splashing-stream.md`. Pattern: instant cache +
client-driven background refresh (serverless kills post-response promises, so
the upgrade is client-driven, mirroring EsgVitalityScoreHero's two-stage load).

## Done
- [x] **#4a Closed-drawer fetch** — `components/rosa/RosaDrawer.tsx`
  - Split into thin `RosaDrawer` (reads `isOpen`, `if (!isOpen) return null`) +
    `RosaDrawerBody` (holds `useRosaConversation` + consume-effects). The recent-
    conversations fetch no longer fires while the drawer is closed. Pinned forces
    isOpen=true so auto-open/auto-resume preserved.
- [x] **#4b Realtime consolidation** — new `lib/rosa/RealtimeRefreshProvider.tsx`,
    rewrote `lib/rosa/useRealtimeRefresh.ts` (same signature), mounted provider in
    `AppLayout`. ONE `rosa-live-${orgId}` channel over a hardcoded ~25-table union
    (was ~7 per-card channels), 250ms trailing debounce per subscriber, latest-
    callback ref (no resubscribe churn), org-switch teardown + timer clear.
- [x] **#3b priority-tiles instant cache** — migration `..._priority_tile_cache_readiness.sql`
    (+`readiness_json`). Route: cache SELECT first, return instantly without
    building the ~31-query pack (TTL-only read, hash dropped from read path);
    cold/legacy → fallback + seed cache; `?fresh=1` curates + writes cache;
    `?fresh=1&auto=1` (background) respects daily budget, user Re-pick bypasses it.
    Client `PriorityTiles.tsx`: instant render → background `fresh+auto` if stale;
    realtime tick → guarded `maybeUpgrade` (replaces un-debounced fresh storm).
- [x] **#3a vitality/composite instant cache** — migration `..._esg_snapshot_composite_json.sql`
    (+`composite_json`, `composite_generated_at`). `snapshot.ts`: write full
    composite + `loadLatestSnapshot`. Route: serve stored composite instantly
    (skips the ~39-query rebuild), `?fresh=1` recomputes; `stale` flag from
    age/day. Clients `VitalityHero` + `EsgVitalityScoreHero`: instant render →
    background fresh if stale; ticks → guarded recompute (so /performance still
    self-heals). `composite_json` carries the *_breakdown explainers /performance
    + the modal read, so no parity loss.

## Verification (Rosa deep fix)
- [x] `pnpm typecheck` clean (exit 0, whole repo)
- [x] rosa + vitality test suites: 160 files / 4760 tests pass. The only main-repo
      failure is `lib/rosa/__tests__/actions.test.ts` ("expose the three action tool
      names": expects 3, code has 10) — PRE-EXISTING + unrelated; it tests
      `ACTION_TOOL_NAMES` in `lib/rosa/tools.ts`, which this work never touched.
      The other 11 failures are `.claude/worktrees/*` copies of that same stale test
      (vitest `exclude` omits `.claude/worktrees`).
- [x] All changed routes compile + respond on :8888 — `/rosa` 200, `/performance`
      200, `/api/rosa/priority-tiles` 401, `/api/vitality/composite` 401, plus the
      `?fresh=1` / `?fresh=1&auto=1` variants. No 500s, no compile errors in logs.
- [ ] **Tim to run BOTH new migrations in Supabase SQL editor (prod) — RUN FIRST,
      before deploy.** Additive nullable columns (safe early); the snapshot/cache
      writes include the new columns, so writing before they exist would fail the
      whole upsert. Each ends with `NOTIFY pgrst, 'reload schema'`. SQL in chat.
- [~] Authenticated runtime (1 websocket vs 7, no closed-drawer fetch, cache-hit
      timing) NOT captured — local login hits prod and needs a real session.
      Logic verified by construction + compile + tests; behaviour-preserving by design.

## Pre-existing issues spotted (separate, not perf items)
- `lib/rosa/__tests__/actions.test.ts` asserts exactly 3 action tool names but
  `ACTION_TOOL_NAMES` now has 10 — stale test, update or delete.
- vitest `exclude` doesn't list `.claude/worktrees`, so stale worktree test copies
  run in the suite and add noise. Consider adding `.claude` to `exclude`.

---

# Performance — Bundle + config wins (2026-05-30)

## Done & committed (2290aa6e)
- [x] **#9 (partial) xlsx lazy-load** — `SpendImportCard.tsx` imports xlsx (~7MB)
      on demand in the two handlers, not at module top. Off the scope-1-2 bundle.
- [x] **#10 next.config images** — `formats: [avif, webp]` + `minimumCacheTTL` 30d.
- [x] **#10 not-found font** — render-blocking Google Fonts `@import` → `next/font`.
- [x] **#9 maps** — VERIFIED already dynamic-imported at call sites (OverviewTab,
      WaterDeepDive). No change needed.

## Deferred (each needs its own focused session — NOT safe to rush)
- **#9 framer-motion LazyMotion** — only pays off if ALL rendered landing files
  stop importing full `motion`. That's 16 files in `marketing/` (incl. Navigation,
  ContactModal, 8 landing sections) + `Showcase.tsx` uses `layoutId` (needs
  `domMax`, not `domAnimation`). Requires a `LazyMotion` wrapper + converting every
  `motion.`→`m.` across all 16, then visual QA of the public homepage. A naive
  partial conversion throws at runtime. Scope it as a marketing-wide task.
- **#9 recharts shared dynamic wrapper** — ~27 client components import recharts
  eagerly; needs one `LazyChart` wrapper adopted across all + the 2,671-line
  scope-1-2 page split. Mechanical but broad; own pass.
- **#5 auth/org/subscription bootstrap RPC** — ✅ DONE & committed. New
  `get_user_bootstrap()` (migration 20262702800000) composes get_organization_usage
  + is_alkatera_admin + get_pending_approval_count; org context tries it then falls
  back to the intact legacy path on any error (login can't break); subscription +
  admin handed off via `lib/auth/bootstrap-cache.ts`. VOLATILE (self-healing UPDATE).
  - [ ] **Tim: run migration 20262702800000 in Supabase SQL editor** (order-
        independent for safety; only unlocks the speedup). Then verify per the plan:
        SQL-in-isolation, equivalence (`get_user_bootstrap('org')->'subscription' =
        get_organization_usage('org')`), one-round-trip in Network tab, and the
        fallback drill (force the fn to return {error} → login still works via legacy).
- **#8 calculateScope3 N+1** — ✅ DONE & committed (15db542b, parallelise-only).
  The two serial per-product loops in `lib/calculations/corporate-emissions.ts` now
  use `Promise.all` with order-preserving in-order sums → bit-identical output. The
  frozen 24-case oracle (corporate-emissions + cross-surface-consistency) passes
  UNCHANGED + 2 new concurrency cases (26 total). NO migration / NO prod action —
  pure code change, safe to deploy. Full `.in()` batching (query-count cut) deferred
  to its own pass with a real-prod before/after numeric diff (changes query shape +
  oracle mocks).
- **#7 client query cache** — ✅ FOUNDATION DONE & committed (3f8d2e1a). Added
  @tanstack/react-query v5 + `components/providers/QueryProvider.tsx` (SSR-safe,
  mounted between ThemeProvider and AuthProvider) + migrated `useProductSpotlight`
  as the shape-preserving template (consumer unchanged). No prod action needed.

  ### TanStack migration — remaining ~98 hooks (incremental, mechanical)
  Recipe (documented in the header of `hooks/data/useProductSpotlight.ts`):
  1. Extract the fetch body verbatim into a module-level `queryFn(orgId, ...)`.
  2. `useQuery<T>({ queryKey: ['<resource>', orgId, ...params], queryFn,
     enabled: !!orgId, staleTime: 60_000 })` — note the explicit `<T>` generic
     (without it, consumers see `data` as `any`).
  3. Map react-query's `{data,isLoading,error,refetch}` back onto the hook's
     EXISTING public shape so consumers don't change.
  Two legacy return-shape conventions to preserve per hook: `loading` (~67 files)
  vs `isLoading` (~27). Port one hook (or a small related group) per PR, verify
  against its consumer. Good next candidates: `useKpiSummary` (simplest),
  `useSuppliers`, `useCompanyFootprint`. Leave realtime-subscription hooks
  (`useNotifications`) and the 1378-line `useCompanyMetrics` for last.
  Genuine multi-day migration: add lib + provider, port hooks incrementally with
  per-hook testing. Biggest structural win but the largest effort; schedule it.

## Why deferred rather than half-shipped
#5/#7/#8 all need real-session or golden-value verification that isn't possible
from this environment (local `.env.local` points at prod; auth needs a live
session). Landing them unverified would fail the "would a staff engineer approve"
bar. Better to scope them precisely (above) and do each properly.
