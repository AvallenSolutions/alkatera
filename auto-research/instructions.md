# Auto Research Engineer — Instructions

> This file is owned by the human (Tim). The AI may READ it but must NEVER edit it.
> It states the goal, the rules, and the loop. Based on Karpathy's
> "program, train, prepare" auto-research loop.

## The goal (plain English)

Make **alkatera's main authenticated pages load faster**. The more JavaScript the
browser must download and run before a page is usable, the slower it feels. We are
driving that weight down across the app's primary navigation, not just one page.

## The single number

`score` = **average First Load JS across the main pages, in KB** (from `next build`).
**Lower is better.** The page set is `MAIN_ROUTES` in the locked scoring file.

Averaging means the biggest lever — the JS chunk shared by every route — improves
the score on every page at once. Defined and measured by the locked scoring file
`auto-research/score.mjs`. The AI reads/runs that file to score; it never edits it
and never redefines "better".

## The three files

| File | Who owns it | AI may... |
|------|-------------|-----------|
| `auto-research/instructions.md` (this file) | Human | read only |
| `auto-research/score.mjs` (scoring) | Human | **read + run, never edit** |
| The **ASSET** (see scope below) | AI | **read + write** |

### Asset scope — the ONLY thing the AI may change

Source code in the `/dashboard` import graph:

- `app/(authenticated)/layout.tsx` and `app/(authenticated)/dashboard/**`
- Components, hooks, and lib modules that those files import, **where the edit's
  purpose is to reduce what loads on `/dashboard`** (e.g. dynamic-import a heavy
  client component, drop a barrel import, lazy-load charts/maps/editors).

Out of bounds: `score.mjs`, `instructions.md`, `next.config.js`, `package.json`
dependencies, anything unrelated to `/dashboard` load weight, and **functionality**
— the page must keep doing what it did. The build's type-check is the backstop.

## The rules

1. **One change per round.** One hypothesis, one edit (or one tight set serving
   one hypothesis), then score.
2. **The scoring file is law.** Win = score strictly lower than the current
   baseline. No other justification counts. Don't argue the number.
3. **Natural selection.** Beats baseline → keep, it becomes the new baseline.
   Does not beat it → **revert** that change and try a different idea.
4. **Never touch functionality to win.** If the build fails or the route
   disappears, the gate scores it Infinity (an automatic loss).
5. **Never edit the scoring file or this file.** No moving goalposts.
6. **Log every round** in `auto-research/results.md`: round #, hypothesis,
   change, score before → after, kept/reverted.

## The loop

Run in short loops, overnight, indefinitely, until the goal is hit or Tim stops it.
Each loop is one production build, so a loop is build-bound (a few minutes), not
literally 5 minutes — that's fine.

1. Record current baseline asset + score.
2. Form ONE hypothesis; make ONE change to the asset.
3. Score it with `score.mjs` ONLY.
4. Lower than baseline → keep (new baseline). Not lower → revert, try another.
5. Repeat. Log each round.

## Stop / goal

No hard target set yet. Run indefinitely. Tim can set a target KB here (e.g.
"stop at X KB") or just say stop. Good morning report on request.
