# Raw source inventory

Immutable source layer. The agent reads from here (and from the locations listed below) but never edits or deletes.

## In-repo source collections (pre-existing)

- `Knowledge Bank - Circular Economy/`
- `Knowledge Bank - Community Impact/`
- `Knowledge Bank - Customer Stewardship/`
- `Knowledge Bank - Environmental Stewardship/`
- `Knowledge Bank - Platform & Security/`
- `Knowledge Bank - Reporting & Transparency/`
- `Knowledge Bank - Supply Chain Management/`
- `sustainability-bulletins/`

## Other source locations

- Supabase `gaia_knowledge_base` table: sustainability standards and methodology entries used by Rosa (GHG Protocol, CSRD, ISO 14044/14067, UK Green Claims Code and others).

## v1 seed note (2026-07-05)

The initial 39 pages were authored from authoritative external sources (GHG Protocol, legislative texts, regulator guidance), verified by web search at the time of writing and cited in each page's frontmatter. Future ingests: drop files into this folder and run an ingest per `wiki/CLAUDE.md`.
