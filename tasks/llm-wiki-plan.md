# alka**tera** Knowledge Wiki (Karpathy LLM-wiki pattern) — Build Plan

**Goal**: a user-facing knowledge wiki inside alka**tera**. Users can look up sustainability topics (Scope 1, 2 & 3, GHG Protocol, LCA basics, legislation like CSRD/VSME, Green Claims, packaging rules) as small, plain-language, cross-linked pages. Claude Code is the librarian that builds and maintains the content following Karpathy's LLM-wiki pattern; the Next.js app is the front end (not Obsidian).

Pattern source: [Karpathy's llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The pattern maps cleanly: `raw/` (immutable sources) → `pages/` (LLM-maintained cross-linked markdown) → `CLAUDE.md` (schema/rules) → front end renders the markdown.

## What already exists in the repo (from codebase scan)

- **Raw source material**: seven `Knowledge Bank - */` folders at repo root (Word/Excel docs) plus `sustainability-bulletins/`. This is the `raw/` layer, already collected.
- **Rosa's knowledge tools**: `lib/rosa/tools.ts` has `search_knowledge_bank` and `lookup_methodology` querying the `gaia_knowledge_base` Supabase table (GHG Protocol, CSRD, ISO 14044/14067, UK Green Claims Code etc. already in there). Comment in code says "swap to embeddings later".
- **Public content infra**: `/knowledge` marketing hub + `/blog/[slug]` backed by `blog_posts` (pre-rendered HTML in Supabase). `app/sitemap.ts` and metadata patterns are in place.
- **Missing**: no markdown rendering library at all (no remark/rehype/react-markdown), no wiki routes, no wikilink handling.

## Architecture decision (recommended)

**Markdown files in the repo are the source of truth; the app renders them.**

- `wiki/` folder at repo root: `raw/` (pointers to the Knowledge Bank folders + new sources), `pages/` (the wiki itself), `index.md`, `log.md`, `CLAUDE.md` (schema).
- Claude Code ingests and maintains pages in normal sessions; every change is a git commit, reviewed before push to main, deployed with the app. No CMS, no new admin UI, no DB table for v1.
- Public route `/wiki` renders the pages. Public (not auth-gated) because the content is educational, it feeds the AI-search-visibility play (`tasks/ai-search-visibility-playbook.md`), and app users can reach it from anywhere.
- Rosa integration comes later by syncing pages into `gaia_knowledge_base` with `source_url` pointing at `/wiki/<slug>`, so Rosa cites wiki pages users can click.

Rejected alternatives: storing pages in `blog_posts` (HTML, loses the wikilink/cross-reference model and Claude-Code-as-librarian workflow); a new Supabase-backed CMS (more moving parts, no benefit at this scale).

## Decisions to confirm

- [ ] **Route**: `/wiki` (Recommended) vs folding into `/knowledge`. `/knowledge` stays the editorial hub (articles/videos); `/wiki` is the reference layer; they cross-link.
- [ ] **Access**: public with sitemap entries (Recommended) vs authenticated-only.
- [ ] **v1 topic scope**: emissions cluster (Scope 1/2/3, GHG Protocol, market vs location-based, LCA basics) + legislation cluster (CSRD, VSME, EU Green Claims Directive, UK Green Claims Code, PPWR/EPR/plastic packaging tax, deposit return schemes) + glossary terms. Roughly 40-60 pages.

## Phase 1 — Scaffold the wiki content system (the Karpathy layer)

- [ ] Create `wiki/` at repo root: `raw/`, `pages/`, `index.md`, `log.md`, `CLAUDE.md`.
- [ ] Write `wiki/CLAUDE.md` schema:
  - `raw/` is read-only for the agent; sources are never edited or deleted.
  - Page conventions: YAML frontmatter (`title`, `slug`, `type: concept|legislation|standard|glossary|guide`, `tags`, `sources`, `last_reviewed`, `status: draft|published`), one topic per page, `[[wikilinks]]` for every cross-reference, "Sources" section on every page.
  - Flat `pages/` folder (no subfolders); `type` frontmatter does the categorising. Easier for the agent to search and for the renderer to route.
  - Every ingest updates `index.md` and appends to `log.md`.
  - Operations: ingest, query, lint (orphans, contradictions, stale `last_reviewed`, missing links).
  - **House style (hard rules)**: plain language for non-experts, British English, no em dashes, no tree-based CO₂ comparisons, no self-referential drinks comparisons, company name as alka**tera**. Legislation pages must state jurisdiction, who it applies to, key dates, and cite primary sources.
- [ ] Seed `raw/` with an inventory note pointing at the `Knowledge Bank - */` folders, `sustainability-bulletins/`, and the topics already in `gaia_knowledge_base`.

## Phase 2 — Seed ingest (content before chrome)

- [ ] Ingest pass 1: emissions cluster. Scope 1, Scope 2, Scope 3 (with the 15 categories page), GHG Protocol, organisational vs product footprint, LCA basics, emission factors. Cross-link heavily.
- [ ] Ingest pass 2: legislation cluster. One page per instrument with jurisdiction/applicability/dates/status, `last_reviewed` set.
- [ ] Ingest pass 3: glossary terms and platform-adjacent concepts (B Corp, EPR, biogenic carbon, etc.), harvested from the Knowledge Bank folders and bulletins.
- [ ] After each pass: lint sweep + human editorial review of drafts before `status: published`. Accuracy matters more than volume; anything uncertain stays draft.

## Phase 3 — Front end (`/wiki` routes)

- [ ] Add markdown pipeline: `react-markdown` + `remark-gfm` + `gray-matter` (or unified/remark stack), with a small wikilink transform: `[[Some Page]]` → link to `/wiki/some-page`; unresolved links render as plain text, never broken links.
- [ ] Routes (public group, follows existing `/knowledge` metadata patterns):
  - `/wiki` — index: search box + pages grouped by `type`, driven by frontmatter (skip drafts).
  - `/wiki/[slug]` — page renderer: content, sources section, `last_reviewed` badge, and a **backlinks panel** ("Referenced by") computed from the link graph at build time.
- [ ] Only `status: published` pages are routable; drafts 404.
- [ ] Search: lightweight client-side index (title + tags + summary) for v1; no embeddings.
- [ ] SEO: per-page metadata, canonical URLs, add wiki pages to `app/sitemap.ts`.
- [ ] Netlify check: ensure the markdown files are included in the deploy (static import at build time via generateStaticParams, so no function-bundle tracing issues).
- [ ] Link into the product: entry point from the app (help/learn link) and from `/knowledge`.

## Phase 4 — Rosa integration

- [ ] Sync script (or Inngest job if it grows): upsert published wiki pages into `gaia_knowledge_base` with `source_url = /wiki/<slug>`, so `search_knowledge_bank` and `lookup_methodology` surface wiki pages and Rosa's citations become clickable in-product links.
- [ ] Later (already flagged in code): embeddings via `lib/gaia/knowledge-search.ts` once page count justifies it.

## Phase 5 — Ongoing operations

- [ ] Ingest habit: drop a new source (PDF/URL/doc) into `wiki/raw/`, run one Claude Code ingest prompt, review the diff, push.
- [ ] Monthly lint sweep prompt: orphaned pages, missing cross-links, contradictions.
- [ ] Legislation review cadence: quarterly sweep of all `type: legislation` pages, update `last_reviewed`, flag changes. (Could later be a scheduled agent; manual for now.)

## Verification (Phase 3 done = )

- [ ] `/wiki` and several `/wiki/[slug]` pages render locally on port 8888 with working wikilinks and backlinks.
- [ ] Draft pages are not routable or in the sitemap.
- [ ] Lighthouse/metadata spot-check on two pages; sitemap includes wiki URLs.
- [ ] A user journey works end to end: land on `/wiki`, search "Scope 3", read the page, click through to "GHG Protocol", follow a backlink out.

## Review (2026-07-05)

Phases 1-3 built and verified locally in one session; Phases 4-5 outstanding.

- **Content**: 39 pages, all published (12 emissions, 10 legislation, 17 concepts/glossary). Written by three parallel agents; all time-sensitive legislation facts (CSRD Omnibus, PPWR dates, pEPR fees, PPT rate, DRS timing, EmpCo application) verified against primary sources on the day. Lower-confidence facts phrased defensively (noted in agents' reports, e.g. SECR threshold flow-through).
- **System**: `wiki/` scaffold per the Karpathy pattern (CLAUDE.md schema, raw/ inventory, pages/, index.md, log.md) plus an in-repo lint tool `wiki/lint.js` (also regenerates the index with `--index`). Lint is clean: every wikilink resolves, no orphans, no em dashes.
- **Front end**: `lib/wiki.ts` + `/wiki` (search, grouped index) + `/wiki/[slug]` (rendered markdown with resolved wikilinks, sources, last-reviewed badge, backlinks panel). Static generation at build; unknown slugs 404; drafts unroutable. Sitemap carries 40 wiki URLs; `outputFileTracingIncludes` added so the runtime sitemap function can read the files on Netlify. Cross-link added on /knowledge. New deps: marked, gray-matter.
- **Verified in browser** (port 8888): index, article pages, search, legislation section structure, 404s, sitemap, no console errors.
- **Fix during build**: five frontmatter summaries had unquoted colons that broke YAML parsing; quoted, and the gotcha is now documented in wiki/CLAUDE.md.
- **Phase 4 (same day)**: Rosa sync built. `/admin/wiki` admin page with a sync button; `POST /api/admin/wiki-sync` replaces the `wiki` category in `gaia_knowledge_base` with the deploy's published pages (definition/guideline entry types, absolute links, aborts rather than wiping if the pages folder reads empty). Verified against local Supabase with Rosa's verbatim search query. Run the sync after each deploy that changes wiki content.
- **Not done yet**: quarterly legislation review (due early October 2026); nav placement beyond the /knowledge cross-link; embeddings-based knowledge search (already flagged in Rosa's code).
