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

## 2026-07-05: Rosa sync automated

The wiki now syncs into Rosa's knowledge base automatically after every successful production deploy: `netlify/functions/deploy-succeeded.ts` (Netlify event-triggered function, production context only) posts to `/api/cron/sync-wiki-to-rosa` (CRON_SECRET protected), which runs the shared sync in `lib/wiki-sync.ts`. The `/admin/wiki` button remains as a manual fallback and uses the same shared code. No clicks needed after content deploys any more.

## 2026-07-05: Moved inside the app (subscribers only)

The wiki is no longer on the public marketing site. Same `/wiki` URL, now inside the authenticated app shell: server-side session gate on both routes (redirect to `/login`), AppLayout handles tier/lifecycle (trial banner, cancelled read-only paywall, suspended redirect), available to all subscriber tiers including trial. Removed the /knowledge banner and sitemap entries, added robots disallow, added sidebar (Resources) and command palette entries. Rosa's `/wiki/<slug>` citation links unchanged and work for logged-in users.

## 2026-07-05: In-place reader popout

"Read the full page" now opens the article in a popout over the map instead of navigating away, and wikilinks inside the article swap the popout to the next article, so readers never leave `/wiki`. Each article ends with "Keep reading" chips (its connections). The standalone `/wiki/[slug]` pages remain for search engines and direct links (permalink icon in the reader header).
