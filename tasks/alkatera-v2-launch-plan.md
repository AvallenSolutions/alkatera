# alkatera v2: strategic plan to launch

Written 2026-07-20, after Tim settled the data question. This is the path forward;
tactical detail lives in `tasks/cutover-test-plan.md` and the per-stream plans.

## THE DECIDED PATH (do not relitigate)

**Customer data never moves.** Alkatera2 (`dfcezkyaejrxmbwunhry`) remains the one
production database through the launch and beyond. The staging Supabase project
(`vwhdyqvlgjqmlzmsvaes`) is a disposable test bed and is NEVER promoted to
production. At launch, the redesign app on Vercel is pointed at Alkatera2, the
redesign's additive migrations are applied to Alkatera2 (rehearsed on a clone
first), DNS moves, and Netlify shuts down after a safe watch period.

Why: the safest data migration is the one that never happens. The redesign's
schema changes are all additive (new tables, columns, indexes). Auth hashes,
storage files, Stripe IDs and Xero tokens all stay put. Rollback is DNS back to
Netlify; the data was never in transit.

The end state: alkatera v2 = redesign UI + Vercel hosting + Alkatera2 data.
Netlify is retired. The staging project is retired or kept as a permanent
test bed.

## Where we are today (2026-07-20)

- `redesign` fully contains `main` (second sync, merge 094cac4d). Zero behind.
- Staging is LIVE and WHOLE: app deploys on push, packaging/LCA schema applied
  and verified (13 endpoints, 3 gap-fillers, EPR uuid column, PCF uniqueness).
- tsc clean, 811 scoped tests green, prod build green, packaging flow walked
  in a browser against local Supabase.
- Known open correctness work: report sections never render (steps 2-10 of
  `tasks/report-sections-plan.md`), facilities kg-vs-tonnes line, targets page.
- Reports have never run end-to-end with real GEMINI/PDFShift keys anywhere.

## Phase 1 - Make staging genuinely testable (this week)

The point: Tim cannot judge the redesign against an empty database and
fallback prose.

1. **Seed staging with rich data.** Click `/admin/demo-seed` on staging to build
   the alkatera Drinks Co showcase org (products, LCAs seeded complete, Pulse
   trends, EPR, hospitality, Rosa history). Do NOT run Recalculate LCAs after.
2. **Put the real service keys into the staging Vercel project**: GEMINI_API_KEY
   (Rosa + report narratives), PDFSHIFT (PDF export), Stripe TEST-mode keys,
   RESEND. Without these, half the platform demos as fallbacks.
3. **Fresh-org arrival click-through**: sign up a second org through the front
   door to test the arrival ritual, website reveal and growth field from zero.
4. **Fix the report-sections stream** (steps 2-10): five sections silently never
   render; the kg/tonnes facilities line is the highest-consequence bug on the
   branch. This is the biggest known gap between "looks done" and "is done".

Exit gate: Tim can log into staging and exercise every room against realistic
data, with real AI prose and a real PDF.

## Phase 2 - Structured testing, the "am I happy" loop (weeks 2-4)

Tim tests room by room using the scripts in `tasks/cutover-test-plan.md`
Layer 3 (Cellar first: product + packaging + LCA; then Evidence/reports,
Desk/arrival, Network, Workbench, Wiring, Rosa). Each pass produces a punch
list; sessions fix items and push; staging redeploys on push, and main fixes
keep flowing in via the weekly main-to-redesign merge (divergence is currently
zero; keep it there).

Exit gate: Tim declares the design and features good. Nothing ships to
customers until this gate passes, so there is no calendar pressure on it.

## Phase 3 - Launch readiness (runs in parallel with Phase 2)

1. **The numbers-don't-change harness.** Sequence: Tim runs the all-orgs recalc
   on PROD first (Happy Curations then Everleaf, warn Clair); THEN snapshot
   prod's `aggregated_impacts` per completed PCF as golden fixtures; assert the
   redesign calculator reproduces them exactly. This is what makes the launch
   provable rather than hopeful.
2. **Migration rehearsal.** Structural clone of Alkatera2; apply the 13 redesign
   migrations (all additive - verify that claim mechanically at rehearsal time);
   record timings and any surprises. Repeat until boring.
3. **Vercel production project.** A SEPARATE Vercel project (not
   alkatera-staging) pointed at the production branch, with an env parity audit
   against Netlify's vars (CRON_SECRET, GEMINI, PDFSHIFT, Stripe LIVE keys +
   webhook secret, SUPABASE service keys for Alkatera2, RESEND, CalDAV,
   INNGEST_*). Remember: no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, the maps key is
   served at runtime.
4. **Inngest registration** for the production project (serve URL /api/inngest,
   both keys). All 14 scheduled jobs are Inngest-native crons; if this step is
   missed they ALL stop silently. Verify all 14 functions appear in the Inngest
   dashboard with cron triggers, then add the staleness canary.
5. **Integration repoints staged and scripted**: Stripe webhook endpoint,
   Supabase auth redirect URLs / Site URL, Resend domain, DNS records at
   Infomaniak (use the internal API, the wizard is buggy).
6. **Branch mechanics at launch**: merge `redesign` into `main` (the one
   sanctioned merge), Vercel production tracks `main`, Netlify builds disabled
   at the same moment so main-on-Netlify and main-on-Vercel never both serve.
7. **Security pre-launch pass**: the 11 reference tables with RLS disabled
   (flagged by Supabase advisors on staging, almost certainly mirrored on prod)
   get RLS enabled WITH read policies for authenticated users; verify against
   prod's advisor list. Rotate the old prod service-role key (long-pending).

Exit gate: rehearsal boring, goldens green against a clone, env parity signed
off, Inngest dashboard showing 14 armed crons on the production project.

## Phase 4 - Launch day (the runbook)

Half a day, low-traffic window:

1. Freeze main (fixes only, already the norm).
2. Final main-to-redesign merge; full build; smoke on staging.
3. Apply the additive migrations to Alkatera2 (the rehearsed script).
4. Merge redesign to main; Vercel production deploys it against Alkatera2.
5. Verify on the Vercel URL directly BEFORE DNS: login as tim@alkatera.com,
   one LCA recalc spot-check, one report render, Stripe webhook test event.
6. Move DNS at Infomaniak. Keep Netlify deploy warm but paused.
7. Repoint Stripe webhook + auth redirects; register Inngest; fire one manual
   cron route with CRON_SECRET to prove the path.
8. Golden check against live prod: re-run the Layer 1 snapshots; spot-check one
   published report and one EPR submission byte-for-byte.

Rollback at any step before DNS: nothing happened. After DNS: point DNS back;
the additive migrations are harmless to the Netlify app (they add unused
tables), so no schema rollback is needed. That property is WHY the additive
claim gets mechanically verified in Phase 3.

## Phase 5 - Watch week, then shutdown

- Daily for 7 days: Inngest dashboard (all 14 firing), Stripe webhook delivery
  log, Supabase logs for RLS denials, error rates on Vercel.
- Warn-and-watch the known number shifts from the recalc (packaging up, EPR
  shared-case tonnage down) if the recalc lands close to launch.
- After the watch week: shut down Netlify, delete stale DNS records, decide
  whether alkatera-staging (Supabase + Vercel) stays as a permanent test bed
  (recommended) or is deleted.

## Standing rules while all this runs

- Weekly main-to-redesign merge minimum; same-day for customer-facing fixes.
- Staging stays deliberately NO-Inngest; production REQUIRES Inngest.
- Never touch the staging Supabase project with anything customer-derived.
- Every schema change lands as a repo migration on redesign so the launch-day
  set stays enumerable. No ad-hoc SQL on Alkatera2 between rehearsal and launch.
