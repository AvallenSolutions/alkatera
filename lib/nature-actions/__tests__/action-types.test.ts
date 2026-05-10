import { describe, expect, it } from 'vitest'
import {
  NATURE_ACTION_TYPES,
  actionTypeValuePerHectare,
  getActionTypeMeta,
  SCORING_STATUSES,
} from '../action-types'

describe('actionTypeValuePerHectare (TNFD/SBTN-informed weights)', () => {
  it('peatland restoration carries the highest per-hectare value', () => {
    expect(actionTypeValuePerHectare('peatland_restoration')).toBe(1.0)
  })

  it('wetland creation and woodland restoration are next-highest', () => {
    expect(actionTypeValuePerHectare('wetland_creation')).toBe(0.95)
    expect(actionTypeValuePerHectare('woodland_restoration')).toBe(0.9)
  })

  it('regenerative agriculture and soil health get smaller per-hectare credit (improvement, not creation)', () => {
    expect(actionTypeValuePerHectare('regenerative_agriculture')).toBeLessThan(0.7)
    expect(actionTypeValuePerHectare('soil_health')).toBeLessThan(0.7)
  })

  it('returns 0 for unknown action types (under-credit by default)', () => {
    expect(actionTypeValuePerHectare(null)).toBe(0)
    expect(actionTypeValuePerHectare('mystery_action')).toBe(0)
  })
})

describe('getActionTypeMeta', () => {
  it('returns meta for every enum value', () => {
    for (const t of NATURE_ACTION_TYPES) {
      expect(getActionTypeMeta(t.value)).toEqual(t)
    }
  })

  it('returns null for unknown', () => {
    expect(getActionTypeMeta(null)).toBeNull()
    expect(getActionTypeMeta('unknown')).toBeNull()
  })
})

describe('SCORING_STATUSES', () => {
  it('includes in_progress and established only', () => {
    expect(SCORING_STATUSES.has('in_progress')).toBe(true)
    expect(SCORING_STATUSES.has('established')).toBe(true)
  })

  it('excludes planned, paused, ended', () => {
    expect(SCORING_STATUSES.has('planned')).toBe(false)
    expect(SCORING_STATUSES.has('paused')).toBe(false)
    expect(SCORING_STATUSES.has('ended')).toBe(false)
  })
})
