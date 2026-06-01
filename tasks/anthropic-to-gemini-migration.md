# Anthropic → Gemini Migration

## Context

We are moving the AI API that powers Rosa and other LLM-backed queries on alka**tera** from Anthropic Claude to Google Gemini. The driver is sustainability: Anthropic's recent partnership with xAI (whose Colossus datacentre carries a heavy carbon and local-pollution footprint) sits at odds with our positioning, so we are switching to Gemini, which runs on Google Cloud's lower-carbon infrastructure.

## Decisions (from Tim, 2026-05-27)

| Decision | Choice |
|---|---|
| Default model for Rosa | **Gemini 3.1 Pro** (tool-calling + reasoning) |
| Default model for everything else | **Gemini 3.5 Flash** (fast/cheap) |
| Migration shape | **Full removal of Anthropic SDK** (no provider abstraction) |
| Sequencing | **Phased**: Rosa first, then assistants, then extractors |
| Public framing | **'Sustainable AI' note** visible on the Rosa hub |
| Model upgrade strategy | Models live in a single config file so future Gemini releases are a one-line bump |

## Scope (whole migration, all phases)

Total Anthropic call sites in the main repo (excluding worktrees):

**Rosa surface (Phase 1)**
- `lib/rosa/run-tool-loop.ts` — shared tool-use loop
- `lib/rosa/document-extraction.ts` — vision extraction + Anthropic content-block helpers
- `app/api/rosa/chat/route.ts` — streaming tool-loop chat (the big one)
- `app/api/rosa/priority-tiles/route.ts`
- `app/api/rosa/progress-tracker/route.ts`
- `app/api/rosa/uploads/extract/route.ts`

**Assistants (Phase 2 — lib/claude/)**
- `lib/claude/models.ts`
- `lib/claude/bill-schemas.ts`
- `lib/claude/evidence-suggester.ts`
- `lib/claude/executive-summary-assistant.ts`
- `lib/claude/impact-valuation-assistant.ts`
- `lib/claude/key-findings-assistant.ts`
- `lib/claude/lca-assistant.ts`
- `lib/claude/proxy-advisor.ts`
- `lib/claude/section-narrative-assistant.ts`
- `lib/claude/transition-risks-assistant.ts`
- Call sites: `app/api/lca/[id]/ai-suggestions`, `generate-pdf-narrative`, `app/api/pulse/anomalies/[id]/explain`, `app/api/pulse/rosa-commentary`, `app/api/reports/exec-preview`, `app/api/vitality/composite`, `app/api/cron/generate-insights`

**Extractors + Edge functions (Phase 3)**
- `lib/xero/account-suggestions-ai.ts`, `lib/xero/ai-classifier.ts`
- `lib/orchard/spray-diary-parser.ts`, `lib/arable/spray-diary-parser.ts`, `lib/viticulture/spray-diary-parser.ts`
- `lib/ingest/classify-document.ts`, `lib/extraction/supplier-product-extractor.ts`
- `lib/gaia/document-extraction.ts`, `lib/gaia/knowledge-indexing.ts`
- `lib/pulse/insights.ts`
- `app/api/utilities/import-from-pdf/route.ts`, `app/api/facilities/import-bill/route.ts`
- `supabase/functions/gaia-query`, `categorise-spend-items`, `analyze-greenwash-content`, `analyze-public-greenwash`, `generate-sustainability-report`, `generate-water-recommendations`
- `netlify/functions/ingest-auto-background.ts`, `netlify/functions/import-from-url-background.ts`
- `scripts/probe-insight.ts`

After Phase 3: remove `@anthropic-ai/sdk` from `package.json`, delete `ANTHROPIC_API_KEY` from env, delete `lib/claude/` directory (renamed during Phase 2).

---

## Phase 1: Rosa migration (this session)

### Architecture

Create a new shared module: **`lib/ai/`**.

```
lib/ai/
  models.ts        — central model IDs (GEMINI_ROSA_MODEL, GEMINI_FAST_MODEL)
                     and env-override hooks. Comment block at top explains
                     how to bump when Google releases new models.
  gemini.ts        — thin wrappers: getClient(), runToolLoop(), streamToolLoop(),
                     extractStructured(), toGeminiFunctionDeclarations(),
                     toGeminiInlineData(). All Gemini SDK contact is here.
  __tests__/       — unit tests for schema converters
```

The Anthropic tool-call protocol differs from Gemini's:

| | Anthropic | Gemini |
|---|---|---|
| Tool declaration | `{name, description, input_schema}` (JSON Schema) | `{functionDeclarations: [{name, description, parameters}]}` |
| Tool call in response | `{type: 'tool_use', id, name, input}` | `{functionCall: {name, args}}` part |
| Tool result | `{type: 'tool_result', tool_use_id, content, is_error}` | `{role: 'function', parts: [{functionResponse: {name, response}}]}` |
| Image attachment | `{type: 'image', source: {type:'base64', media_type, data}}` | `{inlineData: {mimeType, data}}` |
| PDF attachment | `{type: 'document', source: {...}}` | `{inlineData: {mimeType:'application/pdf', data}}` |
| Streaming | `client.messages.stream(...)` event stream | `streamGenerateContent` async iterator |

The `ROSA_TOOLS` schemas in `lib/rosa/tools.ts` are already JSON-Schema-shaped. Gemini's `parameters` field accepts the JSON Schema subset we use (object/string/number/boolean/array/enum/required). Verify nothing exotic is in there; if found, normalise in the converter.

### Files to change

1. **NEW** `lib/ai/models.ts`
   - Exports `GEMINI_ROSA_MODEL = 'gemini-3.1-pro'`, `GEMINI_FAST_MODEL = 'gemini-3.5-flash'`
   - Env override via `process.env.GEMINI_ROSA_MODEL` / `GEMINI_FAST_MODEL` (so we can hot-swap during incidents without redeploy)
   - Doc block: "When Google releases a new Gemini model, edit the constants here. That is the only place model IDs live."

2. **NEW** `lib/ai/gemini.ts`
   - `getGeminiClient(apiKey)` — returns `GoogleGenerativeAI` instance
   - `geminiFunctionDeclarations(rosaTools)` — converts `ROSA_TOOLS` to Gemini format
   - `geminiInlineData(attachment)` — converts `LoadedAttachment` to `{inlineData}` part
   - `runGeminiToolLoop({apiKey, model, systemPrompt, userMessage, tools, executeTool, maxRounds, maxTokens})` — non-streaming, replaces `runToolLoop`
   - `streamGeminiToolLoop(...)` — streaming variant that yields text deltas and tool events
   - `extractStructuredGemini({apiKey, model, attachment, fields, documentKind})` — replaces `extractStructured`

3. **EDIT** `lib/rosa/tools.ts`
   - Update header comment: "Gemini function declarations" (was "Anthropic tool-use definitions"). Schemas unchanged.

4. **EDIT** `lib/rosa/document-extraction.ts`
   - Remove `toAnthropicBlock` (replaced by `geminiInlineData` in `lib/ai/gemini.ts`)
   - Remove the Anthropic-based `extractStructured`; delegate to `extractStructuredGemini`
   - Update header comment

5. **EDIT** `lib/rosa/run-tool-loop.ts`
   - Delete the Anthropic SDK import + loop
   - Re-export `runGeminiToolLoop` with the same `RunToolLoopResult` shape so the public contract is preserved
   - Default model → `GEMINI_ROSA_MODEL`

6. **EDIT** `app/api/rosa/chat/route.ts`
   - Swap the `Anthropic` import and `client.messages.create` loop for `streamGeminiToolLoop`
   - API key env: `GEMINI_API_KEY` (was `ANTHROPIC_API_KEY`)
   - Update `MODEL` constant to use `GEMINI_ROSA_MODEL`
   - Update header comment + the inline doc strings
   - Convert the SSE emit calls — the public event names (`text`, `tool_use`, `tool_result`, `done`, `error`, `action_proposal`) and their payload shapes stay the same so the client (`useRosaConversation`) keeps working without changes

7. **EDIT** `app/api/rosa/priority-tiles/route.ts`
   - Read this file, swap to Gemini Flash via `lib/ai/gemini.ts`. Single-shot prompt, no tool loop.

8. **EDIT** `app/api/rosa/progress-tracker/route.ts`
   - Same pattern as priority-tiles.

9. **EDIT** `app/api/rosa/uploads/extract/route.ts`
   - Switch `ANTHROPIC_API_KEY` check → `GEMINI_API_KEY`
   - `extractStructured(anthropicKey, ...)` → call the new `extractStructuredGemini`

10. **NEW** `components/rosa/SustainableAINote.tsx`
    - Small card/badge: "Rosa now runs on Gemini 3.1 Pro on Google's lower-carbon datacentres. We moved off Anthropic because of their xAI partnership and the carbon footprint of the Colossus datacentre." (plain language, British English, no em dashes, lowercase "alka**tera**" with "tera" bold).
    - Insert into the Rosa hub via `ForYouToday` or the hub layout — a small banner above the welcome card. Dismissible with localStorage flag so it shows once or twice then quiets.

11. **EDIT** `.env.example` (if present)
    - Add `GEMINI_API_KEY=` (keep `ANTHROPIC_API_KEY=` in place until Phase 3 since other surfaces still need it)

12. **EDIT** Rosa tests
    - `lib/rosa/__tests__/` — any test that mocks `@anthropic-ai/sdk` needs to mock the Gemini client. Re-read existing tests before editing.

### Verification (Phase 1)

- Type-check: `pnpm tsc --noEmit`
- Unit tests: `pnpm test -- lib/rosa lib/ai`
- Local dev server on port 8888 (the standard alka**tera** port per memory).
- Manual: open Rosa drawer, ask "what should I do next?" — confirm `get_data_readiness` tool fires and Rosa replies coherently.
- Manual: upload a utility bill via the Rosa upload modal — confirm `extractStructured` returns the right fields.
- Manual: visit `/rosa/` — confirm the Sustainable AI note renders correctly.

### Out of scope (Phase 1)

- `lib/claude/` — phase 2
- All extractors / edge functions — phase 3
- Removing `@anthropic-ai/sdk` from `package.json` — phase 3 (still needed by un-migrated surfaces)
- Removing `ANTHROPIC_API_KEY` from environment — phase 3

---

## Risk register

| Risk | Mitigation |
|---|---|
| Gemini SDK version (`@google/generative-ai ^0.24.1`) may not support Gemini 3.1 Pro/3.5 Flash model IDs | Verify SDK release notes before coding; bump if needed. If the new `@google/genai` package is required for these models, swap the dep. |
| Gemini's function-calling is less reliable than Anthropic's for multi-round tool use | Set `tool_config.function_calling_config.mode = 'AUTO'` (default), test the multi-round flow end-to-end before declaring Phase 1 done. If degradation is real, raise `maxRounds`. |
| Gemini's JSON Schema subset rejects something in `ROSA_TOOLS` | Test schema conversion early; normalise unsupported fields in the converter. |
| SSE event shape changes break `useRosaConversation` | Keep event names and payload shapes byte-identical to today; only the underlying provider changes. |
| Different model means different style — Rosa's voice may drift | The system prompt is unchanged. If voice drifts, tighten the prompt; do not regress to Claude. |
| `extractStructured` JSON-mode reliability differs | Use Gemini's `responseMimeType: 'application/json'` and `responseSchema` where possible — strict JSON output. |

---

## Review section — Phase 1 complete (2026-05-27)

### What shipped

**New module**
- `lib/ai/models.ts` — `GEMINI_ROSA_MODEL = 'gemini-3.1-pro'`, `GEMINI_FAST_MODEL = 'gemini-3.5-flash'`, env-overridable. This is the one-line bump for future Google releases.
- `lib/ai/gemini.ts` — `getGeminiClient`, `toGeminiFunctionDeclarations` (JSON Schema → Gemini schema converter, upcases types), `toGeminiInlineData`, `runToolLoop`, `streamToolLoop`, `extractStructured` (JSON-mode forced).
- `lib/ai/__tests__/gemini.test.ts` — 4 unit tests for the schema converter and inline-data part.

**Rewired Rosa**
- `lib/rosa/run-tool-loop.ts` — delegates to `runToolLoop` from `lib/ai/gemini.ts`; public contract unchanged.
- `lib/rosa/document-extraction.ts` — `toAnthropicBlock` removed, `toGeminiPart` added, `extractStructured` delegates to Gemini Flash.
- `lib/rosa/tools.ts` — header comment updated; `toolExtractFromDocument` switched to `GEMINI_API_KEY`. Tool schemas (JSON Schema) untouched.
- `app/api/rosa/chat/route.ts` — streaming function-calling loop rewritten on `generateContentStream`. Roles mapped (assistant → model). Tool result blocks mapped (`functionResponse`). SSE event names + payload shapes preserved so `useRosaConversation` keeps working.
- `app/api/rosa/priority-tiles/route.ts` — forced function calling via `FunctionCallingMode.ANY` + `allowedFunctionNames`.
- `app/api/rosa/progress-tracker/route.ts` — same pattern as priority-tiles.
- `app/api/rosa/uploads/extract/route.ts` — env switched to `GEMINI_API_KEY`, vision call now Gemini Flash.

**Sustainable AI note**
- `components/rosa/SustainableAINote.tsx` — small dismissible emerald banner above the welcome card on /rosa/. Plain language British English, lowercase "alka**tera**" with "tera" bold, no em dashes. localStorage flag (`alkatera.rosa.sustainableAINote.dismissed`) so it doesn't nag.
- `components/rosa/ForYouToday.tsx` — banner mounted above the existing `OnboardingResumeBanner`.

**Tests**
- `lib/rosa/__tests__/document-extraction.test.ts` — `toAnthropicBlock` → `toGeminiPart` (2 tests rewritten).

### Verification
- `pnpm tsc --noEmit` — clean.
- `pnpm vitest run --exclude '**/.claude/**' lib/ai lib/rosa` — 81/82 pass. The one failure (`actions.test.ts` expecting 3 action tool names when production has 10) is pre-existing stale-test drift unrelated to the migration; spun off as its own task chip.
- Migration-touched test files: `lib/ai/__tests__/gemini.test.ts` (4/4) + `lib/rosa/__tests__/document-extraction.test.ts` (12/12) = 16/16 green.
- `next dev` on port 8888 compiled both `/` and `/rosa` cleanly (`✓ Compiled /rosa in 8.7s (4106 modules)`, returned 200).
- **Browser visual verification skipped** — the preview browser is not signed in, so the auth-gated `/rosa/` route renders the `Loading…` shell. The banner's render path is exercised by the file, but Tim should eyeball it once on the running app.

### What's NOT done (deliberate)
- `@anthropic-ai/sdk` still in `package.json` — needed by Phase 2 + 3 surfaces.
- `ANTHROPIC_API_KEY` still required by all non-Rosa AI surfaces.
- `lib/claude/` directory untouched — Phase 2.
- All extractors, edge functions, netlify background jobs — Phase 3.

### Manual checks Tim should do before declaring shipped
1. Set `GEMINI_API_KEY` in the Netlify env (and locally in `.env.local`).
2. Sign in, open `/rosa/`, confirm the emerald "Rosa now runs on more sustainable AI" banner shows above the welcome card.
3. Open the Rosa drawer, ask "what should I do next?" — confirm `get_data_readiness` fires and Rosa responds coherently with the platform voice intact.
4. Upload a utility bill via the Rosa drawer and confirm `extractStructured` returns the right fields.
5. Refresh `/rosa/` and check the priority tiles populate (should hit Gemini for curation, then cache).
6. Sanity-check the progress tracker card if you've got one set.

### Risk register — post-Phase 1 status
| Risk | Status |
|---|---|
| SDK doesn't support new model IDs | Mitigated — `@google/generative-ai 0.24.1` passes model IDs through to API; will accept whatever Google's API does. |
| Gemini multi-round function-calling reliability | NOT EXERCISED — needs live test. If Rosa loses the thread mid-tool-loop, raise `MAX_TOOL_ROUNDS` or tighten prompt. |
| JSON Schema → Gemini schema mismatch | Mitigated — converter normalises types and drops unsupported fields; ROSA_TOOLS use only the supported subset. |
| SSE event shape regression | Mitigated — event names + payload shapes byte-identical. |
| Rosa voice drift on new model | NOT EXERCISED — needs live test. |
| Gemini JSON-mode reliability for `extractStructured` | Mitigated via `responseMimeType: 'application/json'`. Live test needed. |

