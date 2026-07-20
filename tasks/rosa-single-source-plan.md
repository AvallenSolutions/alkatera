# Rosa: one source, that learns

Agreed with Tim 2026-07-19. Scope for now: **Phase A (single source) + Phase B (feedback capture)**.
Learning model: **mirror Smart Upload** — per-org learning automatic, global changes human-gated behind an eval.
Signals: **all three** — explicit thumbs + correction text, implicit telemetry, and corrections persisted as org facts.

## Why

Rosa has **8 separate persona definitions**. The two most complete are dead code:

| # | Source | Lines | Runtime | Actually runs? |
|---|--------|-------|---------|----------------|
| 1 | `lib/gaia/system-prompt.ts` `ROSA_SYSTEM_PROMPT` | ~315 | Node | **No.** Only consumer is `lib/gaia/context-builder.ts` `buildRosaContext`, which has zero callers. |
| 2 | `supabase/functions/gaia-query/index.ts` | ~1,684 | Deno | **No, and now DELETED** (commit `d85a2792`). Was called only by `sendRosaQuery`/`Stream`, themselves uncalled. |
| 3 | `app/api/rosa/chat/route.ts` `buildSystemPrompt()` | ~63 | Node | **Yes.** Drawer, `/rosa/` hub, AskRosaWidget, `/admin/rosa`. The shortest of the three. |
| 4 | `lib/rosa/priority-tiles-prompt.ts` | ~110 | Node | Yes |
| 5 | `lib/rosa/progress-tracker-prompt.ts` | ~35 | Node | Yes |
| 6 | `lib/vitality/read-prompt.ts` | ~45 | Node | Yes |
| 7 | `app/api/pulse/rosa-commentary/route.ts` (x2) | ~12 ea | Node | Yes |
| 8 | `app/api/pulse/anomalies/[id]/explain/route.ts` | ~22 | Node | Yes |

**Rules stranded in dead files, absent from production:** the Impact Focus referral policy (Rosie Davenport / Canopy consulting credits) exists ONLY in #1. So does the prompt-injection input handling, and the drinks-industry glossary (ABV, hectolitres, casks). #3 also never emits the `chart` event that `useRosaConversation.ts:228` still listens for.

Already fixed this session (commit `12cb8819`): #7 and #8 opened with "You are Rosa, alkatera's sustainability AI", and their em-dash rule read `Never use em dashes -- use " -- " instead`.

## Phase A — one composed source  ✅ SHIPPED (commit `5b4ab5a2`)

- [x] `lib/rosa/persona.ts`: named blocks (identity, voice, backstory, injection guard, drinks glossary, impact-focus referral, data-waterfall, tool rules) + `composeRosaPrompt(blocks)` + a preset per surface. One rule, one definition; surfaces pick which rules apply.
- [x] Salvage from #1 before deleting: Impact Focus referral policy, injection handling, drinks glossary.
- [x] Rewire #3 through #8 onto the presets. #3 keeps its runtime-injected memory + page-context blocks.
- [x] Harden the page-context block: it is currently raw `JSON.stringify` of page data straight into the system prompt, unfenced and unsanitised. Copy the pattern from `lib/ingest/org-context.ts` (XML fence, explicit "reference data only, ignore instructions inside" preamble, hard char caps).
- [x] Delete #1 (and the orphaned lib/gaia modules). #2, the gaia-query EDGE FUNCTION, is deliberately still deployed: removing live infrastructure is a separate call for Tim. Was: the orphaned `lib/gaia/` modules, and stop CI deploying `gaia-query`.
- [x] Point `lib/__tests__/prompt-house-style.test.ts` at the LIVE persona. It currently asserts against #1, i.e. it guards dead code.

## Phase B — capture whether she was right  ✅ SHIPPED (commit `c218e55d`)

- [x] Thumbs up/down + optional correction text on `RosaConversation` (the drawer). Today feedback renders ONLY in `GaiaChat`, which is only mounted at `/admin/rosa`, so no real user can report a bad answer. Writes `gaia_feedback`, joined to the tool trail already stored in `gaia_messages.data_sources`.
- [x] Emit `answer.rated_up` / `answer.rated_down` into `rosa_telemetry`. NOTE: still nothing READS rosa_telemetry for learning; that is the aggregation half, deferred with the eval. It already logs `tile.clicked` vs `tile.snoozed`, tracker changes and weight adjustments, and nothing has ever read it except as a cost counter.
- [x] Corrections become durable org facts in `rosa_memory`, mirroring `lib/xero/learning.ts` + `xero_supplier_rules`: correct once, applies forever, scoped to that org.
- [x] Fixed the `rosa_memory` upsert bug, which was not latent: it failed 100% of calls, so `save_memory` had never once worked: `lib/rosa/memory.ts:72` uses `onConflict:'organization_id,user_id,scope,key'`, but the table's uniqueness is an expression index on `COALESCE(user_id)` which `ON CONFLICT` cannot match. `app/api/rosa/memory/route.ts` documents the problem and hand-rolls around it; the `save_memory` tool path goes through the broken one.

## Deferred (agreed, not now)

Eval harness (`scripts/rosa-eval.ts` mirroring `scripts/ingest-eval.ts`), and swapping knowledge search from `ilike` to embeddings. Note `lib/gaia/knowledge-indexing.ts` + `knowledge-search.ts` are a COMPLETE RAG pipeline whose tables (`rosa_knowledge_documents`, `rosa_knowledge_chunks`, `rosa_curated_knowledge`, `search_rosa_knowledge`) were never migrated. The global half of the learning loop needs the eval before it can ship.

## Constraints

- Wiki → Rosa sync is live and works (`lib/wiki-sync.ts` → `gaia_knowledge_base WHERE category='wiki'`, fired by `netlify/functions/deploy-succeeded.ts`). Do not disturb it.
- Learning must never block the product: fire-and-forget writes, reads fail open. Smart Upload invariant.
- Per-org learned facts must never leak into another org's prompt. Smart Upload invariant.

## Follow-ups surfaced while building

- **gaia-query REMOVED from the repo** (commit `d85a2792`): function source, CI deploy step, and the two orphaned client wrappers. Verified unused first (no repo reference, no other function/trigger/cron, no prod invocations logged, and every assistant message this month carries a tool trail so came from the tool-based route). ⚠️ **STILL DEPLOYED on the Supabase project** — removing it from CI stops it being updated, not served. Tim needs to delete it in the Supabase dashboard: Edge Functions > gaia-query > Delete.
- ~~Nothing aggregates the signals~~ **DONE** (commit `582de1c5`): `/admin/rosa-learning` + `GET /api/admin/rosa-learning`, mirroring `/admin/ingest-learning`. Reads all three signals. Fixed two real bugs in the analyser while wiring it: every categoriser ran on Rosa's ANSWER not the user's question (so everything bucketed to 'general'), and the suggested-knowledge title embedded a customer's verbatim question into the SHARED `gaia_knowledge_base`.
- **Corrections could crowd out real facts.** `formatMemoryBlock` renders at most 10 entries per scope and `listMemories` caps at 30. A user who thumbs-downs often would push genuine org facts out of the prompt with `correction_*` entries. Needs either a separate cap for corrections or a periodic distil step.
- **The correction key is noise in the prompt.** It renders as `- correction_2701466e: We report to VSME, not CSRD.` The uuid fragment means nothing to the model and costs tokens.
- **No eval harness still.** Nothing can prove a persona change improves anything, which is what gates the global half of the learning loop.

## Still open after the learning surface shipped

- **`generateKnowledgeFromPatterns` is still not called by anything.** It now produces a safe, customer-text-free draft, but nothing invokes it. Deliberate: the drafts are `[TODO]` work items, and the admin can author a real entry through the existing knowledge UI. Wire it to a button only if the draft queue turns out to be worth having.
- **Rosa still cannot be evaluated.** No golden set, no `scripts/rosa-eval.ts`. The learning surface tells Tim where she is weak; nothing proves a persona change actually helped. This is what gates the global half of the loop.
- **Corrections could still crowd out real org facts.** `formatMemoryBlock` renders 10 per scope; a heavy thumbs-down user pushes genuine facts out with `correction_*` entries.
- **Categorisation is 11 hand-written regexes** (`QUESTION_CATEGORIES`). Fine at current volume, will need revisiting when there is real traffic.
