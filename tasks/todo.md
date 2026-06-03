# Distributor Portal — "Scraping does nothing" fix

## Diagnosis (evidence-backed, prod)

Logged-in context: tim@alkatera.com on the **live** portal, distributor org `alkatera-admin`.

Live prod read of `scraping_jobs` + `brand_profiles`:
- **245 brand_profiles, 0 with a website.** (every single brand has `website = null`)
- scraping_jobs: **245 total, all `complete`**, 0 queued / 0 running / 0 error.
- Only **71/245** jobs succeeded on *any* source; most got 0.
- Every job log: `Brand Website: skipped (no_website_on_brand_profile)` + `B Corp Directory: skipped (bcorp_no_brand_mention)`.

### Root cause chain
1. **Website-finder produced 0 websites in prod.** It runs only at SKU-import time
   (`lib/distributor/run-sku-import.ts:160-187`), uses Gemini grounded search, and its
   failure is **silently swallowed** by `catch {}` at run-sku-import.ts:184.
   Overwhelmingly likely cause: `GEMINI_API_KEY` not set/invalid in Netlify prod
   (0/245 coverage = total failure, not partial).
2. **No websites -> scraper skips its primary source.** Brand-website is the main data
   source; with no URL it's skipped, so jobs "complete" with little/no data.
3. **The scraping UI hides itself.** The "Find data now" button only renders when a brand
   *already has a saved website* (`website-editor.tsx:148`: `canEdit && savedWebsite && !dirty`).
   0/245 have one, so the trigger is invisible on every brand — hence "there's no scraping UI".
4. **No self-heal path.** Website-finding only runs during import; the 245 existing brands
   will never retry on their own. There is **no backfill route/button** anywhere.

The cron and pipeline are HEALTHY. The blocker is upstream: no websites.

## Plan

### P0 — Confirm the key (Tim, ~2 min)
- [ ] Verify `GEMINI_API_KEY` exists and is valid in Netlify -> prod env vars.
      (This alone likely fixes new imports going forward.)

### P1 — Stop the silent failure
- [ ] Replace `catch {}` at run-sku-import.ts:184 with logging + capture the reason into
      `import_result` so a website-finding failure is visible, not hidden, ever again.

### P2 — Backfill the 245 existing brands (UI, no CLI)
- [ ] Add a portal action **"Find websites & data for all brands"** that:
      runs `findBrandWebsites` over `website IS NULL` brands -> saves -> queues scraping.
- [ ] Run it once for `alkatera-admin` to populate the existing 245.

### P3 — UX: never dead-end a no-website brand
- [ ] Change `website-editor.tsx` so a brand with no website shows a **"Find website & data"**
      action (finds the URL first, then scrapes) instead of hiding the trigger entirely.

### P4 — Discoverability (light)
- [ ] Empty-state / helper copy so the data-finding actions are findable without spelunking.

## Verify
- [ ] Re-query prod: `website` count > 0, `sources_succeeded` rising, findings populating.
- [ ] Spot-check a brand's Data tab fills in.

## Review

### ROOT CAUSE FOUND (prod run, 2026-06-03)
The instrumented `Find websites & data` button returned the true error:
`grounded_search_error: [GoogleGenerativeAI Error] ... [403 Forbidden] Lightning
dunning decision is deny for project: projects/38601711506`.

**It is a Google billing problem, NOT a code bug.** "Dunning deny" = Google Cloud is
refusing to serve the project due to overdue payment / declined card / suspended billing
account. The API key authenticates fine (403, not 401) — billing is the block.

Blast radius: the ENTIRE pipeline runs on this one Gemini project — website-finder
(grounded search) AND all scraping extractors (`llm-extractor`, `product-extractor`,
`description-generator` all call `runTextPrompt` from `@/lib/ai/gemini`). So every Gemini
call 403'd, which is why 245 jobs completed having found ~nothing. The pre-existing
`catch {}` hid all of it; the new instrumentation surfaced it.

ACTION (Tim, Google Cloud Console, project 38601711506): fix billing — settle overdue
invoice / update payment method / re-enable billing account. Then re-click the button.

Follow-up (optional): llm-extractor.ts:27 comment says "claude-haiku" but code uses
Gemini. Moving extraction to Claude Haiku would keep field/product extraction alive
through a future Gemini billing outage (website-finding would still need Gemini grounding).

### Round 2: billing fixed -> 504 on the backfill button
After Tim fixed Google billing, the button no longer 403'd but returned **504**.
Cause: a single Gemini grounded-search call reliably takes 40-60s (confirmed by the
directory-sourcing-background comment), so NO synchronous page size fits Netlify's ~26s
cap. Fix = move the work to a background function (the same pattern the SKU import uses).

Shipped (typecheck clean):
- `netlify/functions/find-websites-background.ts` — HMAC-verified, service-role, 15-min
  window. Finds websites for the org's website-less brands (or one brand), saves, queues
  forced scrape. Mirrors process-sku-import-background; relative imports for bundling.
- `app/api/distributor/brands/find-websites/route.ts` — POST now HMAC-fires the bg
  function and returns 202 (no synchronous work); added GET returning
  `{ total_brands, without_website }` for progress polling. Inline-runs the handler in dev.
- `find-websites-button.tsx` — starts the job, then polls GET and watches `without_website`
  fall; reports "N of M found"; stops on zero / plateau / 6-min cap.
- `website-editor.tsx` — single-brand "Find website & data" handles the async 202 (shows
  "looking up… auto-refreshes" instead of expecting a synchronous `found`).
- No migration needed (count-polling instead of a job table — simplest path now billing works).

### Correction to diagnosis
P0 hypothesis was WRONG: Tim confirms `GEMINI_API_KEY` is set and works across alkatera.
So the website-finder's 0/245 is NOT a missing key. The real cause is hidden because the
grounded-search + parse failures were **silently swallowed** in three places. I cannot
reproduce Gemini grounding locally (no key in `.env.local`), so the fix instruments the
failure and lets a single prod run reveal the true cause (grounded_search_error vs
model_returned_invalid_json vs genuinely-not-found).

### Shipped (typecheck clean, exit 0)
- **P1 — un-swallowed failures** (`lib/distributor/website-finder.ts`): `findBatch` now
  returns `{ websites, error?, rawSample? }`; `findBrandWebsites` returns a `WebsiteFindResult`
  (`found` map + `attempted`/`errors`/`samples`/`missingApiKey`). Import-time caller
  (`run-sku-import.ts`) logs the reason instead of `catch {}`.
- **P2 — backfill endpoint + button**:
  - `app/api/distributor/brands/find-websites/route.ts` — owner/data_manager only.
    Cursor-paged (PAGE_SIZE 16, `after_id`) so no request hits the function timeout
    (the same trap that 504'd the original synchronous import). Single-brand mode via
    `brand_profile_id`. Finds → saves website → queues forced scrape → returns
    `{ attempted, found, queued, errors, samples, missingApiKey, nextCursor, hasMore }`.
  - `components/distributor/brand-list/find-websites-button.tsx` — loops the cursor with
    live "X found / Y scanned" progress; stops on hard failure (missing key / grounded error);
    surfaces the reason. Mounted in `brands/page.tsx` header (count of website-less brands).
- **P3 — no-website UX**: `website-editor.tsx` now shows **"Find website & data"** for a
  brand with no website (was hidden entirely), calling the same endpoint single-brand.

### Not done / needs Tim
- Deploy to prod (push to main → Netlify) — the fix only does anything where the cron +
  Gemini key live.
- After deploy: click **Find websites & data** on /distributor/brands. The result text
  (and `[website-finder]` Netlify logs) reveals the real grounded-search behaviour. Then
  re-run the prod query to confirm websites + findings populate.
- Optional quick signal: does the admin Discover/sourcing feature (same grounded search)
  work in prod? If yes, grounded search is fine and the import-time 0/245 was a parse/path
  issue the instrumentation will now show.
