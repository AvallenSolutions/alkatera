# The network: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
Fourth room deep-pass, after Today, the workbench and the cellar. Covers EVERY page
and EVERY internal tab from the start (the workbench lesson).

STATUS: DECISIONS SETTLED (10 July 2026). Building.

Decisions as settled by Tim:
1. Retire /suppliers/new/ — YES (thin token redirect only if the public journey doesn't fully supersede).
2. One door on suppliers list — YES.
3. Supplier detail — STACKED SECTIONS (vineyard precedent).
4. Landing poster — THE CHAIN (supplier count + ESG coverage → /suppliers/).
5. Fold in advisor-security on the six supplier routes — YES.
6. One config-driven PartnerProfile template — YES.
7. Impact Focus email — corrected to hello@impactfocus.co.uk (match the .co.uk site);
   website + all other partner URLs preserved byte-for-byte.

## What the network is

The people you talk to. Ochre band, and the room with a unique rule: ochre takes
INK text on saturated blocks, not cream (every poster/pill in this room must use
on="ink"). Eleven pages behind the band:

| Surface | Route | Lines | State |
|---|---|---|---|
| Suppliers list | /suppliers/ | 1,420 | Header studio; body old (the room's monolith) |
| Add supplier (legacy) | /suppliers/new/ | 450 | Zero studio; LEGACY flow (see decision 1) |
| Supplier detail | /suppliers/[id]/ | 817 | Old; genuine 3-tab bar inside |
| Messages list | /settings/messages/ | 207 | Half studio; stale THE POST eyebrow |
| Message thread | /settings/messages/[id]/ | 364 | No statement; icon-headed card |
| Support list | /settings/feedback/ | 7 (+277) | Worst in room: never converted, lime-500 badges |
| Support ticket | /settings/feedback/[id]/ | 436 | No statement; icon-headed card |
| Experts directory | /expert-partners/ | 124 | Nearly studio; stale THE POST eyebrow |
| Impact Focus profile | /expert-partners/impact-focus/ | 316 | Brochure chrome, gradients, 18 icons |
| Lucent Energy profile | /expert-partners/lucent-energy/ | 217 | Brochure chrome (near-clone of above) |
| Supplier responsibility | /supplier-responsibility/ | 31 (+221) | Correct eyebrow; emoji headers, badge pills |

Registry today: tabs Suppliers / Messages / Support, with Experts and
Responsibility in "More…". No landing.

## The noise audit

### Suppliers list (/suppliers/) — the monolith
- Two whole-page MODES (empty vs populated) instead of one composition.
- THREE header buttons (Smart upload, Send ESG Survey, Find or Invite) and FOUR
  separate routes into the same directory/invite sheet; the ESG survey is
  reachable from five-plus places across the room.
- Off-palette everywhere: emerald-500/600, blue-500/600, neon-lime (the OLD
  brand accent, in an ochre room), red-600 delete. Three different "Verified"
  badge treatments. Badge-pill filter chips. Loader2/RefreshCw spinners.
- Empty mode is a dashed emerald hero (icon medallion + search + CTA) stacked on
  a second dashed box with ANOTHER invite button.
- Code smell a rebuild must fix: InviteForm / SupplierPreview / DirectoryListItem
  / FilterChips are defined INSIDE the page render (InviteForm's controlled
  inputs risk focus loss on every parent re-render).
- Good bones: the header block, the deferred SuppliersByEmissions and
  SupplierTieringPanel panels (tiering already uses room-accent mono).

### Add supplier (/suppliers/new/) — legacy, misnamed, ungated
Writes to `suppliers` (the supplier's OWN profile table) + supplier_engagements
and marks supplier_invitations accepted: it is an old invite-acceptance/
registration flow, not the brand-side add (which inserts organization_suppliers
via the sheet). No supplier-limit check, no permission gate. Only inbound links:
CommandPalette, QuickActionsWidget, Rosa's briefing prompt. Retire candidate
(decision 1), with those three links repointed.

### Supplier detail (/suppliers/[id]/)
- Header badge-pill zoo (blue Verified, emerald ESG score, slate Pending) over
  a blue "not yet joined" banner.
- A genuine internal content-tab bar: Overview / Products (n) / ESG.
  Overview is icon-card soup duplicating list-card facts; Products rows carry
  four tinted impact chips each (emerald/blue/amber/orange); ESG has Progress
  bars and coloured yes/partial/no/na answer badges.
- One correct Rosa touchpoint (useRosaPageContext feeding active_tab): keep
  feeding equivalent context after the recomposition.

### Messages (list + thread)
- List: stale "THE POST · MESSAGES" eyebrow; conversation Cards instead of
  quiet rows; icon empty-state.
- Thread: NO statement at all; a Users-icon card header; h3 section heads.
- These are advisor conversations (org ↔ invited advisor), often empty for
  new orgs; the empty state must stay honest and quiet.

### Support (list + ticket)
- Never touched by any pass: plain h1, red-500 unread badge, and a
  bg-lime-500 "New reply" badge (the old #ccff00 theme's ghost), amber/green
  icon section heads, icon-headed ticket cards, a Loader2 in FeedbackDialog.
- Ticket thread is a structural twin of the message thread (same load/send/
  markAsRead/realtime scaffolding, duplicated MessageBubble).

### Experts (directory + two profiles)
- Directory nearly studio; stale "THE POST · EXPERTS" eyebrow; an orphaned
  "Recommended" label; Sparkles icons.
- The two profile pages are hardcoded near-clones with brochure chrome:
  gradient hero cards, border-2 colours, icon-card service grids, a six-colour
  accent system (none of it ochre), 18 lucide imports on one page. The Canopy
  credit ladder (partner_credits, £600 after 6 months) is real business logic.
- Engagement is outbound-only: mailto + website links ARE the referral
  mechanism; preserve all four URLs byte-for-byte.

### Supplier responsibility
- The only page in the room with a correct eyebrow. Emoji icon headers
  (📜🔍✅💷🛡️🤝), framework + "Attested" badge pills, off-palette emerald/blue.
- Producer-side attestations (6 items, score feeds the Vitality composite);
  completely disjoint from supplier ESG surveys: no redundancy, only a naming
  hazard. Its back-link points at /performance/ (the cellar) although the room
  band files it under the network: pick one story (see moves).

### Cross-room wiring notes
- /settings/messages and /settings/feedback correctly band ochre (prefix table
  ordering verified) but the URLs live under the wiring's /settings/ prefix;
  back-links and empty-state links hop rooms mid-task. Real moves
  (/network/messages) would need permanent redirects: deferred to go-live
  (noted, not this pass).
- Advisor unread count is computed by an N+1 loop in /api/advisor-messages:
  the landing needs one cheap aggregate instead.
- SECURITY FLAG (backend, small): none of the six supplier API routes use
  resolveAccessibleOrg / denyReadOnlyAdvisor: they gate on membership only.
  The house rule (advisor programme) says reads move to resolveAccessibleOrg
  and writes get denyReadOnlyAdvisor. Fold into this pass (decision 5).
- Impact Focus mailto is hello@impactfocus.co but the website is
  impactfocus.co.uk: confirm with Tim which is right before we enshrine it.

## The design moves

### 1. The landing: /network/ (the room-landing pattern, ochre)
1. Statement: "The network." with note "The people you talk to."
2. The one ochre poster (INK text, square mark): THE CHAIN: supplier count +
   ESG coverage ("12 SUPPLIERS · 4 ESG SUBMITTED"), linking to /suppliers/
   (decision 4 confirms the poster).
3. Fact rows with live counts via new /api/network/counts (clone the workbench
   counts route): The suppliers (N, attention chip when invites are pending),
   Messages (N unread, from a new single aggregate), Support (N open tickets,
   attention when a staff reply is unread), The experts (quiet, with the credit
   status line when active), Responsibility (coverage chip, e.g. "4 OF 6").
4. Registry: landing '/network/', desk poster href flips to it, band room name
   links to it. Tabs become FIVE flat tabs: Suppliers / Messages / Support /
   Experts / Responsibility; the "More…" dropdown dies (the cellar precedent:
   no single-item or two-item overflows when the band fits five).

### 2. Suppliers list: one door in, one composition
1. Split the 1,420-line monolith: page.tsx becomes composition; extract
   InviteForm, SupplierPreview, DirectoryListItem, FilterChips into
   components/suppliers/ as real components (fixes the focus-loss smell).
2. ONE composition, not two modes: statement + count (kept), then THE CHAIN
   section (the supplier grid, recut quiet: logo tile or monogram, name,
   location + products as mono meta, one Verified StateChip, kebab intact),
   then BY EMISSIONS and TIERING as eyebrow'd hairline sections (they already
   self-hide without data). The empty state collapses to one dim line + one
   pill (no dashed heroes, no inline directory grid: the sheet owns discovery).
3. One door in (decision 2): header slims to the count + TWO actions: "Find or
   invite" (the room pill, ink-on-ochre) opening the directory sheet, and
   "Send ESG survey" (outline). Smart upload moves into the sheet's quiet rows
   (the products-list precedent). All other sheet entry points route through
   the same handler.
4. The directory sheet recut quiet: mono filter text-links instead of badge
   chips, hairline result rows, the preview pane's neon-lime Add becomes the
   ochre room pill (ink text), InviteForm quiet. Delete dialog: stale tone,
   busy text, no spinner.
5. Off-palette purge: emerald/blue/neon-lime/red-600 all go; Verified becomes
   ONE StateChip treatment everywhere.

### 3. Retire /suppliers/new/ (decision 1)
Verify the invite-token path is fully superseded by the public
/supplier-invite + /supplier-register journey (grep + read before deleting),
then delete the route and repoint the three inbound links (CommandPalette,
QuickActionsWidget, Rosa briefing prompt) at /suppliers/ with the sheet open
(support a ?invite=1 query param). If the token path is NOT superseded, keep a
thin redirect for tokened URLs only and note it.

### 4. Supplier detail: one paper (decision 3 settles sections vs tabs)
1. Statement header: eyebrow "THE NETWORK · SUPPLIER", the supplier name as
   the headline, the ESG score standing right as the BigNumber (with rating
   chip); a quiet mono back-link; the badge zoo becomes a StateChip meta row
   (Verified / ESG pending / not yet joined: the blue banner becomes an
   attention-tone line).
2. RECOMMEND: the Overview / Products / ESG tabs become stacked mono-eyebrow
   SECTIONS down one paper (the vineyard-detail precedent): THE COMPANY (facts
   + relationship + notes, deduped against the header), THE PRODUCTS (quiet
   rows: name, type + origin as mono meta, impact figures as tabular numbers
   not four tinted chips), THE ESG ASSESSMENT (score + section breakdown with
   quiet bars, Q&A as hairline rows with tone chips; the three alternate
   states as one quiet line + one pill each). Alternative if Tim prefers:
   quiet mono tabs. Either way the Rosa context slice keeps feeding
   section/tab state.
3. SendEsgSurveyDialog stays shared (also used by certifications cards):
   restyle via its own file once, carefully (it is RHF+zod: presentation only).

### 5. Messages: quiet correspondence
1. List: eyebrow to THE NETWORK · MESSAGES; subtitle folds into the statement;
   ConversationCards become hairline fact rows (name bold, subject + preview
   as the hint, unread as a mono figure with room-accent, date right); empty
   state one dim line + a quiet link to invite an advisor.
2. Thread: gains a statement (subject as headline, THE NETWORK · MESSAGE
   eyebrow, participant as mono meta); the Users-icon card dies; "Conversation"
   h3 becomes a mono eyebrow; reply box quiet with the room pill Send
   (ink-on-ochre) and busy text.

### 6. Support: full conversion + the shared thread
1. Extract ONE shared studio Thread + MessageBubble + useRealtimeThread from
   the two near-identical implementations; both threads adopt it (feedback
   adds the Staff chip + attachments slot, messages adds ⌘+Enter). One build,
   two surfaces, and the next room pass touches one component.
2. Support list: statement (THE NETWORK · SUPPORT, "The support desk." or
   similar), unread as BigNumber; red-500 and lime-500 badges become
   StateChips/mono; ACTIVE and RESOLVED as mono eyebrow sections (no coloured
   icons); ticket cards become fact rows (title bold, category + priority as
   chips, date right); FeedbackDialog de-spun (busy text) and quieted.
3. Ticket detail: statement from the ticket title; category icon header dies
   (category is a chip); Attachments / Resolution / Conversation as mono
   eyebrows; resolved state as a good-tone quiet line.

### 7. Experts: one template, two configs (decision 6)
1. Directory: eyebrow to THE NETWORK · EXPERTS; the orphan "Recommended" label
   and Sparkles die; partner cards become quiet panels (logo, name, mono
   category, summary, the credit/discount line as a plain fact); "View" as a
   quiet arrow row.
2. Collapse both profile pages into ONE config-driven PartnerProfile template
   (the CropConfig precedent): per-partner config carries name, category,
   logo, prose, website + mailto URLs (byte-for-byte), incentive copy, and
   service catalogue. Sections: statement (name, category as mono meta), WHY
   WE RECOMMEND THEM (prose), THE SERVICES (hairline rows grouped by category:
   the six-colour icon-grid dies), GET IN TOUCH (website outline pill + email
   room pill, ink-on-ochre). The Impact Focus credit ladder is the one
   saturated ochre block on that page (a poster: "£600 CREDIT · 4 OF 6
   MONTHS"), config-slotted so Lucent simply has none. Lucent's duplicate
   closing CTA dies.
3. Existing URLs (/expert-partners/impact-focus/) keep working: the two
   page.tsx files become thin wrappers rendering the template with their
   config (no [slug] migration needed).

### 8. Responsibility: six quiet attestations
1. Eyebrow correct already; the matrix recuts to six hairline fact rows:
   attestation name bold, framework as mono microtext, an Attested/Not yet
   StateChip, the Attest/Remove action as a quiet pill, and when attested the
   evidence URL + notes inline (kept, save-on-blur intact). Emoji die.
2. Coverage becomes the page's figure standing right in the statement
   ("4 OF 6" BigNumber), not a stat card.
3. The stale "Back to Company Vitality" back-link dies (the room band and
   landing own navigation); the page's home is the network (decision already
   implicit in the registry: it stays here).
4. The vitality composite keeps reading supplier_responsibility_attestations:
   no data changes.

### 9. Room hygiene + sweep
- Every eyebrow reads THE NETWORK · X; every saturated block and room pill in
  this room uses ink-on-ochre (on="ink"): add an explicit check to the sweep.
- New /api/network/counts + one cheap advisor-unread aggregate (replaces the
  N+1 for the landing only; the messages page keeps its per-conversation
  counts).
- Advisor security alignment on the six supplier routes (decision 5).
- Sweep: mobile 375/768/1024/1440, consoles clean, full tsc, greps (ccff00,
  lime-500, emerald-/blue-500, badge pills, em dashes in copy), review log,
  memory update.

## Protections (restated for the build agents)

- The supplier PORTAL (external journey, already converted) shares
  lib/supplier-esg/questions.ts + scoring.ts and SendEsgSurveyDialog:
  presentation-only changes to the dialog; never touch the two libs.
- The email-join spine: list view → /api/suppliers/enrich and detail →
  /api/suppliers/detail resolve by contact_email; every recomposition keeps
  passing contact_email through unchanged.
- Invite + survey API flows (/api/invite-supplier, /api/send-esg-survey)
  unchanged except the security wrappers of decision 5.
- partner_credits ladder logic (usePartnerCredits) and all four partner
  mailto/website URLs byte-for-byte (pending Tim's domain answer).
- Realtime subscriptions on both threads; feedback attachments (signed URLs).
- Supplier tier limits (useSupplierLimit + server checkLimit) keep gating
  quick-add and invite; the retirement of /suppliers/new REMOVES the one
  ungated path (a win, note it in the report).

## Decisions for Tim (nothing built until these are settled)

1. **Retire /suppliers/new/?** A legacy invite-acceptance flow that bypasses
   supplier limits and permission gates, unreachable except via three internal
   shortcuts (which get repointed). We verify the public invite journey
   supersedes its token path before deleting. RECOMMEND: yes, retire.
2. **One door in on the suppliers list?** Header slims to "Find or invite"
   (room pill, opens the sheet) + "Send ESG survey" (outline); Smart upload
   moves into the sheet; the empty-state's duplicate doors die. RECOMMEND: yes.
3. **Supplier detail: sections or quiet tabs?** Overview/Products/ESG as
   stacked mono-eyebrow sections down one paper (vineyard precedent), or keep
   three quiet mono text tabs (facility precedent). RECOMMEND: sections: it is
   reading, not data entry.
4. **The landing poster**: THE CHAIN (supplier count + ESG coverage, linking
   to /suppliers/), or the top emitter (the single supplier carrying the most
   spend emissions)? RECOMMEND: the chain: stable, always meaningful; the top
   emitter appears as a row when data exists.
5. **Fold the advisor-security alignment into this pass?** Six supplier routes
   move to resolveAccessibleOrg + denyReadOnlyAdvisor per the house rule.
   Backend-only, small, testable. RECOMMEND: yes, same pass.
6. **Experts: one config-driven template for the two partner profiles?**
   URLs unchanged, credit ladder becomes an Impact Focus config slot.
   RECOMMEND: yes.
7. **Impact Focus contact email**: mailto goes to hello@impactfocus.co but the
   site is impactfocus.co.uk. Which domain is correct? (We preserve whichever
   you confirm.)

## Build order (after decisions; each step ends with a look on :8891)

Built on :8895 (own dist dir; another session held :8891). Foundation done by
the lead; steps 3-10 built by six parallel agents after groundwork (cellar model).

- [x] 1. Registry + hygiene: five flat tabs, More… dies, landing entry + the
        /network path-prefix, desk poster flipped to /network/, eyebrow fixes,
        /api/network/counts + the advisor unread single-aggregate. VERIFIED.
- [x] 2. The landing at /network/ + desk/band wiring (THE CHAIN poster, ink
        text via on="ink"). VERIFIED (band resolves to network, counts 200).
- [x] 3. Suppliers list: monolith split into components/suppliers/ (Directory
        ListItem, SupplierPreview, InviteForm, FilterChips, directory-types;
        fixes the inline focus-loss bug), ONE composition, two doors (Find or
        invite room pill + Send ESG survey outline), Smart upload moved into
        the sheet, ?invite=1 auto-opens it, off-palette purged. VERIFIED.
- [x] 4. /suppliers/new DELETED (public /supplier-invite journey supersedes the
        token path); five references repointed at /suppliers/?invite=1
        (CommandPalette, QuickActionsWidget, rosa/briefing, gaia action-
        handlers, priority-tiles-prompt); grep = 0 remaining. VERIFIED.
- [x] 5. Supplier detail: statement + sections, SendEsgSurveyDialog restyle
        (contract preserved; tsc clean). Built; render check pending (org has
        0 suppliers).
- [x] 6. Shared Thread extraction (components/network/) + messages list/thread.
        VERIFIED (messages list renders, THE POST eyebrow fixed).
- [x] 7. Support list/ticket conversion on the shared Thread. VERIFIED
        (support list renders clean, 0 off-palette).
- [x] 8. Experts: directory polish + PartnerProfile template. VERIFIED (all 3
        pages; Impact Focus mailto fixed to .co.uk; URLs byte-for-byte).
- [x] 9. Responsibility: fact rows + coverage figure + back-link fix. VERIFIED
        (6 rows, 0 OF 6, no emoji).
- [x] 10. Advisor-security alignment: 4 directory routes wrapped
        (resolveAccessibleOrg + denyReadOnlyAdvisor); 3 others correctly left
        (RLS/anon or already compliant). tsc clean.
- [x] 11. Sweep DONE: full `tsc --noEmit` exit 0 (twice); visible-surface grep
        clean (no emerald/blue/amber/lime/red-N/slate-N, no neon-lime/ccff00,
        no Loader2/RefreshCw/animate-spin, no em dashes, no "THE POST"); the
        two list panels (SuppliersByEmissions, SupplierTieringPanel) de-limed
        (Card/dashed/Badge/emerald gone, quiet empty lines); Lucent logo plate
        bg-slate-900 → bg-studio-ink; "— OF 6" placeholder de-dashed; mobile
        375 no overflow on landing + suppliers; consoles clean; band resolves
        ochre (network prefix); ink-on-saturated verified on the poster.

Out of scope (noted, NOT touched): the external supplier PORTAL components and
now-orphaned detail-tab components (SupplierEvidenceTab, SupplierProductEvidence
Tab, SupplierProductImpactForm, SupplierProfileStep, EsgQuestionEvidenceUpload)
remain off-palette — they belong to the portal/detail-evidence pass, and the
new supplier-detail page imports none of them.

## What does not change

- All URLs (the /settings/* comms URLs stay until a go-live redirect pass),
  all APIs' behaviour (bar the security wrappers), the supplier portal, the
  ESG question/scoring libs, invite + survey emails, credit ladder maths,
  realtime, attachments, tier limits.
- Functionality only improves; nothing is deleted unless repeated or redundant
  (each case is a named decision above).
- No migrations. No prod. Local preview only, as ever.
