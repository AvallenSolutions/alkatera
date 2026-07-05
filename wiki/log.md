# Wiki log

Append-only journal of wiki operations. Newest at the bottom.

## 2026-07-05: Initial setup

Created the wiki system: `CLAUDE.md` schema, `raw/` source inventory, `pages/`, `index.md`, `log.md`. Seed ingest of v1 scope started: emissions cluster (12 pages), legislation cluster (10 pages), concepts and glossary cluster (17 pages).

## 2026-07-05: Seed ingest complete

39 pages ingested and published: 12 emissions and measurement, 10 legislation and compliance (all facts verified against primary sources on the day), 17 concepts and glossary. Lint clean: all wikilinks resolve, no orphans, frontmatter complete. Fixed five frontmatter summaries that contained unquoted colons. `index.md` regenerated. Front end shipped at `/wiki` (index with search, per-page rendering with sources and backlinks, sitemap entries).

Known follow-ups: quarterly legislation review due early October 2026.

## 2026-07-05: Rosa knowledge base sync built

Published pages now sync into `gaia_knowledge_base` (category `wiki`, entry types definition/guideline, wikilinks exported as absolute links) so Rosa cites wiki pages with clickable `/wiki/<slug>` sources. Admin button at `/admin/wiki` (`POST /api/admin/wiki-sync`, full replace of the wiki category per run). Run the sync after every deploy that changes wiki content.

## 2026-07-05: Connected-map front end

`/wiki` is now an interactive map (modelled on the "AI Stack, Connected" layout): five typed bands of pills, click a topic to draw its connection curves and open a detail drawer (summary, in-short text, connected topics, sources, link to the full page), search that dims non-matches, three audience tours, and a crawlable "browse as a list" section below for SEO. Map data comes from `getWikiMapData()` in `lib/wiki.ts`; per-page articles at `/wiki/[slug]` unchanged.
