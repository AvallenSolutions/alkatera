# The evidence: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891/:8895).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
Fifth room deep-pass, after Today, the workbench, the cellar and the network. Covers EVERY
page and EVERY internal tab from the start (the workbench lesson).

STATUS: DECISIONS SETTLED (10 July 2026). Building.

Decisions as settled by Tim:
1. Kill the phantom front door — YES (/reports/ → redirect to /reports/sustainability/).
2. Retire /operations/ — YES (redirect to /company/facilities/).
3. Five flat tabs — YES (Reports / Certifications / Guardian / Targets / Library).
4. Landing poster — THE PROOF (report + certification counts).
5. CCF vs workbench — KEEP BOTH, delineated (cross-links each way).
6. Certifications monolith — QUIET IN PLACE. Note from Tim: "only B Corp and EcoVadis
   are important at the moment" → prioritise the cluster components rendered by
   BcorpExperience + CertificationExperience (EcoVadis); csrd/gri/sbti legacy tabs
   get only light quieting; framework migration stays a named follow-up.
7. Orphan deletions — YES (AuditPackageBuilder + the five dead components/reports/ files).

## What the evidence is

What you can prove. Brick band (rgb 191 75 42, mark: quarter, cream on colour, no
special text rule). Nineteen pages behind the band, plus one straggler:

| Surface | Route | Lines | State |
|---|---|---|---|
| Reports front door | /reports/ | 130 | PHANTOM: three always-empty tabs, fetches nothing |
| Sustainability hub | /reports/sustainability/ | 894 | The REAL hub; 3 URL-synced tabs; mostly studio |
| Materiality (stub) | /reports/materiality/ | 5 | redirect → sustainability?tab=materiality |
| Transition plan (stub) | /reports/transition-plan/ | 5 | redirect → sustainability?tab=transition-plan |
| Materiality setup | /reports/materiality/setup/ | 437 | 3-step wizard; hand-rolled eyebrow; near-studio |
| Transition plan setup | /reports/transition-plan/setup/ | 405 | WORST palette page: stone-* scale, #BF4B2A, text-white |
| Footprint hub | /reports/company-footprint/ | 421 | NO eyebrow; heavy emerald/red/orange/blue/slate; not in band |
| Footprint builder | /reports/company-footprint/[year]/ | 736 | Clean shell; sole consumer of ~18 scope-3 cards |
| Report builder | /reports/builder/ | 334 | Studio; not in band |
| Historical | /reports/historical/ | 224 | Studio; clean |
| Certifications hub | /certifications/ | 310 | Studio-clean; single-tab Tabs scaffold; filter Card |
| Certification detail | /certifications/[code]/ | 1,107 | Three divergent experiences on one route (see audit) |
| Guardian | /greenwash-guardian/ | 546 | Studio tones; emoji medallions; dashed dropzone |
| Guardian check | /greenwash-guardian/[id]/ | 477 | Working tones done; NO eyebrow |
| Guardian history | /greenwash-guardian/history/ | 470 | Studio; clean |
| Guardian bulk | /greenwash-guardian/bulk/[id]/ | 366 | NO eyebrow; client-side batch loop |
| Evidence library | /evidence-library/ | 5 (+289) | The room's exemplar (correct Statement) |
| Evidence document | /evidence-library/[id]/ | 5 (+493) | NO eyebrow; wrong heading font (font-heading) |
| Targets | /pulse/targets/ | 266 (+1,197) | STALE eyebrow "PULSE · TARGETS"; room-hop back-link |
| (straggler) Operations | /operations/ | 209 | LEGACY duplicate of /company/facilities; one inbound link |

Registry today: tabs Reports / Targets / Certifications / Guardian, with Library,
Materiality, Transition plan and Historical in "More…". No landing.

## The noise audit

### The front door (/reports/) is a phantom
Three internal tabs (Corporate / Products / Supply Chain), each rendering ONLY a
hardcoded empty state. It fetches no data, never lists the reports that exist, and
its CTAs point at /operations (a legacy duplicate facilities page), /products, and
a stale "Manage Suppliers" → /settings. The band's Reports tab lands here: users
arrive at a dead room while the real hub sits one path down at
/reports/sustainability. The single biggest structural item in the room.

### Sustainability hub (/reports/sustainability/) — the real hub
- Good bones: URL-synced tabs (?tab=reports|materiality|transition-plan), StateChips,
  PageLoader, no spinners. The materiality/transition-plan tabs are SUMMARY views;
  the editing lives in the two setup wizards.
- Noise: hand-rolled mono eyebrow instead of the Eyebrow component; Badge pills on
  tabs and cards; tab icons; a dashed empty card; CATEGORY_COLOURS/SCOPE_COLOURS
  inline-style colour coding; the failed-reports collapsible is loud.
- Generation: Quick Generate dialog + /reports/builder link + investor-summary and
  regulatory-index blob downloads. Dispatch is Inngest via /api/reports/[id]/
  generate-pdf (PDFShift); PPTX (SlideSpeak) is entirely server/admin-side. See
  protections: none of this changes.

### Setup wizards
- Materiality setup: near-studio (brick step dots, hand-rolled eyebrow, one inline
  #2B46C0). Writes materiality_assessments via upsert onConflict.
- Transition-plan setup: the family's worst off-palette page. Raw stone-900/700/500/
  400/300/200 text and borders, bg-stone-900 buttons, accent-[#BF4B2A] checkbox,
  text-white. Goes through /api/transition-plan (POST/PATCH, AI risk generation).
- Both wizards finish by routing to the OLD redirect stubs (an extra hop).

### Company footprint (CCF)
- Hub (/reports/company-footprint/): NO eyebrow (plain slate-900 h1) and the room's
  heaviest palette leak: emerald/red trend cards, orange/blue/emerald scope bars,
  green-100 badges, slate medallions, an emerald Leaf hero on dashed empty. Not in
  the band; reachable only from dashboard widgets.
- Builder ([year]): clean studio shell (correct eyebrow, StateChips, accordion). It
  is the ONLY consumer of ~18 components/reports/ scope-3 category cards (their
  internals need the palette sweep). Finalise POSTs a Supabase edge fn
  (generate-ccf-report), a third generation path: untouched.
- DUPLICATION flag: CCF presents the same scope 1/2/3 inventory as the workbench's
  /data/scope-1-2 (already converted), from the same calc functions but different
  components. Different jobs though: the workbench page is the live data view; CCF
  is the annual REPORT artefact you assemble and finalise. Delineate, not delete
  (decision 5).

### Certifications
- Hub: studio-clean already. Noise is structural: a single-tab Tabs scaffold (one
  trigger!), a filter Card (search + two Selects), hand-rolled skeleton blocks.
  Whole hub behind FeatureGate bcorp_tracking.
- Detail (/certifications/[code]/, 1,107 lines): a three-way branch —
  1. bcorp_2026 → BcorpExperience (957 lines, STUDIO-GRADE, 4 tabs, do not rebuild)
  2. iso14001/iso50001/ecovadis → CertificationExperience (339, studio, 3 tabs)
  3. everything else (csrd/gri/sbti/…) → the legacy monolith body: 4-6 LOCAL tabs
     (not URL-synced), Badge-pill counts, five hand-rolled "Loading" labels,
     duplicated status→tone ladders, giant inline tab bodies.
- The off-palette debt is NOT in the pages but in a component cluster the detail
  renders: GapAnalysisDashboard (16 raw colours), EvidenceLinker (12),
  ReadinessBanner (10), YearProgressionStepper (8), RecertDeltaCard (7),
  PlatformHealthPanel (6), RecertBanner (5), StandardsBanner (4),
  JourneySelectionDialog (4), AuditTimeline (3), RoadmapCard (3, hardcoded
  emerald/amber pills), UpcomingRequirements (3), EcgtBanner (2), MomentumCard (1),
  RiskToolWizard (1).
- PROTECTED: the 11 B Corp navigability features in GapAnalysisView (status filter,
  year-band filter, blocking-jump, deep-open, section ZIP export, peer benchmark,
  assigned actions, stale-evidence chips, risk-tool gate, Draft-with-Rosa,
  AutoEvidencePanel). GapAnalysisView itself is studio-clean; leave its logic alone.
- ORPHAN: AuditPackageBuilder.tsx (432 lines, zero importers).
- CertificationHealthWidget is imported only by Rosa's ForYouToday (cross-room).

### Guardian (four pages)
- Already on working tones (low=good / medium=attention / high=stale everywhere);
  the M3 sweep reached it. Residue: missing eyebrows on [id] and bulk/[id]; 🇬🇧/🇪🇺
  emoji medallions on the legislation cards; a border-2 dashed upload zone; a
  static RefreshCw icon; three inline-defined components (ClaimCard, RiskIndicator,
  TrendVisualization); lib/greenwash's getRiskLevelColor still returns raw
  red/amber/green strings that get remapped at every call site; triggerAnalysis
  writes status:'error' which is not in the AssessmentStatus union ('failed').
- Tier ladder: URL + bulk free at seed; documents/text/social behind
  greenwash_documents (blossom); greenwash_unlimited (canopy). Locked tabs show
  Lock icons + upsell copy. Keep gating exactly.
- ORPHAN: zero in-app deep links (band tab only). No desk, Rosa or reports link
  reaches it. The landing must give it a row; consider one cross-link from reports.
- The bulk runner processes URLs sequentially in the browser with 1s delays: an
  Inngest candidate, NOTED ONLY, not this pass.

### Evidence library
- EvidenceGrid is the room's exemplar (correct Statement, StateChips, mono loading).
- EvidenceDetailPanel: no eyebrow, h1 uses font-heading (off-system), an
  optimistic-update hack in handleReject with a confused comment block (flag, tidy
  comment only). LLM suggest-requirements + link/unlink/reject routes: keep.
- ORPHAN: reachable only via the band's More…. The certifications EvidenceLinker
  shares the requirement-link domain but never links back to /evidence-library
  (one-way coupling): give it a quiet cross-link.

### Targets
- The room-identity tension: authored as a Pulse surface (13 inbound links, all
  from Today/Rosa), banded to the evidence. Eyebrow reads "PULSE · TARGETS" (stale)
  and the only back-link hops rooms ("← Back to Pulse" → /pulse).
- Components mostly studio (trajectory pills, status tones). Residue:
  InitiativeDialog carries the room's only real off-palette banner
  (amber-500/30 + amber-600) AND its only Loader2 spinner; TargetCard and
  InitiativeBoard use shadcn Badge pills; two dashed empty states; the
  INITIATIVE_STATUSES raw colour names are remapped at render (retire at source).
- transition-plan's TargetSetter is a SECOND target-setting UI with its own schema
  (ReductionTarget JSON vs the sustainability_targets table) plus its own noise
  (text-red-400, two border-dashed). Restyle this pass; unification is a named
  follow-up, not this pass.

### The straggler: /operations/
A 209-line legacy duplicate of /company/facilities (old Card/Badge design), linked
ONLY from the phantom front door. Same shape as /suppliers/new last pass: retire
(decision 2).

### Cross-room wiring notes
- The lcas page correctly wears THE CELLAR · LCAS (it is a cellar tab): untouched.
- Band "More…" still lists Materiality and Transition plan, which are now redirect
  stubs: dead weight in the registry.
- company-footprint and builder are in NO navigation at all (dashboard widgets
  only): the landing fixes discoverability.
- Rosa prompt files and RecentlyFromRosa link the old /reports/transition-plan and
  /reports/materiality routes: repoint to ?tab= URLs to skip the hop.

## The design moves

### 1. The landing: /evidence/ (the room-landing pattern, brick)
1. Statement: "The evidence." with note "What you can prove."
2. The one brick poster (quarter mark): THE PROOF: report + certification counts
   ("3 REPORTS · 2 CERTIFICATIONS"), linking to the reports hub (decision 4).
3. Fact rows with live counts via new /api/evidence/counts (clone the network
   counts route): The reports (N generated), The footprint (latest year + status
   chip), Certifications (N active, readiness/attention chip), Targets (N active),
   The guardian (N checks, last risk StateChip), The library (N documents),
   Historical (quiet row). This is where CCF, builder and historical become
   discoverable, and where the two orphans (guardian, library) get real doors.
4. Registry: landing '/evidence/', desk poster href flips to it, band room name
   links to it. Tabs become FIVE flat: Reports / Certifications / Guardian /
   Targets / Library; "More…" dies (Materiality + Transition plan links die with
   the stubs; Historical lives on the landing + reports hub; the network/cellar
   precedent).
5. Counts tables (verified): generated_reports, corporate_reports,
   organization_certifications, sustainability_targets, greenwash_assessments,
   evidence_documents. All org-scoped head counts; resolveAccessibleOrg, same
   shape as /api/network/counts.

### 2. Kill the phantom front door (decision 1)
/reports/page.tsx becomes a redirect to /reports/sustainability/ (URL-stable: old
links keep working, nothing is lost; its VerificationCard already renders on the
hub). The band's Reports tab points DIRECTLY at /reports/sustainability/ (no hop).
The /operations straggler retires with it (decision 2): redirect to
/company/facilities/.

### 3. Sustainability hub polish (the real hub stays where it is)
1. Hand-rolled eyebrow → the Eyebrow component (THE EVIDENCE · REPORTS); tab icons
   die; tab Badge counts → quiet mono counts; the three tabs stay URL-synced
   (already the correct pattern).
2. Report cards recut quiet (FactList rows or hairline cards): title bold, format +
   date as mono meta, Download/Investor/Regulatory as quiet actions; failed section
   one stale-tone line + retry, not a loud collapsible; dashed empty → one dim line
   + one pill (Quick Generate).
3. Materiality/transition-plan summary tabs: CATEGORY_COLOURS/SCOPE_COLOURS colour
   coding → mono labels + one room-accent bar treatment (colour only where it
   means something); count cards → BigNumbers; Continue/Edit as quiet pills.
4. Repoint on-finish routes in both setup wizards and the Rosa prompt references to
   the ?tab= URLs; delete the two redirect stubs at go-live only (keep this pass:
   they cost nothing and external links may exist).

### 4. Setup wizards
1. Transition-plan setup: full stone-* purge (text/border/bg → studio tokens),
   accent-[#BF4B2A] → accent-room, text-white → text-studio-cream on ink; Sparkles
   panel quiet; keep /api/transition-plan calls + AI risk generation intact.
2. Materiality setup: Eyebrow component; the inline #2B46C0 financial slider colour
   → room token; keep upsert + TopicCard/MaterialityMatrix/PriorityConfirmation
   (restyle only if off-palette inside).
3. Both step indicators become one shared quiet stepper treatment (they are
   near-identical already).

### 5. Company footprint: one artefact, delineated from the workbench
1. Hub: Statement (THE EVIDENCE · COMPANY FOOTPRINT, "The annual footprint."),
   full palette purge (emerald/red trend card → good/stale tones; orange/blue/
   emerald scope bars → one quiet stacked bar in studio tones or mono figures;
   green badges → StateChips; slate → studio); dashed empty → dim line + pill;
   the Collapsible explainer quiet.
2. Builder [year]: shell already studio. The ~18 category cards get ONE
   substitution sweep (chrome only: headers, badges, buttons, empty states), same
   table as previous passes; behaviour (corporate_overheads entries, scope-3 hook,
   not-applicable PATCH, finalise edge fn) untouched.
3. Delineation, not deletion (decision 5): the workbench /data/scope-1-2 is the
   live inventory; CCF is the annual report you assemble and finalise. One quiet
   cross-link each way ("See the live data" / "Build the annual report").

### 6. Certifications: quiet the monolith, convert the cluster
1. Hub: collapse the single-tab Tabs scaffold; the filter Card → quiet inline row
   (search input + two mono text-link filter groups, the suppliers-sheet
   precedent); hand-rolled skeletons → the house PageLoader/skeleton.
2. The old-design component cluster (15 components, listed in the audit) converts
   in place with the standard substitution table; GapAnalysisDashboard and
   EvidenceLinker first (hot path). The duplicated status→tone ladders dedupe into
   one lib/certifications/status-tones.ts helper.
3. The legacy monolith path (csrd/gri/sbti/…): quiet IN PLACE this pass
   (decision 6): tabs become URL-synced quiet mono tabs (?tab=), Badge counts →
   mono, the five hand-rolled Loading labels → one pattern, inline tab bodies
   extracted to components/certifications/ modules. Migrating these frameworks
   onto CertificationExperience is a NAMED FOLLOW-UP (it needs audit-packages +
   requirements tabs added to that experience first: feature work, not design).
4. BcorpExperience and CertificationExperience: no rebuild. Only: local tab state
   → URL-synced (?tab=) for consistency and deep-linking, preserving the
   blockingSignal/focusRequirement jump mechanics exactly.
5. Delete the orphan AuditPackageBuilder.tsx (decision 7).

### 7. Guardian: four quiet pages, two new doors
1. [id] and bulk/[id] gain statements (THE EVIDENCE · GUARDIAN eyebrow; the check
   title as headline; risk BigNumber standing right on [id]).
2. Emoji medallions die (🇬🇧/🇪🇺 → mono UK/EU eyebrows); dashed dropzone → the quiet
   studio dropzone treatment; static RefreshCw → quiet text action.
3. Extract ClaimCard, RiskIndicator, TrendVisualization to components/greenwash/;
   retire getRiskLevelColor (map risk → tone in one exported helper); fix the
   status:'error' → 'failed' union bug (one-line, safe).
4. Doors: the landing row (N checks + last risk chip) plus one quiet cross-link
   from the reports hub ("Check a claim before you publish"). Keep the tier ladder
   and Lock states exactly.

### 8. Library: finish the exemplar
1. EvidenceDetailPanel: Statement (THE EVIDENCE · LIBRARY eyebrow, document title
   headline), font-heading → font-display, suggestion/link groups under mono
   eyebrows. Keep signed URLs, suggest/link/reject routes, bulk-accept.
2. EvidenceLinker (certifications) gains a quiet "Open the library" link
   (fixes the one-way coupling).
3. The handleReject comment block tidied (comment only, logic untouched).

### 9. Targets: the evidence identity settled
1. Eyebrow → THE EVIDENCE · TARGETS; headline stays "Targets & actions."
2. The "← Back to Pulse" back-link dies (the band owns navigation; Pulse links IN
   remain untouched: thirteen of them).
3. InitiativeDialog: amber banner → attention tone; Loader2 → busy text (the
   room's last spinner). TargetCard + InitiativeBoard Badge pills → StateChips;
   dashed empties → dim lines; INITIATIVE_STATUSES colour names retired at source
   (statuses carry tones, not colour words).
4. TargetSetter (transition-plan): text-red-400 → stale tone, dashed → quiet. The
   two-schema target duplication is FLAGGED as follow-up, not unified now.

### 10. Room hygiene + sweep
- Every eyebrow reads THE EVIDENCE · X (adding: guardian [id] + bulk, evidence
  document, CCF hub, targets; the lcas page keeps THE CELLAR).
- Orphan deletions (decision 7): AuditPackageBuilder, CCFSankeyDashboard,
  GapFillWizardModal, XeroBaselineCard, ImpactValuationMethodology,
  ImpactValuationTrends (all grep-verified zero importers; re-verify before rm).
- Misfiled note: SpendImportCard + XeroEnergyBaselineAlert live in
  components/reports/ but render on the workbench emissions page; move to
  components/emissions/ (import-path change only).
- New /api/evidence/counts.
- Sweep: mobile 375/768/1024/1440, consoles clean, full tsc, greps (stone-,
  emerald-, amber-, slate-, lime, ccff00, Badge pills, Loader2, em dashes,
  stale PULSE eyebrows), review log, memory update.

## Protections (restated for the build agents)

- The GENERATION STACK is behavioural and untouched: /api/reports/[id]/generate-pdf
  (dispatch-only → Inngest reportPdfGenerate → PDFShift), generate-html,
  investor-summary, regulatory-index, iso14064-worksheet, the SlideSpeak
  webhook/sync/admin routes, the CCF generate-ccf-report edge fn, and
  enforceExportAllowed gating. useReportProgress polling contract unchanged.
- The 11 GapAnalysisView navigability features (B Corp programme) and the
  blockingSignal/focusRequirementId jump wiring in BcorpExperience. GapAnalysisView
  logic is not edited; only URL-syncing the surrounding tab state.
- SendEsgSurveyDialog (SupplyChainEsgCard mounts it twice): already restyled in the
  network pass; do not touch again.
- Tier gating exactly as-is: FeatureGate bcorp_tracking (whole certifications hub),
  canopyFrameworkFeatures per framework, the guardian ladder
  (greenwash_website/documents/unlimited), export gating.
- Guardian public API (/api/greenwash/public), the analyze-greenwash-content edge
  function, and the 3s polling contract.
- Evidence-library routes (suggest-requirements LLM, link/unlink/reject, signed
  URLs) and the coincidentally-named 'evidence-library' storage bucket used by
  certification exports.
- materiality_assessments upsert (onConflict organization_id,assessment_year) and
  /api/transition-plan POST/PATCH incl. AI risk generation.
- Rosa page-context slices (reports, targets) keep feeding equivalent context.
- calculateCorporateEmissions parity: CCF and the workbench read the same calcs;
  presentation-only changes on both sides of the delineation.

## Decisions for Tim (nothing built until these are settled)

1. **Kill the phantom front door?** /reports/ becomes a redirect to the real hub
   at /reports/sustainability/ and the band's Reports tab points straight there.
   (Alt: rebuild /reports/ as a new thin hub page; more work, second hub to keep
   coherent.) RECOMMEND: redirect + repoint.
2. **Retire /operations/?** A legacy duplicate of /company/facilities (old design),
   linked only from the phantom front door. Redirect to /company/facilities/.
   RECOMMEND: yes.
3. **The band: five flat tabs?** Reports / Certifications / Guardian / Targets /
   Library; "More…" dies; Materiality + Transition plan entries die (they are tabs
   of the hub); Historical, Footprint and Builder become landing rows + hub doors.
   RECOMMEND: yes (the network precedent; also fixes the library orphan).
4. **The landing poster**: THE PROOF (report + certification counts, stable and
   always meaningful), or the LATEST report (fresher but empty for new orgs), or
   certification readiness (only meaningful mid-journey)? RECOMMEND: the proof.
5. **CCF vs the workbench**: keep both, delineated (workbench = live inventory,
   CCF = the annual report artefact) with one quiet cross-link each way, or fold
   the CCF hub into the builder? RECOMMEND: keep both, delineate; recut the hub.
6. **The certifications monolith**: quiet in place this pass (URL-synced mono tabs,
   extracted bodies, deduped tone ladders), with migration of csrd/gri/sbti onto
   CertificationExperience as a named follow-up? Or migrate now (needs
   audit-packages + requirements tabs added to CertificationExperience: feature
   work)? RECOMMEND: quiet in place now, migrate later.
7. **Orphan deletions**: AuditPackageBuilder (432 lines) + the five dead
   components/reports/ files (CCFSankeyDashboard, GapFillWizardModal,
   XeroBaselineCard, ImpactValuationMethodology, ImpactValuationTrends). All
   grep-verified zero importers; each re-verified before deletion. RECOMMEND: yes.

## Build order (after decisions; each step ends with a look on the dev server)

Built on :8895 (own dist dir). Foundation by the lead; steps 3-8 by five parallel
agents after groundwork (the network model). ALL VERIFIED.

- [x] 1. Registry + landing: five flat tabs, More… retired, /evidence/ landing +
        /api/evidence/counts (7 tables, resolveAccessibleOrg), desk poster flipped,
        /evidence path-prefix added. VERIFIED (band resolves brick, counts 200).
- [x] 2. Front door: /reports/ → redirect to /reports/sustainability, band Reports
        tab points straight there; /operations → redirect to /company/facilities;
        5 moduleLinks/hrefs repointed. VERIFIED (both redirects land).
- [x] 3. Sustainability hub (Statement, URL-synced tabs, quiet cards, guardian
        cross-link) + both setup wizards (full stone-* purge); on-finish + Rosa
        links repointed to ?tab=. tsc 0 errors. VERIFIED.
- [x] 4. CCF: hub recut (eyebrow + full palette purge, studio trend/bars/badges),
        18 category cards + 2 charts swept, SCOPE_COLOURS restudioed, delineation
        cross-links both ways. VERIFIED (hub renders, 0 off-palette).
- [x] 5. Certifications: hub scaffold collapse + filter row; cluster conversion
        (GapAnalysisDashboard 23 + EvidenceLinker 14 first, then all 13 others);
        status-tones.ts helper dedupes the ladders; all three experiences
        URL-synced (jump mechanics preserved via wrapper setters); EvidenceLinker
        gains the library cross-link. 11 B Corp features + GapAnalysisView intact.
        VERIFIED (hub + B Corp detail, ?tab= deep-link opens Audit, 0 off-palette).
- [x] 6. Guardian: statements on [id] + bulk, emoji/dashed/RefreshCw purge,
        components extracted to components/greenwash/, riskTone helper replaces
        getRiskLevelColor, status:'error'→'failed' fix. VERIFIED.
- [x] 7. Library: EvidenceDetailPanel Statement + font-heading→font-display,
        comment tidied. VERIFIED.
- [x] 8. Targets: eyebrow PULSE→THE EVIDENCE, back-link removed, InitiativeDialog
        amber + the room's last Loader2 gone, Badge → StateChip, INITIATIVE_STATUSES
        tones at source, TargetSetter de-noised. Tests 13/13. VERIFIED.
- [x] 9. Orphan deletions: AuditPackageBuilder + the 5 dead components/reports/
        files (all re-verified zero importers via git rm). Two misfiled cards
        (SpendImportCard, XeroEnergyBaselineAlert) moved to components/emissions/,
        imports repointed.
- [x] 10. Sweep: full tsc exit 0 (twice); room-wide off-palette grep CLEAN (no
        emerald/blue/amber/orange/red/green/slate/stone scales, no neon-lime/ccff00,
        no Loader2/RefreshCw/animate-spin, no em dashes, no PULSE·/THE POST·/THE
        MEASURES· eyebrows); mobile 375 no overflow (landing + cert detail);
        consoles clean (after a server restart cleared a stale-cache ENOENT from
        the mid-run deletions — not a code fault). Review log + memory updated.

GO-LIVE NOTE: the three certification experiences + monolith now call
useSearchParams in client components (matches the suppliers-page precedent, works
in dev). Confirm the production build is happy (Suspense boundary / dynamic) in
the go-live pass.

## What does not change

- All URLs (the two redirect stubs stay as redirects; real moves wait for the
  go-live redirect pass). The lcas page (cellar). The workbench emissions page.
- The whole generation stack (PDFShift, SlideSpeak, CCF edge fn, summary exports),
  all tier gating, the 11 B Corp features, the guardian LLM + public API, the
  library's LLM suggestions and signed URLs, materiality/transition-plan write
  paths, Rosa context feeds.
- Functionality only improves; nothing is deleted unless repeated or redundant
  (each case is a named decision above).
- No migrations. No prod. Local preview only, as ever.
