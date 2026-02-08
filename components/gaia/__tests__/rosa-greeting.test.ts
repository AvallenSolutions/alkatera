import { describe, it, expect } from 'vitest'
import type { PersonalizationData } from '@/lib/onboarding/types'

/**
 * Tests for the Rosa personalised greeting logic.
 *
 * We extract and test the pure generateRosaGreeting function directly
 * rather than rendering the full GaiaChat component (which has heavy
 * dependencies on Supabase, streaming, etc.)
 */

// ── Extracted greeting logic (mirrors GaiaChat.tsx implementation) ────────

function generateRosaGreeting(
  personalization?: PersonalizationData
): { subtitle: string; body: string } | null {
  if (
    !personalization ||
    (!personalization.role &&
      !personalization.beverageTypes?.length &&
      !personalization.primaryGoals?.length)
  ) {
    return null
  }

  const beverageMap: Record<string, string> = {
    beer: 'beer',
    spirits: 'spirits',
    wine: 'wine',
    cider: 'cider',
    non_alcoholic: 'non-alcoholic beverages',
    rtd: 'RTDs',
  }
  const beverageText = personalization.beverageTypes?.length
    ? personalization.beverageTypes
        .map((b) => beverageMap[b] || b.replace('_', ' '))
        .join(' and ')
    : null

  const roleMap: Record<string, string> = {
    sustainability_manager: 'sustainability manager',
    operations_manager: 'operations manager',
    founder_executive: 'founder',
    production_manager: 'production manager',
    consultant_advisor: 'advisor',
  }
  const roleText = personalization.role
    ? roleMap[personalization.role] ||
      personalization.roleOther ||
      personalization.role.replace('_', ' ')
    : null

  const goalMap: Record<string, string> = {
    track_emissions: 'tracking your emissions',
    reduce_impact: 'reducing your environmental impact',
    sustainability_reporting: 'sustainability reporting',
    get_certified: 'getting certified',
    supply_chain: 'supply chain transparency',
    understand_footprint: 'understanding your footprint',
    learning: 'learning about sustainability',
  }
  const goalText = personalization.primaryGoals?.[0]
    ? goalMap[personalization.primaryGoals[0]]
    : null

  const subtitle = roleText
    ? `Here to help you as a ${roleText}${beverageText ? ` in ${beverageText}` : ''}`
    : 'Your sustainability companion'

  let body = 'I already know a bit about you from our chat during setup. '
  if (goalText) body += `Since you\u2019re focused on ${goalText}, `
  body +=
    'I can explore your data, uncover insights, and suggest practical next steps. Ask me anything!'

  return { subtitle, body }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('generateRosaGreeting', () => {
  it('should return null when personalization is undefined', () => {
    expect(generateRosaGreeting(undefined)).toBeNull()
  })

  it('should return null when personalization is empty', () => {
    expect(generateRosaGreeting({})).toBeNull()
  })

  it('should return null when all personalization fields are empty arrays', () => {
    expect(
      generateRosaGreeting({
        beverageTypes: [],
        primaryGoals: [],
      })
    ).toBeNull()
  })

  it('should personalise subtitle with role only', () => {
    const result = generateRosaGreeting({
      role: 'sustainability_manager',
    })

    expect(result).not.toBeNull()
    expect(result!.subtitle).toBe('Here to help you as a sustainability manager')
  })

  it('should personalise subtitle with role and beverages', () => {
    const result = generateRosaGreeting({
      role: 'founder_executive',
      beverageTypes: ['beer', 'spirits'],
    })

    expect(result!.subtitle).toBe('Here to help you as a founder in beer and spirits')
  })

  it('should personalise subtitle with single beverage type', () => {
    const result = generateRosaGreeting({
      role: 'operations_manager',
      beverageTypes: ['wine'],
    })

    expect(result!.subtitle).toBe('Here to help you as a operations manager in wine')
  })

  it('should handle non-alcoholic beverages', () => {
    const result = generateRosaGreeting({
      role: 'production_manager',
      beverageTypes: ['non_alcoholic'],
    })

    expect(result!.subtitle).toBe(
      'Here to help you as a production manager in non-alcoholic beverages'
    )
  })

  it('should use roleOther for "other" role type', () => {
    const result = generateRosaGreeting({
      role: 'other',
      roleOther: 'quality engineer',
    })

    expect(result!.subtitle).toBe('Here to help you as a quality engineer')
  })

  it('should include goal in body when provided', () => {
    const result = generateRosaGreeting({
      role: 'sustainability_manager',
      primaryGoals: ['track_emissions'],
    })

    expect(result!.body).toContain('tracking your emissions')
    expect(result!.body).toContain('I already know a bit about you')
  })

  it('should include reduce_impact goal', () => {
    const result = generateRosaGreeting({
      role: 'founder_executive',
      primaryGoals: ['reduce_impact'],
    })

    expect(result!.body).toContain('reducing your environmental impact')
  })

  it('should use first goal when multiple are provided', () => {
    const result = generateRosaGreeting({
      role: 'sustainability_manager',
      primaryGoals: ['sustainability_reporting', 'get_certified'],
    })

    expect(result!.body).toContain('sustainability reporting')
    expect(result!.body).not.toContain('getting certified')
  })

  it('should return generic subtitle when no role but has beverages', () => {
    const result = generateRosaGreeting({
      beverageTypes: ['beer'],
    })

    expect(result!.subtitle).toBe('Your sustainability companion')
  })

  it('should still generate when only goals are provided', () => {
    const result = generateRosaGreeting({
      primaryGoals: ['understand_footprint'],
    })

    expect(result).not.toBeNull()
    expect(result!.body).toContain('understanding your footprint')
  })

  it('should use advisor role mapping for consultant_advisor', () => {
    const result = generateRosaGreeting({
      role: 'consultant_advisor',
    })

    expect(result!.subtitle).toBe('Here to help you as a advisor')
  })

  it('should always end body with ask me anything prompt', () => {
    const result = generateRosaGreeting({
      role: 'founder_executive',
      primaryGoals: ['get_certified'],
    })

    expect(result!.body).toContain('Ask me anything!')
  })

  it('should handle RTD beverage type', () => {
    const result = generateRosaGreeting({
      role: 'production_manager',
      beverageTypes: ['rtd'],
    })

    expect(result!.subtitle).toContain('RTDs')
  })

  it('should handle cider beverage type', () => {
    const result = generateRosaGreeting({
      role: 'founder_executive',
      beverageTypes: ['cider'],
    })

    expect(result!.subtitle).toBe('Here to help you as a founder in cider')
  })

  it('should handle all beverage types combined', () => {
    const result = generateRosaGreeting({
      role: 'founder_executive',
      beverageTypes: ['beer', 'wine', 'spirits'],
    })

    expect(result!.subtitle).toBe(
      'Here to help you as a founder in beer and wine and spirits'
    )
  })

  it('body should not contain goal clause when no goals provided', () => {
    const result = generateRosaGreeting({
      role: 'sustainability_manager',
    })

    expect(result!.body).not.toContain('Since you')
    expect(result!.body).toContain('I already know a bit about you')
  })

  it('should handle learning goal', () => {
    const result = generateRosaGreeting({
      primaryGoals: ['learning'],
    })

    expect(result!.body).toContain('learning about sustainability')
  })

  it('should handle supply_chain goal', () => {
    const result = generateRosaGreeting({
      primaryGoals: ['supply_chain'],
    })

    expect(result!.body).toContain('supply chain transparency')
  })
})
