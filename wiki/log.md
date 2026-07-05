# Wiki log

Append-only journal of wiki operations. Newest at the bottom.

## 2026-07-05: Initial setup

Created the wiki system: `CLAUDE.md` schema, `raw/` source inventory, `pages/`, `index.md`, `log.md`. Seed ingest of v1 scope started: emissions cluster (12 pages), legislation cluster (10 pages), concepts and glossary cluster (17 pages).

## 2026-07-05: Seed ingest complete

39 pages ingested and published: 12 emissions and measurement, 10 legislation and compliance (all facts verified against primary sources on the day), 17 concepts and glossary. Lint clean: all wikilinks resolve, no orphans, frontmatter complete. Fixed five frontmatter summaries that contained unquoted colons. `index.md` regenerated. Front end shipped at `/wiki` (index with search, per-page rendering with sources and backlinks, sitemap entries).

Known follow-ups: quarterly legislation review due early October 2026; Rosa sync (Phase 4 of `tasks/llm-wiki-plan.md`) not yet built.
