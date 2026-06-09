# Production-run resource data: implausible-intensity guard

## Context
Two near-identical SKUs (products 107 = 6x pack, 139 = 4x pack) produced very
different "Processing" footprints. Root cause confirmed in production data:
`production_run_resource_data` rows share an identical `water_intake_m3 = 300`
(a facility-period figure copy-pasted onto each product run), and the 4x pack run
was logged as a half-day, 1,200-unit micro-batch. The Direct Run Data path divides
run resources by the run's own production volume with no attribution, so the
4x pack absorbed 250 L water/unit and 0.75 kWh/unit vs 6.2 L and 0.167 kWh on the
6x pack. No code bug; the calculator faithfully processed bad input.

## Systemic fix (this change)
Catch implausible per-unit run intensities before they reach a published report.

- [ ] 1. lib/validation/production-run-sanity.ts: pure utility computing per-unit
      water (L/unit) and electricity (kWh/unit) intensities, returning warnings when
      they exceed conservative, documented ceilings.
- [ ] 2. lib/__tests__/production-run-sanity.test.ts: vitest coverage incl. the real
      4x pack (250 L/unit -> flagged) and 6x pack (6.2 L/unit -> clean) numbers.
- [ ] 3. Wire into components/facilities/ProductionRunDataEntry.tsx: live amber
      warning banner in the Add dialog when entered figures look implausible
      (non-blocking, prominent). Catches the error at entry time.
- [ ] 4. Calculation-time guard in lib/product-lca-calculator.ts Direct Run Data
      path: console.warn mirroring the existing attribution>1 pattern.

## Out of scope (client must correct in UI; see instructions)
- Correcting product 139's run data (water 300 m3 wrong; volume 1,200 likely wrong).

## Verification
- [ ] vitest passes for the new test
- [ ] tsc clean for touched files
- [ ] Review section completed

## Review (completed)
- Added lib/validation/production-run-sanity.ts: pure `checkRunIntensity()` with
  documented, generous per-unit ceilings (water 50 L/unit, electricity 5 kWh/unit
  for discrete Units; scaled bases for Litres/Hectolitres/kg). Unknown units fall
  back to the conservative Units basis.
- Added lib/__tests__/production-run-sanity.test.ts (8 tests) covering the real
  incident data: 4x pack 250 L/unit flagged, 6x pack 6.2 L/unit clean, 60ml clean.
- Wired a live amber warning banner into ProductionRunDataEntry.tsx Add dialog
  (non-blocking, recomputed via useMemo from current form state).
- Added a calculation-time console.warn guard in the Direct Run Data path of
  lib/product-lca-calculator.ts, mirroring the existing attribution>1 warning.
- Verified: 8/8 new tests pass; calculator maturation suite still 13/13; tsc clean
  for all touched files.
- NOT changed: client production data (out of scope; client to correct via UI).
