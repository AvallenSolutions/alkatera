# Marketing site: Home (from Claude Design Home.dc.html)

Branch: `claude/marketing-site-home-4e7551`. Design source: claude.ai/design project
`fc7cf965-739e-46ed-93e5-fcd682adaa52`, file `Home.dc.html` ("Gallery of Rooms" direction).

Design rules (from the project's CLAUDE.md):
- No ticker/marquee elements, ever.
- Never demo score-growth on the marketing site; static forests / season contrasts only.
- GrowthField always without the mist mask (full-saturation canopy).
- Nav: Platform / Pricing / Knowledge / Login; no Manifesto page (manifesto = soil section, #manifesto).
- Partner logos from /logos/*.svg (already in this repo's public/).
- Copy verbatim from the design (which took it from alkatera.com).

## Todo
- [x] Pull Home.dc.html + project CLAUDE.md + DS bundle from the design project
- [x] Copy the growth engine from the redesign worktree (components/studio/growth + theme.ts),
      original palette wins over the DS bundle's reconstructed one
- [x] Add marketing props to growth-field.tsx (fixed=false mode, height, style override)
- [x] Growth keyframes CSS (from redesign globals.css) available on this branch
- [x] Assets: copy 6 drinks SVGs from redesign, fetch 8 new bottles + 3 creatures from the design project
- [x] Space Grotesk via next/font (Inter + JetBrains Mono already loaded)
- [x] marketing/home/: Button port, soil art, page client (nav, hero, soil, 4 posters,
      reality scroll scene, process, pioneers, final CTA + newsletter, footer, easter eggs)
- [x] Wire app/page.tsx to the new client; metadata title "alkatera · Sustainability, Distilled"
- [x] Link map: Platform→/platform, Pricing→/pricing, Knowledge→/knowledge, Login→/login,
      legal links→real /terms /privacy /cookies
- [x] Browser-verify on the worktree dev server
- [x] Commit on this branch (do NOT push to main)

## Review (2026-07-23)
Shipped on `claude/marketing-site-home-4e7551`. Typecheck clean; growth engine's 15 unit
tests pass; browser-verified hero (summer canopy, no mask), soil manifesto (55% stat
animates, roots/worms render), all 4 sticky posters, the 480vh Reality scene
(winter→spring→summer crossfade + 6 scroll cards + full-leaf finale), process cards,
pioneers logo wall (logos 200 from /logos/), CTA shelf (all 14 bottle SVGs 200),
newsletter states, footer; mobile 375px has no horizontal overflow and the nav folds.

Deliberate decisions:
- GrowthField is the redesign's original TS engine (components/studio/growth), not the DS
  bundle's JS copy: the bundle's palette was RECONSTRUCTED from renders (its own comment
  says so); the original is the real design language. Marketing props (fixed=false,
  height, style) added to match the DS variant's API.
- Nav/CTAs link to /pricing and /pricing#trial per the design; that page does not exist
  yet (next page to build). Login → /login, Platform → /platform, Knowledge → /knowledge.
- Footer legal links point at the real /terms /privacy /cookies (design had placeholder
  anchors); Contact → /contact; Buyer's Guide → /best-sustainability-platform-drinks-industry.
- Newsletter subscribe is client-side only (design parity): validates and confirms but
  stores nothing. Wire to a real endpoint before go-live.
- Old marketing/components/HomePageClient.tsx left in place (untouched) since Navigation/
  Footer are shared by other public pages; only app/page.tsx switched to the new client.

Still open for other pages/sessions: Knowledge.dc.html, Login.dc.html; real newsletter,
trial-signup + greenwash-scan endpoints; SEO structured data parity with the old home
if wanted.

## Pricing page (added 2026-07-23, commit 0ef2ffdf)
Pricing.dc.html ported to marketing/pricing/PricingClient.tsx, wired at /pricing (the
route Home and Platform were already linking to). Design correction requested by Tim:
Blossom's plan icon is now a FLOWER (species poppy) instead of the design's hawthorn
tree, so the plans read seed → flower → canopy. First tried the oxeye daisy but its
cream petals are invisible on the cream card, hence the poppy. Species SVGs added to
public/assets/species/ (seed head, poppy, oak, plus daisy + campion for the Knowledge
page later). SiteNav/SiteFooter gained onTrialClick/onCta overrides so this page's CTAs
scroll to #trial in-page. Trial form is client-side only (design parity), same as the
home newsletter: needs a real endpoint before go-live. Browser-verified: hero, plan
cards (badge, struck prices, poppy), sticky-header comparison table with hover rows,
trial section, footer.

## Platform page (added 2026-07-23, commit c7bc20ca)
Platform.dc.html ported to marketing/platform/PlatformClient.tsx, wired at /platform
(FAQPage JSON-LD driven from marketing/platform/faq-data.ts). Shared chrome extracted to
marketing/shared/ (chrome.tsx: SiteNav/SiteFooter/LeafMark/Wordmark + font/style tokens;
effects.tsx: useReveal + CursorCreatures incl. the r-o-s-a run; marketing.css, was
home.css). Home refactored onto the shared modules and re-verified in the browser.
Browser-verified on /platform: hero + glass-box panel (number reroll + parallax), module
grid over the dark intro, ESG columns, brain trust, frameworks wall, drinks cells/stats,
FAQ accordion, CTA forest, footer. Old marketing/components/PlatformPageClient.tsx is now
unreferenced (left in place, like the old HomePageClient).
