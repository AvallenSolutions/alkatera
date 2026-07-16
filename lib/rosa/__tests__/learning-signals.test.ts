import { describe, it, expect } from 'vitest'
import { jaccardWordOverlap, isLikelyRephrase, REPHRASE_WINDOW_MS } from '../learning-signals'

describe('jaccardWordOverlap', () => {
  it('is 1 for identical text', () => {
    expect(jaccardWordOverlap('what is my carbon footprint', 'what is my carbon footprint')).toBe(1)
  })

  it('ignores case, punctuation and word order', () => {
    const overlap = jaccardWordOverlap(
      'What is my Carbon Footprint?',
      'carbon footprint is what, my'
    )
    expect(overlap).toBe(1)
  })

  it('is 0 for completely different text', () => {
    expect(jaccardWordOverlap('how do I add a facility', 'thanks that helps a lot')).toBeLessThan(0.3)
  })

  it('is 0 when either side is empty', () => {
    expect(jaccardWordOverlap('', 'hello there')).toBe(0)
    expect(jaccardWordOverlap('hello there', '')).toBe(0)
    expect(jaccardWordOverlap('   ', 'hello')).toBe(0)
  })

  it('scores partial overlap between 0 and 1', () => {
    const overlap = jaccardWordOverlap(
      'what is my scope 3 footprint',
      'what is my scope 1 footprint'
    )
    expect(overlap).toBeGreaterThan(0)
    expect(overlap).toBeLessThan(1)
  })
})

describe('isLikelyRephrase', () => {
  const now = new Date('2026-07-16T12:00:00.000Z')

  it('true for a near-identical question asked again within the window', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'what is my carbon footprint this year',
      previousUserMessageAt: new Date(now.getTime() - 60_000).toISOString(),
      newUserMessage: 'what is my carbon footprint for this year',
      now,
    })
    expect(result).toBe(true)
  })

  it('false when the overlap is below the threshold', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'how do I add a new facility',
      previousUserMessageAt: new Date(now.getTime() - 60_000).toISOString(),
      newUserMessage: 'what is B Corp recertification',
      now,
    })
    expect(result).toBe(false)
  })

  it('false when the previous message is outside the time window', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'what is my carbon footprint this year',
      previousUserMessageAt: new Date(now.getTime() - REPHRASE_WINDOW_MS - 1000).toISOString(),
      newUserMessage: 'what is my carbon footprint for this year',
      now,
    })
    expect(result).toBe(false)
  })

  it('false when there is no previous user message', () => {
    const result = isLikelyRephrase({
      previousUserMessage: null,
      previousUserMessageAt: null,
      newUserMessage: 'what is my carbon footprint',
      now,
    })
    expect(result).toBe(false)
  })

  it('false when the new message is empty', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'what is my carbon footprint',
      previousUserMessageAt: new Date(now.getTime() - 60_000).toISOString(),
      newUserMessage: '   ',
      now,
    })
    expect(result).toBe(false)
  })

  it('true right at the edge of the window (inclusive)', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'what is my carbon footprint this year',
      previousUserMessageAt: new Date(now.getTime() - REPHRASE_WINDOW_MS).toISOString(),
      newUserMessage: 'what is my carbon footprint for this year',
      now,
    })
    expect(result).toBe(true)
  })

  it('false when the previous message timestamp is in the future (clock skew guard)', () => {
    const result = isLikelyRephrase({
      previousUserMessage: 'what is my carbon footprint this year',
      previousUserMessageAt: new Date(now.getTime() + 60_000).toISOString(),
      newUserMessage: 'what is my carbon footprint for this year',
      now,
    })
    expect(result).toBe(false)
  })
})
