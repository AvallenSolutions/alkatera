import { describe, expect, it } from 'vitest'
import { validateCuratedTiles } from '../priority-tiles-validate'

const ORG = 'org-1234-aaaa-bbbb-cccc-1111'
const USER = 'user-1234-aaaa-bbbb-cccc-2222'

const baseTile = {
  kind: 'queue',
  value: '5',
  unit: 'items',
  title: 'Waiting your sign-off',
  hint: '5 documents are queued.',
  recommendation: 'Quick wins.',
  icon: 'Inbox',
  href: '/admin/approvals/',
  tone: 'urgent',
  signal_basis: ['queue.open_count'],
}

describe('validateCuratedTiles', () => {
  it('keeps a well-formed tile', () => {
    const r = validateCuratedTiles(
      { tiles: [baseTile] },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles).toHaveLength(1)
    expect(r.drops).toHaveLength(0)
  })

  it('drops tiles missing title or hint', () => {
    const r = validateCuratedTiles(
      // Use a non-numeric value so we get past the value-sanity check first
      // and exercise the title-required path the test is targeting.
      { tiles: [{ ...baseTile, value: 'overdue', title: '' }] },
      { organizationId: ORG, userId: USER, signalPack: {} },
    )
    expect(r.tiles).toHaveLength(0)
    expect(r.drops[0].reason).toMatch(/missing-title-or-hint/)
  })

  it('drops tiles whose value is a number not in the signal pack', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, value: '99' }] },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles).toHaveLength(0)
    expect(r.drops[0].reason).toMatch(/not in signal pack/)
  })

  it('allows non-numeric values without sanity-checking the pack', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, value: 'overdue' }] },
      { organizationId: ORG, userId: USER, signalPack: {} },
    )
    expect(r.tiles).toHaveLength(1)
  })

  it('always allows 0 and 1 as values even if not in the pack', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, value: '1' }] },
      { organizationId: ORG, userId: USER, signalPack: {} },
    )
    expect(r.tiles).toHaveLength(1)
  })

  it('strips an out-of-allowlist href but keeps the tile', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, href: '/random/place' }] },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles).toHaveLength(1)
    expect(r.tiles[0].href).toBeNull()
    expect(r.drops.find(d => d.reason.includes('rejected'))).toBeTruthy()
  })

  it('falls back to Sparkles for unknown icons', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, icon: 'NotARealIcon' }] },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles[0].icon).toBe('Sparkles')
  })

  it('falls back to info tone for unknown tones', () => {
    const r = validateCuratedTiles(
      { tiles: [{ ...baseTile, tone: 'apocalyptic' }] },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles[0].tone).toBe('info')
  })

  it('caps at 3 tiles even when more are sent', () => {
    const r = validateCuratedTiles(
      {
        tiles: [
          { ...baseTile },
          { ...baseTile, kind: 'a' },
          { ...baseTile, kind: 'b' },
          { ...baseTile, kind: 'c' },
        ],
      },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles).toHaveLength(3)
    expect(r.drops.find(d => d.reason === 'over-3-tiles')).toBeTruthy()
  })

  it('scrubs em dashes from copy', () => {
    const r = validateCuratedTiles(
      {
        tiles: [
          {
            ...baseTile,
            title: 'Three things — go now',
            hint: 'Five queued — quick wins',
            recommendation: 'Block 30 minutes — clear them.',
          },
        ],
      },
      { organizationId: ORG, userId: USER, signalPack: { queue: { open_count: 5 } } },
    )
    expect(r.tiles[0].title).not.toMatch(/—/)
    expect(r.tiles[0].hint).not.toMatch(/—/)
    expect(r.tiles[0].recommendation).not.toMatch(/—/)
  })

  it('accepts an empty tiles array without throwing', () => {
    const r = validateCuratedTiles(
      { tiles: [] },
      { organizationId: ORG, userId: USER, signalPack: {} },
    )
    expect(r.tiles).toHaveLength(0)
  })

  it('handles non-array tiles input gracefully', () => {
    const r = validateCuratedTiles(
      { tiles: 'not an array' },
      { organizationId: ORG, userId: USER, signalPack: {} },
    )
    expect(r.tiles).toHaveLength(0)
  })
})
