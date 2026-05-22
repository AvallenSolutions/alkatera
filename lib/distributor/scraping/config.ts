/**
 * Tunable thresholds for the directory-first scrape gate.
 *
 * Phase 3 of the proactive-data programme: before queueing a scrape
 * for a brand, the dispatcher checks the canonical directory. If the
 * brand already has comprehensive, recent data the scrape is skipped
 * (still runnable on-demand via the "Refresh data" button).
 *
 * Both thresholds live here so they can be tuned without redeploying
 * code. Defaults reflect "comprehensive enough to skip" — a brand
 * with at least 70% completeness AND a finding seen in the last 90
 * days.
 */

/** Minimum brand_directory.completeness_score (0..100) to consider skipping. */
export const SCRAPE_GATE_COMPLETENESS_THRESHOLD = 70;

/** Maximum age (in days) of the freshest scraped finding to consider skipping. */
export const SCRAPE_GATE_FRESHNESS_DAYS = 90;
