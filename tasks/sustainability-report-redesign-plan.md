# Sustainability report: review + improvement plan
2026-07-18 · redesign branch · follows the LCA template redesign (0ef5f515)

## What exists today (surveyed)

**Pipeline (solid bones):** builder UI → `generated_reports` row → Inngest `reports/pdf.generate`
→ `buildReportData` (org, corporate_reports, PCFs, materiality, transition plans) →
`renderSustainabilityReportHtml` (2,576 LOC, 5 themes, fixed A4 pages) → PDFShift → Storage.
HTML "interactive" variant renders the same document in screenMode. Progress polled client-side.

**AI heavy lifting (already real):** Claude (sonnet-4-6) writes per-section narratives
(`section-narrative-assistant`), the executive summary (`executive-summary-assistant`) and
key findings from detected emission changes (`key-findings-assistant`), all failing gracefully.
The "framing statement" is an editorial lens fed to the AI. This is a genuine strength to build
on, not build.

**Customisation today:** name/year/period, 6 audiences, 5 themes + orientation (see defect 1),
section checkboxes with data-driven recommendations, standards list, multi-year toggle, logo,
2 brand colours, CEO foreword + up to 3 hero photos (both gated to "storytelling" audiences),
save-as-defaults on the org.

## Defects found (fix first, they're silent lies)
1. **The theme picker is a placebo.** `buildReportConfig` never passes `template`/`orientation`,
   so every generated PDF resolves to the Classic theme regardless of the user's choice
   (renderer reads `(config as any).template`; typed interface lacks the fields).
2. **`config_snapshot` doesn't exist.** Both assembly paths read `report.config_snapshot`;
   the real column is `data_snapshot`. The merge is a silent no-op.
3. **"Easy to share via link"** (ConfigureStep copy) is untrue: HTML output is an ephemeral
   blob in a new tab; there is no public share route.
4. **PPTX/SlideSpeak is half-dead:** DB default `output_format='pptx'`, sync/webhook routes
   remain, but nothing dispatches to SlideSpeak; format not selectable. Dead weight + confusion.

## The improvement programme

### Phase A — Truth and foundations (S)
- Fix defect 1: type `template`/`orientation` on ReportConfig, thread them through
  `buildReportConfig` + the HTML route. (Instantly unlocks the 5 existing themes users
  already think they're choosing.)
- Fix defect 2: read `data_snapshot`; delete the dead branch.
- Retire SlideSpeak: drop sync/webhook routes + `useReportProgress` backstop, change DB
  default to `pdf`. (Keep columns; no destructive migration.)
- Honest copy: remove "share via link" until Phase D ships it.

### Phase B — The document speaks the studio language (L, the visual centrepiece)
Rebuild `render-sustainability-report-html.ts` on the LCA template's proven idiom:
- Extract the LCA renderer's primitives into a shared `lib/pdf/studio-kit.ts`
  (band, heroBand, statCard, mono th/td tables, toneChip, meter, bullet, page shell,
  leaf mark, wordmark, footer) so both documents share one design implementation.
- **Brand accent model** (the key design decision): the studio system owns structure,
  typography (Space Grotesk / Inter / JetBrains Mono), paper/cream/hairline ground and
  working tones; the CUSTOMER's primary brand colour takes the saturated-band slot
  (cover, section bands, chart fills) with automatic ink-or-cream text contrast
  (the "ochre rule" generalised: compute luminance, dark text on light brands).
  Secondary colour becomes an accent for eyebrows/links only. This keeps every report
  unmistakably studio while carrying the customer's identity.
- Replace the 5 legacy themes with studio-native equivalents of the same intents:
  Classic→"Annual" (statement covers), Modern→"Working" (dense, quiet), Executive→"Board"
  (landscape poster pages), Data-dense→"Technical" (tables-first), Storytelling→"Editorial"
  (hero photography, full-bleed dividers). Theme registry stays in themes.ts.
- Section pages inherit the LCA patterns: numbered colour bands, hero numbers with mono
  labels, hairline tables, working-tone chips, CONT. chunking for long tables.
- Keep screenMode; restyle it as the studio web document (sticky mono nav).

### Phase C — Heavier lifting on content (M)
The AI layer exists; make it visible, editable and richer:
- **Draft-then-edit:** generate narratives BEFORE final render into a `report_narratives`
  store (or `config` jsonb); new "Review copy" step where the user reads each AI block
  (headline insight, context paragraph), edits inline, regenerates per-section with a
  tone hint, or writes their own. AI-generated flags preserved for the greenwash guardian.
- **Year in review, written for you:** extend key-findings to a proper narrative arc
  (what changed, why, what it means, what's next) using operational_change_events +
  trends + targets. Becomes the exec summary's spine.
- **Conclusions per section:** every data section ends with one AI "so what" sentence
  in the studio statement voice (full stop, no jargon, plain language rules).
- **CEO foreword assistant:** draft the leadership message from the org's data + framing
  statement for the user to edit (never auto-published unedited).
- **Tone control:** explicit tone selector (confident / measured / technical) threaded
  into every assistant prompt alongside audience.

### Phase D — Customisation that feels like a studio (M)
- **Org brand kit, stored once:** extend `organizations.report_defaults` into a proper
  brand kit (logo, colours, foreword author + photo, image library) editable from the
  report hub; every new report starts from it.
- **Imagery:** ungate photos/foreword from "storytelling audiences" (available always,
  recommended contextually); per-section imagery slots (cover, dividers, people page);
  image library persisted in Storage with a picker, not one-shot uploads.
- **Section control:** keep the checkbox catalogue but add drag-to-reorder and per-section
  data-scope choices where meaningful (e.g. products page: all products vs picked SKUs;
  trends: year range). Persist the full config on the report row (typed, not `as any`).
- **Live preview that tells the truth:** replace the mock gradient preview with a real
  render of the cover + one section via the preview route, using the studio renderer.

### Phase E — One funnel, studio-native + sharing (M)
- Collapse Quick Generate and the 4-step wizard into ONE studio flow: a single page in
  the arrival-ritual idiom (confirm-not-ask): smart defaults prefilled from data +
  brand kit, fact-list rows to adjust, the framing statement as the one open question.
  "Custom" is progressive disclosure, not a separate route. Rebuild the 19 pre-studio
  report-builder components on the studio kit (FieldLabel, Panel, FactList, StateChip,
  PillButton, MonoTabs) as part of this consolidation, not as a separate restyle pass.
- **Real share links:** `report_shares` table (token, report_id, expires_at, revoked) +
  public route `/(public)/report/[token]` serving the screenMode document; share/revoke
  from the report card. Makes the HTML format honest and genuinely useful.

## Suggested order
A (unblocks truth) → B (the visible transformation, reuses fresh LCA momentum) →
C (content depth) → E (funnel + sharing) → D (customisation polish).
A+B together make every existing report instantly better with zero new UI.

## Verification approach per phase
Fixture harness like the LCA one (scratchpad render-fixture pattern) + headless-Chromium
page-by-page inspection for B; local browser walkthrough of the funnel for C-E; scoped
vitest (lib/pdf currently 64/64 green).
