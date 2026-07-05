# alka**tera** Knowledge Wiki — agent schema

This folder is a user-facing knowledge wiki following Karpathy's LLM-wiki pattern. Claude Code is the librarian: it builds and maintains the pages. The Next.js app renders them publicly at `/wiki`. Read this file before touching anything in `wiki/`.

## Layers

- `raw/` — immutable drop zone for source material (PDFs, articles, notes). Read-only for the agent: never edit or delete anything in here. `raw/README.md` is the source inventory.
- `pages/` — the wiki itself. Flat folder, one markdown file per topic, no subfolders. The `type` frontmatter field does the categorising.
- `index.md` — table of contents: one line per page, grouped by type. Regenerate after every ingest.
- `log.md` — append-only journal. One entry per operation (ingest, lint, review sweep) with date and what changed. Never rewrite history.

## Page format

```markdown
---
title: Scope 1 emissions
slug: scope-1-emissions
type: concept        # concept | standard | legislation | glossary | guide
tags: [emissions, ghg-protocol]
summary: One plain-English sentence, max ~160 chars. Used as meta description and index card.
sources:
  - title: GHG Protocol Corporate Standard
    url: https://ghgprotocol.org/corporate-standard
last_reviewed: 2026-07-05
status: published    # draft | published — only published pages are routable
---

**In short:** one or two sentences a non-expert immediately understands.

## Section headings as needed

Body text with [[wikilinks]].
```

## Conventions

- One topic per page, 300-600 words. Reference pages, not essays.
- Cross-reference with wikilinks in SLUG form only: `[[scope-3-emissions]]` or `[[scope-3-emissions|Scope 3]]`. Never link to a slug that does not exist in `pages/` (check `index.md` first). The renderer turns unresolved links into plain text, but they are lint failures.
- Sources live in frontmatter only, never as a body section. Every page cites at least one authoritative source.
- Pages of `type: legislation` must contain these sections: What it is / Who it applies to / Key dates / Current status / What this means for drinks businesses. They must state jurisdiction and carry an accurate `last_reviewed` date.
- Where relevant, every page gets a "## What this means for drinks businesses" section with concrete guidance.

## House style (hard rules)

- Audience: people in drinks businesses who are NOT sustainability experts. Plain language; explain every technical term on first use.
- British English (organisation, labelling, litre).
- NEVER use em dashes anywhere. Use commas, colons or full stops.
- Never compare emissions to trees or tree-planting equivalents.
- Never use drinks-quantity comparisons (readers ARE the drinks industry).
- Company name, when needed: alka**tera** (lowercase, "tera" bold). Wiki content is neutral and educational; avoid brand mentions in page bodies.
- Be precise about uncertainty. No greenwash. If a fact cannot be verified, omit it or keep the page as `status: draft`.

## Operations

**Ingest** (new source): read the source from `raw/` or a URL, create or update pages (one source often becomes several pages), cross-link them into the existing graph, regenerate `index.md`, append one entry to `log.md`.

**Query**: search `index.md` first, then follow links. When a query produces a useful synthesis not yet in the wiki, file it back in as a page.

**Lint** (run after every ingest): `node wiki/lint.js` from the repo root checks frontmatter, filename/slug match, unresolved wikilinks, em dashes and orphans; `node wiki/lint.js --index` also prints a regenerated `index.md`. Beyond the script, check for contradictions between pages and `type: legislation` pages whose `last_reviewed` is older than one quarter. Log the sweep.

Frontmatter gotcha: a `summary:` containing a colon must be double-quoted or the YAML does not parse.

**Legislation review** (quarterly): re-verify every `type: legislation` page against current sources (web search; laws change), update content and `last_reviewed`, log the sweep.

## Publishing

Pages ship with the app: git commit → review → push to main → deploy. Nothing user-facing goes out without a human reviewing the diff. When in doubt, `status: draft`.
