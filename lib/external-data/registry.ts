/**
 * Foundation A: registry of available reference-data loaders.
 *
 * Add a loader here and it appears in the admin UI and becomes loadable via the
 * `reference-data/load.requested` Inngest event. USEEIO (Scope 3 spend) is the
 * next loader to slot in alongside DESNZ.
 */

import type { FactorLoader } from './types'
import { desnzLoader } from './loaders/desnz'
import { useeioLoader } from './loaders/useeio'

export const REFERENCE_LOADERS: Record<string, FactorLoader> = {
  [desnzLoader.key]: desnzLoader,
  [useeioLoader.key]: useeioLoader,
}

export function getLoader(key: string): FactorLoader | undefined {
  return REFERENCE_LOADERS[key]
}

export function listLoaders(): FactorLoader[] {
  return Object.values(REFERENCE_LOADERS)
}
