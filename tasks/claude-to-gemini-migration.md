# Claude → Gemini full platform migration

Goal: remove all `@anthropic-ai/sdk` usage; everything runs on Gemini.
~30 files, no shared Claude wrapper. Shared Gemini helpers in `lib/ai/gemini.ts`:
`runTextPrompt` (text→text), `runJsonPrompt` (text→JSON), `extractStructured`
(vision/file→JSON), `runToolLoop`/`streamToolLoop` (tool use), `runGroundedSearch`.
Token logging: `lib/ai/usage-log.ts` (`logGeminiUsage`).

Pattern for the easy ones: drop `new Anthropic()` + `getClient()`, swap
`ANTHROPIC_API_KEY`→`GEMINI_API_KEY`, replace `messages.create`+`response.content[0].text`
with `runTextPrompt`/`runJsonPrompt`, keep the existing prompt + JSON parsing/fallbacks.

## Phase 1 — Distributor scraping pipeline (text→JSON / text→text)  ✅ DONE
- [x] `lib/ai/gemini.ts` — add `runTextPrompt` + `runJsonPrompt`
- [x] `lib/distributor/scraping/extractors/llm-extractor.ts`
- [x] `lib/distributor/scraping/extractors/product-extractor.ts`
- [x] `lib/distributor/scraping/extractors/description-generator.ts`
- [x] `lib/distributor/directory/product-dedup.ts`

## Phase 2 — Report narratives + simple text→JSON (EASY)
- [x] `lib/claude/proxy-advisor.ts`
- [x] `lib/claude/transition-risks-assistant.ts`
- [x] `lib/claude/executive-summary-assistant.ts`
- [x] `lib/claude/section-narrative-assistant.ts`
- [x] `lib/claude/lca-assistant.ts` (Sonnet wizard + Opus PDF narrative → Gemini fast/pro)
- [x] `lib/claude/key-findings-assistant.ts`
- [x] `lib/claude/impact-valuation-assistant.ts`
- [x] `app/api/reports/exec-preview/route.ts`
- [x] `lib/pulse/insights.ts` (+ `app/api/pulse/anomalies/[id]/explain/route.ts`)
- [x] `lib/xero/account-suggestions-ai.ts`, `lib/xero/ai-classifier.ts`
- [x] `lib/orchard|arable|viticulture/spray-diary-parser.ts` (×3, Opus → Gemini)
- [x] `lib/admin/sourcing/deep-enrich.ts`, `product-dedup-sweep.ts`
      (+ `netlify/functions/deep-enrich-background.ts`, `directory-sourcing-background.ts`)
- [x] Retire `lib/claude/models.ts` (`CLAUDE_DEFAULT_MODEL`)

## Phase 3 — Document/vision (MEDIUM) → `extractStructured` + `toGeminiInlineData`
- [x] `lib/distributor/document-processing/llm-document-extractor.ts`
- [x] `lib/distributor/document-processing/extractors/image-extractor.ts` (vision)
- [ ] `lib/distributor/document-processing/processor.ts`
- [ ] `netlify/functions/process-document-queue.ts`
- [x] `lib/gaia/document-extraction.ts` (direct REST call → Gemini), `knowledge-indexing.ts`
- [ ] `lib/extraction/supplier-product-extractor.ts` (+ `app/api/supplier-products/smart-import/route.ts`)
      — also update `__tests__/supplier-product-extractor.test.ts` (asserts claude model)
- [ ] `app/api/utilities/import-from-pdf/route.ts`, `app/api/facilities/import-bill/route.ts`
- [ ] `netlify/functions/import-from-url-background.ts` (Claude Sonnet scrape extraction)

## Phase 4 — Tool-use / streaming (HARD) → `runToolLoop`/`streamToolLoop` + `toGeminiFunctionDeclarations`
- [ ] `lib/ingest/classify-document.ts` (8-way discriminated-union tool classifier)
- [ ] `app/api/vitality/composite/route.ts` (multi-round tool loop)
- [ ] `lib/claude/evidence-suggester.ts` (vision + tool_use)

## Phase 5 — Cleanup
- [ ] Remove `@anthropic-ai/sdk` from package.json once zero imports remain
- [ ] Remove legacy `logClaudeUsage` from `lib/ai/usage-log.ts`
- [ ] Full `tsc --noEmit` + targeted manual test per subsystem before each commit

## Notes
- Each phase commits separately and stays deployable.
- `GEMINI_API_KEY` only exists in prod env (not local) — AI paths fall back to
  no-op locally, so behaviour is only verifiable on prod.
- Watch quality: Gemini Flash vs Claude Haiku/Sonnet output can differ; spot-check
  each subsystem's output after migrating.
