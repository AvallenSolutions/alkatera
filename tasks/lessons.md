# Lessons Learned

## NEVER claim "typecheck clean" without seeing EXIT 0; beware stale tsbuildinfo (2026-05-31)

**What went wrong:** Committed a #7 change with the message "typecheck clean" when
the last `pnpm typecheck` I'd run had returned EXIT 2. I'd let the dev-server
returning 200 stand in for type-safety — but Next dev uses SWC, not tsc, so 200s
say NOTHING about types. The Netlify build runs tsc (no `ignoreBuildErrors`), so
that could have broken the deploy.

**Two compounding lessons:**
1. A commit message may only say "typecheck clean" if I have **literally just seen
   that typecheck exit 0**. Dev-server / page 200s are not a substitute.
2. `tsconfig.tsbuildinfo` (`incremental: true`) can emit **phantom errors** against
   a pre-edit version of a file. When a tsc error makes no sense given the on-disk
   code, `rm -f tsconfig.tsbuildinfo` and re-run `npx tsc --noEmit` before believing
   it. (An "implicit any" error persisted after the fix was on disk; clearing the
   buildinfo showed EXIT 0.)

## TanStack Query: always pass the explicit `useQuery<T>` generic (2026-05-31)

Without `useQuery<ResultType>({...})`, `data` widens and consumers of the hook get
implicit-`any` errors (e.g. `.map(p => …)` → "Parameter 'p' implicitly has any").
Always write the generic; baked into the migration recipe in
`hooks/data/useProductSpotlight.ts`.

## Don't rush auth-critical / correctness-critical work to "finish the list" (2026-05-30)

When asked to "do the rest", resist half-shipping changes that (a) gate login,
(b) affect reported numbers, or (c) are genuine multi-session migrations. The local
env points at prod and there's no live session, so these can't be fully verified
here. Scope them precisely as follow-ups instead. For #5 (bootstrap RPC) and #8
(emissions N+1) the safe pattern was: additive + full fallback / frozen-oracle
equivalence, never a blind rewrite.

## Multi-line shell variables break `sed -i` loops (2026-05-30)

`for f in $(grep -rl ...)` feeding `sed -i ''` mangles when the substitution
returns multiple newline-joined paths (sed treats the blob as one filename). For
multi-file edits, prefer the Edit tool per file (reviewable, atomic), or
`grep -rl ... | while IFS= read -r f; do sed ...; done`. Always `git diff` after a
bulk sed to confirm what actually changed.

## Read the real file immediately before editing (2026-05-30)

Don't author an Edit `old_string` from a research/Plan agent's "mechanics report" —
those describe idealised code and frequently differ from reality (variable names,
helper signatures). Failed edits are safe, but a partial match can leave a file
half-edited. Read first, edit second.

## Additive column migrations must run BEFORE the code that writes them (2026-05-30)

When code starts writing a new column (e.g. `upsertSnapshot` writing
`composite_json`), an upsert with an unknown column fails the WHOLE row write, not
just the new field. Run additive, nullable migrations first (safe — nothing reads
them yet), and end every column-adding migration with `NOTIFY pgrst, 'reload
schema';` (see PostgREST cache lesson below).

## Supabase PostgREST Schema Cache (2026-04-06)

**Problem:** After adding new columns via migration, Supabase queries silently
return `null` for the new columns and writes to them are silently dropped. No
errors thrown.

**Root cause:** PostgREST caches the DB schema; it doesn't know about new
columns/tables until the cache is reloaded.

**Pattern:** All migrations that add columns/tables MUST end with
`NOTIFY pgrst, 'reload schema';` (run it manually in the SQL editor if a migration
already shipped without it).

## Type Definitions Must Match Database Schema (2026-04-06)

When adding DB columns, update the corresponding TypeScript interface in
`lib/types/` so the whole data flow (API route → component → form → save) stays
type-safe without `as any` casts.

## API Route POST Handlers Use Explicit Field Lists (2026-04-06)

POST handlers for vineyard/orchard growing profiles use explicit field lists in
`.insert()`, so new columns are silently dropped on insert (PATCH is fine — it
spreads `...updateFields`). When adding columns, update the explicit field list in
`app/api/vineyards/[id]/growing-profile/route.ts` and
`app/api/orchards/[id]/growing-profile/route.ts`.

---

## Netlify function "Cannot find module X" under pnpm — fix at the source, don't externalise (2026-06-05)
Symptom: a Netlify background/function crashes at init with
`Runtime.ImportModuleError: Cannot find module '<dep>/<subpath>'`
(saw it as `nanoid/non-secure` in `scrape-brand-background`).

Root cause: a *transitive* CJS dep does a nested `require('<dep>/...')`. Netlify's
zip-it-and-ship-it (esbuild) bundler externalises that nested require, then can't copy
the package through pnpm's symlinked `node_modules` → unresolved at runtime.

What does NOT work: `external_node_modules=["<dep>"]` in netlify.toml, NOR removing it.
Local `npx esbuild --bundle` inlines the dep fine, so it looks fixed locally but still
crashes on Netlify — the two bundlers behave differently. Don't trust a local esbuild
bundle as proof; ZISI is the source of truth.

How to find the real importer FAST:
`npx esbuild <fn>.ts --bundle --platform=node --metafile=/tmp/m.json --outfile=/tmp/b.js`
then walk `inputs[*].imports` for the bad path, and walk *up* to the source file that
pulls in the offending package.

The fix that worked: remove the heavy dep from the function's import graph at the source.
Here `extractors/html-to-text.ts` imported `sanitize-html` (→ postcss → nanoid) just to
strip HTML to text — replaced with a dependency-free regex pass. Kept sanitize-html
installed for the legit consumer (`app/blog/[slug]/page.tsx`). Lesson: a server-side
text-extraction path should never pull a CSS parser; prefer the lightest dep that does
the job, especially in code that gets bundled into a standalone Netlify function.

---

## Scraper crawler must send a browser User-Agent, not a self-identifying bot UA (2026-06-05)
`lib/distributor/scraping/http.ts` (`fetchPage`) originally sent
`alkatera-distributor-bot/1.0 (+...)` "to be polite". CDN/WAF layers in front of brand
sites (Azion, Cloudflare, Akamai) 403 any non-browser UA outright. Because the brand
homepage fetch is MANDATORY (a 403 there returns `{ok:false}` early), the whole brand
scrape fails with `sources_succeeded=0 → job 'error'` and ZERO extraction — the only AI
call you'll see in the log is the score recalc's `category-detect`. Symptom is
indistinguishable from "brand has no website" unless you check the job `error_message`
(it'll say `Brand Website: HTTP 403`).

Diagnosis trick: reproduce `fetchPage` with the bot UA vs a browser UA against the
brand's real site — `403 (bot) / 200 (browser)` confirms it instantly. Fix: use a
standard Chrome UA string. Don't reintroduce a bot UA for "politeness"; it silently
fails real-world WAF-protected sites.

---

## Derive brand category from data you already hold, not just an LLM (2026-06-06)
Brand "Category" was blank catalogue-wide because the only populator was a flaky LLM call
(`detectBrandCategory`) that silently returns null with no GEMINI_API_KEY, no scraped
description, or an unrecognised answer. Meanwhile the category was sitting in plain text in
the brand name + SKU product names ("Arcane Rhum", "X Single Malt", "Colombo 7 London Dry
Gin"). Fix: `inferCategoryFromText()` in `lib/industry-benchmarks.ts` — ordered,
word-boundary keyword rules mapping brand+SKU text to the known category set. Deterministic,
no I/O, runs in `recalculate.ts` `resolveCategory` ahead of the LLM, so a plain "Rescore
all" backfills the catalogue from existing data (2 -> 61 of 68). Lessons:
- When a field is null everywhere, check the DISPLAY first: list views read different
  columns than the detail page (brand list read `brand_profiles.category`, detail read
  `brand_directory.category`; neither used the scraped fallback). Mirror canonical values
  onto `brand_directory` and coalesce listing -> directory -> scraped in the views.
- Don't let an auto-derived value masquerade as human-declared. `resolveCategory` trusted
  any existing `brand_directory.category` as 'declared', so a 2nd recalc froze inferred
  categories and they could never be re-derived. Gate on `category_source === 'declared'`.
- Admin "rescore everything" endpoints must batch (client-driven offset/limit + retry).
  Recalc-all-in-one-request 504'd past Netlify's ~26s ceiling and returned an HTML page,
  surfacing as "Unexpected token '<' ... is not valid JSON" in the button. maxDuration=60
  is a Vercel hint the Netlify Next plugin ignores.
