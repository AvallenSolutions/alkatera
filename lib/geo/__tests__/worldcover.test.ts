import { describe, it, expect } from 'vitest'
import {
  worldCoverTile,
  worldCoverTileUrl,
  validateFarmlandCover,
  WORLDCOVER_CLASSES,
} from '../sources/worldcover'

describe('worldCoverTile', () => {
  it('names the 3°×3° tile by its south-west corner', () => {
    expect(worldCoverTile(44.85, 0.48)).toBe('N42E000')
    expect(worldCoverTile(41.8, -93.6)).toBe('N39W096')
    expect(worldCoverTile(48.857, 2.351)).toBe('N48E000')
  })
  it('handles the southern / western hemispheres', () => {
    expect(worldCoverTile(-34.6, -58.4)).toBe('S36W060')
  })
  it('builds the AWS COG url', () => {
    expect(worldCoverTileUrl(41.8, -93.6)).toBe(
      'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N39W096_Map.tif',
    )
  })
})

describe('validateFarmlandCover', () => {
  it('treats cropland / grassland / tree cover as a match', () => {
    expect(validateFarmlandCover(40).status).toBe('match') // Cropland
    expect(validateFarmlandCover(30).status).toBe('match') // Grassland
    expect(validateFarmlandCover(10).status).toBe('match') // Tree cover
  })
  it('flags built-up / water / bare / snow as a mismatch', () => {
    expect(validateFarmlandCover(50).status).toBe('mismatch') // Built-up
    expect(validateFarmlandCover(80).status).toBe('mismatch') // Permanent water
    expect(validateFarmlandCover(60).status).toBe('mismatch') // Bare
  })
  it('is unknown when there is no data', () => {
    const v = validateFarmlandCover(null)
    expect(v.status).toBe('unknown')
    expect(v.detectedLabel).toBeNull()
  })
  it('carries the detected label', () => {
    expect(validateFarmlandCover(50).detectedLabel).toBe(WORLDCOVER_CLASSES[50])
  })
})
