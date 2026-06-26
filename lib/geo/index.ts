/**
 * Foundation B: geospatial point-lookup. Public surface.
 */

export type { GeoDataset, GeoLookupResult } from './types'
export { lookupPoint, roundCoord } from './point-lookup'
export {
  WORLDCOVER_CLASSES,
  worldCoverTile,
  validateFarmlandCover,
  type LandCoverValidation,
} from './sources/worldcover'
export {
  runSoilBaseline,
  planBaselineWrite,
  buildBaselineRow,
  SOILGRIDS_LAB,
  type LandUnitType,
  type SoilBaselineParams,
} from './soil-baseline'
