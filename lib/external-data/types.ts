/**
 * Foundation A: external reference-data ingestion — shared types.
 *
 * A `FactorLoader` turns a public dataset (DESNZ GHG conversion factors, EPA
 * USEEIO spend factors, ...) into a list of `ParsedFactor`s plus the metadata
 * describing that release (`FactorSetSpec`). The generic upsert
 * (`lib/external-data/upsert.ts`) writes them into `factor_sets` /
 * `reference_factors` with version history, and the Inngest loader
 * (`lib/inngest/functions/reference-data.ts`) drives it in the background.
 *
 * This generalises the Agribalyse-backfill pattern: instead of a hardcoded
 * target list, each loader supplies its own factors (today from a curated,
 * fully-sourced constant; a live gov.uk / data.gov fetch+parse can be added to
 * an individual loader later without touching this contract).
 */

/** The kind of factor — picks which calculator surface reads it. */
export type FactorKind = 'grid' | 'utility' | 'spend' | 'fuel'

/** A single factor row, provider-agnostic. */
export interface ParsedFactor {
  kind: FactorKind
  /** e.g. 'GB' (grid), 'natural_gas' (utility), 'grid_electricity' (spend). */
  lookupKey: string
  scope?: 'Scope 1' | 'Scope 2' | 'Scope 3' | null
  factor: number
  /** e.g. 'kgCO2e/kWh', 'kgCO2e/litre', 'kgCO2e/GBP'. */
  unit: string
  /** 0-1, optional. */
  uncertainty?: number
  /** ISO code / region. null/undefined = applies anywhere (e.g. a UK-only set). */
  geographicScope?: string | null
  metadata?: Record<string, unknown>
}

/** Describes one dataset release. */
export interface FactorSetSpec {
  provider: string            // 'DESNZ'
  dataset: string             // 'ghg_conversion_factors'
  version: string             // '2024'
  /** ISO date the release becomes authoritative, e.g. '2024-06-01'. */
  validFrom: string
  licence: string             // 'OGL-3.0' | 'public-domain' | 'CC-BY-4.0'
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

/** A loader the admin UI can list and run. */
export interface FactorLoader {
  /** Stable key used by the admin route + Inngest event. */
  key: string
  /** Human label for the admin card. */
  label: string
  /** One-line description for the admin card. */
  description: string
  spec: FactorSetSpec
  /** Produce the factors for this release. */
  load: () => Promise<ParsedFactor[]>
}

export interface LoadFactorSetResult {
  provider: string
  dataset: string
  version: string
  factorsInserted: number
  supersededVersion: string | null
}
