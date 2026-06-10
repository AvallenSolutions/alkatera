# Code review remediation (from CODE_REVIEW_2026-06-10.md)

(Previous FY-aware reporting plan completed and committed: 86454144 and earlier.)

Working one by one, verifying each before moving on.

## Critical / High
- [x] B1: Recycled-content credit applied twice (calculator + aggregator)
- [x] B2: Inbound transport excluded from headline LCA total
- [x] S1: Carbon-budgets IDOR (membership check on GET) + same hole found in shadow-prices
- [ ] S2: Greenwash public scanner SSRF (use safeFetch)
- [ ] S4: .gitignore business documents
- [ ] R1: Stripe webhook idempotency + lost events
- [ ] B3: natural_gas_m3 dropped + m3/m³ unit mismatch
- [ ] B4: Maturation ABV dilution in persisted LCA path
- [ ] B5: OpenLCA error misclassification (uncommitted code)
- [ ] B6: Corporate Scope 3 double counts (Cat 9/4/11)
- [ ] B7: Xero suppression single-month + no pro-rating
- [ ] B8: Facility per-unit conversion litres vs functional units
- [ ] R2: Inngest dead retries + stranded enrich jobs + grounded-search timeout
- [ ] R3: Xero token-refresh race + cron fan-out to Inngest
- [ ] P1: Corporate emissions N+1 + move server-side
- [ ] P2: Report PDF generation to Inngest

## Medium / Low (after the above)
- [ ] B9-B18 calculation mediums (EF 3.1 parsing, cache categories, biogenic split, factor drift, audit log, viticulture allocation)
- [ ] B19-B25 general mediums/lows (onboarding debounce, org switch role, notify double-send, pulse NaN) — B22 vitest exclude DONE
- [ ] S3: procurement RPC caller check
- [ ] S5: error.message sweep (serverErrorResponse rollout)
- [ ] R4: SlideSpeak stuck states
- [ ] R5: validation rollout (parseFiniteNumber + zod)
- [ ] R6: Inngest claim error checks
- [ ] P3-P8 performance mediums

## Review log
- S1 (2026-06-10): Membership check added to resolveOrg in carbon-budgets AND
  shadow-prices (swept all 17 copies of the pattern across app/api/pulse; these
  two were the only ones missing it; facility-impact/layout/peer-benchmark/
  targets use the cookie-scoped anon client so RLS constrains them). tsc clean.
- B2 (2026-06-10): Aggregator now adds each material's impact_transport to the
  headline total, scope 3, fossil totals, stage bucket and by_material entry,
  exactly once: skipped when the row's decomposition fields
  (impact_climate_production + impact_climate_transport_embedded) show the
  calculator already replaced transport into impact_climate. Implemented in the
  aggregator (not the calculator) so all existing persisted PCFs are corrected
  on next aggregation without recalc, and storage keeps factor vs transport
  separate. Synthetic rows persist impact_transport = 0 so are unaffected.
  transport_note/integrity comments updated; 10 tests updated to the corrected
  semantics + 1 new decomposition no-double-count test. lib suite: 3040 pass,
  only the 4 pre-existing unrelated failures (distributor x3, rosa) remain.
- B1 (2026-06-10): Credit now applied once, in the calculator at persist time.
  Removed the aggregator's re-credit block (its recycledContentCredit accumulator
  was never read, so nothing downstream lost). Found and fixed a wider pinned-mode
  bug than the review flagged: pinned materials re-applied reuse amortisation,
  recycled credit, units_per_group allocation AND inbound-container carbon to
  stored values that already embed them; all four now skipped when pinned.
  Regression test added (aggregator passes stored credited values through
  unchanged). 135 calculator/aggregator tests green, tsc clean.
  NOTE: PCFs with recycled packaging calculated while both credit blocks were
  live are understated; recalculate after deploy.
- B22 (2026-06-10, pulled forward): vitest exclude now covers .claude/** so
  stale worktree checkouts stop producing hundreds of spurious failures (they
  were also matching named-file runs, blocking B1 verification).
