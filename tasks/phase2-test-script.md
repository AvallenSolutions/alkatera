# Phase 2 test script: the "am I happy" pass

For Tim, on https://alkatera-staging.vercel.app (login tim@alkatera.com).
Ordered by risk: the top rooms carry the freshest code (yesterday's merge and
the report-sections stream), the bottom ones have been stable for weeks.
Tick as you go; anything wrong goes on the punch list at the bottom, one line
each, and a session picks the list up. Nothing here is destructive; it is a
test database.

Setup, once:
- [ ] `/admin/demo-seed` → Seed Drinks Co demo (do NOT run Recalculate LCAs after)
- [ ] Switch to the alka**tera** Drinks Co org for everything below
- [ ] Ask Rosa anything → a real answer, not "GEMINI_API_KEY missing" (proves the key)

## 1. The cellar (merge-critical: parametric packaging landed yesterday)

- [ ] Create a product from scratch (any spirit, 700ml) → recipe editor opens
- [ ] Packaging tab → Guided setup → bottle/glass/700ml → cap + label → Complete
- [ ] Every created row shows a material identity and "Checked", with NO factor
      search box anywhere in the flow
- [ ] Open a seeded product's completed LCA → numbers present, boundary label
      correct on the products list (cradle-to-grave products keep
      Distribution/Use/End-of-life)
- Wrong if: a search box asks you to find an emission factor for packaging; a
  boundary shows "cradle-to-gate" on a product seeded as full lifecycle.

## 2. The evidence: reports (all-new this weekend)

- [ ] Create a report → pick Marketing → sections editor: under each ticked
      social section a mono line reads "N of M measures recorded"
- [ ] "Show missing" expands to MISSING rows that deep-link to the right pages
- [ ] Generate the draft → narratives are real prose (not the same stiff
      sentence pattern repeated per section = fallback; real Gemini varies)
- [ ] The generated document: every ticked section HAS a page; unmeasured
      things say "Not yet measured", never N/A, never a bare 0
- [ ] The mixed state: add one workforce demographics row under
      /people-culture/diversity-inclusion, regenerate → gender diversity and
      headcount populate while living wage/training/pay gap stay skeletons
- [ ] Ship a PDF (PDFShift) and open it; create a share link, open it logged
      out, revoke it, confirm the link dies
- Wrong if: a ticked section is simply absent from the document; N/A appears
  on people/governance/community/supply-chain/facilities pages; a share link
  survives revocation.

## 3. The desk + arrival (fresh-org path)

- [ ] Log out; sign up a brand-new org through the front door → the 5-screen
      arrival ritual runs, org is created at the end (not before)
- [ ] The desk renders: greeting, priority tiles, the growth-field forest
- [ ] Room checklists match what Rosa says when asked "what should I set up?"
- Wrong if: arrival dead-ends or creates the org before the ritual finishes;
  the forest is blank for a fresh org (it should be sparse, not missing).

## 4. The workbench

- [ ] Add one month of electricity for a seeded facility → saves, appears in
      emissions
- [ ] Pulse: widgets render for the seeded org; refresh completes
      (staging runs no background jobs, so slow-but-completes is fine)
- [ ] Spend/quality/fleet pages open without errors
- Wrong if: utility entry saves but emissions never move; a widget shows a
  permanent spinner.

## 5. The network

- [ ] Suppliers list shows the seeded roster; open one; the detail page
      sections render
- [ ] Send an ESG survey to a test address you own (it is staging; the email
      is real) or stop at the preview if you prefer
- [ ] Messages + support threads open
- Wrong if: supplier detail 404s or the invite flow errors before the send.

## 6. The wiring

- [ ] /settings: every tab opens; billing tab shows the (test-mode) state
- [ ] /admin/rosa-learning renders (thin data is fine)
- [ ] If EPR is flagged on for the org: generate a submission preview →
      DRS lines zero-rated, tonnages sane (the uuid fix landed this weekend)
- Wrong if: a settings tab is blank; EPR generation errors.

## 7. Rosa (persona + learning merged this weekend)

- [ ] Ask "who are you" → the Rosa story, never "I am an AI"
- [ ] Ask a question on a product page → the answer references the page
- [ ] Rate an answer with the verdict chips → no error toast
- [ ] Ask "what should I do next" → readiness-led answer matching the on-screen
      checklists
- Wrong if: any self-description as an AI/chatbot; verdict chips error.

## 8. The library

- [ ] Knowledge bank renders for the org; wiki search returns results; a wiki
      page opens with the teal room chrome
- Wrong if: wiki pages 404 (that is the outputFileTracingIncludes trap).

## Punch list

(add lines here; a session works them off newest-first)

- [FIXED 2026-07-20, commit 6c7dd675] The Drinks Co demo seeder assumed PROD's
  existing rows and 500'd on any empty environment ("calvados BOM 228" FK
  error after a silent orchard upsert failure). foundation.ts now creates
  org/facilities/products when missing (never updates existing rows; prod
  unchanged); verified twice on a wiped local org, identical counts, second
  run a no-op. The staging seed click now works.
- [SMALL] Arrival overlay's DialogContent has no DialogTitle (Radix a11y
  warning on every mount).
- [FIXED 2026-07-20, commit 5405065c] The "stuck skeleton" Tim hit on staging:
  an unauthenticated visit to any authenticated URL skeletoned forever instead
  of redirecting to /login (organizationContext's user-changed effect took
  neither branch when both the current and last user id were null, so
  isLoading never cleared). Reproduced locally logged-out, fixed, verified:
  logged-out /desk now lands on /login. The earlier "0x0 viewport" local
  sighting was this same bug wearing a disguise.
- [NOTE] Along the way, staging state was corrected by hand: Tim's arrival
  marked complete, is_alkatera_admin set true. An org left mid-arrival is
  still worth an explicit staging test (fresh-org signup, item 3).
