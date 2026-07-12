# The Today room: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.

## What Today is

Three surfaces behind the forest band: the Brief (`/rosa/`), Pulse (`/pulse/`) and
Financial (`/pulse/financial/`). The M3 sweep de-limed them, but they still speak the
dashboard grammar the design doc rejects: card soup, nested tab bars, duplicated
Rosa entry points, setup chrome dumped on the page, and the same fact told twice.

The desk works because it is a poster: one statement, one quiet list of what needs
you, one saturated block, and everything else revealed on approach. This plan applies
that grammar to each Today surface.

## The noise audit (what confuses the user today)

### The Brief (`/rosa/`)
- Ten-plus independent cards in a 8/12 + 4/12 dashboard grid, each with its own
  icon header: ProgressTracker, ForwardTimeline, QuickPrompts, RecentlyFromRosa,
  ProductSpotlight, QuickActions, RecentConversations, CircularPartnerships,
  NaturePositiveActions, CertificationHealthWidget.
- The same priority appears twice: the forest priority tile AND a separate
  attention strip both say "facility data is out of date".
- Three ways to ask Rosa on one page (QuickPrompts card, QuickActions card, the
  ink band) when the ink band is Rosa's one home.
- Setup chrome on the page: HubSetupWizard takeover, "Showing fallback picks ·
  Re-pick" control, a whole "Pick something to track" card of empty-state buttons.
- "The next 14 days: clear horizon, nothing time-sensitive" spends a full panel
  saying nothing.

### Pulse (`/pulse/`)
- A second level of navigation inside a room tab: five internal tabs (Overview /
  Performance / Money / Operations / Plan). Room band tabs, then page tabs, then
  drill overlays: three layers deep.
- The Money tab duplicates the Financial surface (same four widgets, same question).
- Header chrome row: LIVE chip, Refresh data button, Customise button, share icon.
- An inline "Ask Rosa about anything on this page" input duplicating the ink band.
- A "Get more from Pulse" checklist card competing with the verdict hero.

### Financial (`/pulse/financial/`)
- "Back to Pulse" link (the room band already navigates) and a BETA badge pill
  (the design doc bans badge pills).
- A dense uniform card grid where every card carries an icon + label header;
  numbers do not lead.

## The design moves

### 1. The Brief becomes a brief (read, not scanned)
One column on paper, read top to bottom like a printed morning note. No 8/4 grid.

1. **The statement** (exists): date eyebrow, "Good morning, Tim."
2. **What needs you today**: the desk's quiet fact-row list (same
   `/api/rosa/priority-tiles` data), each row: bold subject, one plain sentence,
   count + arrow. The top priority is the surface's ONE forest poster block.
   The separate attention strip dies (it is row two of this list).
3. **The day's reading**: a typographic digest, hairline-separated, no boxes:
   - The tracked number (if set) as a big number over a mono label with Rosa's
     one-line read. Setup collapses to a ghost pill ("Track a number"), not a card.
   - The next 14 days as fact rows; a clear horizon is one quiet dim line.
   - Recently from Rosa as fact rows (subject + mono time), not cards.
4. **The margins** (bottom, quiet): recent conversations as plain fact rows;
   certification health as one fact row; the sustainable-AI note becomes a one-line
   mono footnote.

Removed or relocated:
- QuickPrompts card: gone; the ink band and drawer own prompting (drawer keeps chips).
- QuickActions card: gone; the queue surfaces as a "what needs you" row when it has
  items, and document drop already lives in the drawer.
- ProductSpotlight, CircularPartnerships, NaturePositiveActions: KEPT on the Brief
  (decision 4, revised with Tim): they merge into one quiet "The good work" section
  of the reading digest. Products keep their thumbnails as a compact row strip;
  byproduct partnerships and nature actions become typed fact rows (BYPRODUCT /
  NATURE) in the same hairline section. Same data hooks, same click-throughs, same
  self-hiding when empty: one section instead of three icon cards.
- HubSetupWizard, HubLayoutSettings, the per-card visibility system (`useHubLayout`):
  retired (decision 1, approved 9 July). The Brief is editorial; Rosa curates it.
- OnboardingResumeBanner: kept, restyled to a hairline fact row with one pill.

### 2. Pulse becomes the poster of numbers (one paper, no page tabs)
1. **The verdict is the statement**: "On track." / "Two things need attention."
   set as the surface headline, with the three headline figures (emissions, cost,
   alerts) standing right as big numbers over mono labels, per the room anatomy.
   PulseVerdictHero's card body retires; its logic feeds the statement.
2. **The internal tab bar dies.** Performance, Operations and Plan become quiet
   sections down one scrolling paper, each a mono eyebrow + hairline rule, each
   leading with its one big number and a few fact rows. The existing widgets render
   as cream panels inside their section; the drill-in overlay stays as the detail
   layer (reveal on approach).
3. **The Money tab dies**: one money surface, Financial. (Decision 2.)
4. Header chrome collapses to the margins: refresh becomes a mono note
   ("REFRESHED 3H AGO · REFRESH"), admin-only; share moves into the drill overlay;
   Customise becomes one ghost pill at the foot of the paper (Decision 3).
5. The setup checklist restyles to hairline fact rows under the verdict, shown
   only while incomplete. The inline Ask-Rosa input dies (ink band owns it).

### 3. Financial gets the ink treatment (the CFO page reads like a rate card)
1. Statement: "What your impact costs." with the annual figure standing right.
2. Back-link and BETA pill die. "Board pack" becomes the room-colour pill (the one
   act this surface exists for); "Manage prices" a ghost pill beside it.
3. Cards keep their grid but are re-cut: mono eyebrow, the number leads display-bold,
   icons dropped, hairline panels, working tones only for states.
4. It formally absorbs the Money tab's widgets (top cost drivers, regulatory
   exposure, scenario sensitivity already exist here).

### 4. Shared studio mechanics
- Generalise the desk-priorities row list into `components/studio/fact-list.tsx`
  (bold subject, quiet sentence, mono meta, arrow) and reuse it on the desk, the
  Brief and Pulse's setup rows.
- One-saturated-block audit per surface: Brief = the top priority block;
  Pulse = the verdict statement carries the room accent (no poster block needed);
  Financial = none (ink and numbers; the forest pill is the accent).
- The circle mark (the sun) signs each Today surface, 8% on paper, corner-cropped.
- Mobile pass: everything reads single-column; fact rows wrap; the band tabs scroll.

## Decisions (settled with Tim, 9 July)

1. **Retire the hub customise system**: YES (wizard, layout settings, visibility toggles).
2. **Kill Pulse's Money tab in favour of Financial**: YES, one money surface.
3. **Advanced Customise grid**: KEEP, behind a single ghost pill.
4. **ProductSpotlight / CircularPartnerships / NaturePositiveActions**: KEEP on the
   Brief, merged into one "The good work" reading section (typographic rows, not
   three icon cards). Functionality improves; nothing is deleted unless repeated
   or redundant.

## Build order (each step ends with a look on :8891)

- [x] 1. `fact-list` studio component extracted from desk-priorities; desk adopts it
- [x] 2. The Brief: new one-column composition, priority list + forest block,
        reading digest, margins; remove the retired cards and their imports
- [x] 3. The Brief: retire hub layout system (decision 1); delete dead
        components; `grep` for orphaned imports
- [x] 4. Pulse: verdict-as-statement + headline figures; header chrome to margins
- [x] 5. Pulse: sections replace tabs; Money tab removed (decision 2);
        setup checklist to fact rows; inline Rosa input removed
- [x] 6. Financial: statement + re-cut cards + pills; Money widgets confirmed present
- [x] 7. Sweep: spacing rhythm, mobile pass (375/1024/1440, no horizontal scroll).
        Circle marks on paper DEFERRED: no room page uses on-paper marks yet, so
        adding them only to Today would be inconsistent; do it house-wide or not at all.
- [x] 8. Verify: tsc clean; console clean on all three surfaces; `grep -rl ccff00`
        empty in components/rosa + components/pulse (9 July)

## Added after the build (9 July)

- [x] **The day's numbers** on the Brief (`components/rosa/BriefNumbers.tsx`):
      Pulse and Financial as doorway fact rows with their numbers read out
      (verdict word in its working tone + emissions figure; annual environmental
      cost). Reuses `usePulseVerdict`, `useOverviewStats` and the now-shared
      `useAnnualEnvironmentalCost` (`components/pulse/financial/use-annual-cost.ts`).
      Both rows self-hide until real data exists.
- [ ] **Room-landing pattern** (agreed with Tim): recurse the desk's rhythm, not
      the navigation. Crowded rooms get a landing in the desk grammar (statement,
      one poster, fact-list blocks with live counts, including the "More…" strays);
      band tabs stay flat, one colour per room. Pilot: THE WORKBENCH, next pass.
- [ ] Follow-up: PulseCard could grow a `variant="studio"` so the Financial
      re-cut no longer needs the scoped CSS module (financial-studio.module.css).

## What does not change

- URLs (`/rosa/`, `/pulse/`, `/pulse/financial/`), the room band, the ink band,
  the drawer, all APIs and data hooks, the widget drill overlay machinery, and
  the widget registry (Customise still renders from it).
- No migrations. No prod. Local preview only, as ever.
