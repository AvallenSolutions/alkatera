import { describe, it, expect } from 'vitest'
import { scoreExemplars, formatExemplarBlock, type ExemplarRow, type ScoredExemplar } from '../exemplars'

const EXEMPLARS: ExemplarRow[] = [
  { id: 'e1', question: 'What is my scope 3 footprint?', ideal_answer: 'Your scope 3 footprint is 42 tonnes CO2e, driven mostly by ingredients.', tags: ['scope3'] },
  { id: 'e2', question: 'How do I add a facility?', ideal_answer: 'Go to Facilities and click Add. You only need the address and utility type to start.', tags: ['setup'] },
  { id: 'e3', question: 'What counts as scope 3?', ideal_answer: 'Scope 3 covers everything upstream and downstream of your own operations.', tags: ['scope3'] },
]

describe('scoreExemplars', () => {
  it('scores and sorts by overlap with the user message, highest first', () => {
    const scored = scoreExemplars('what is my scope 3 emissions total', EXEMPLARS)
    expect(scored.length).toBeGreaterThan(0)
    expect(scored[0].id).toBe('e1')
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score)
    }
  })

  it('drops zero-overlap exemplars', () => {
    const scored = scoreExemplars('thanks that was helpful', EXEMPLARS)
    // "thanks that was helpful" shares no meaningful words with any question
    expect(scored.every((s) => s.score > 0)).toBe(true)
  })

  it('returns an empty array for an empty message', () => {
    expect(scoreExemplars('', EXEMPLARS)).toEqual([])
    expect(scoreExemplars('   ', EXEMPLARS)).toEqual([])
  })

  it('returns an empty array when nothing overlaps at all', () => {
    const scored = scoreExemplars('xyzzy plugh quux', EXEMPLARS)
    expect(scored).toEqual([])
  })
})

describe('formatExemplarBlock', () => {
  const scoredOf = (rows: ExemplarRow[]): ScoredExemplar[] => rows.map((r) => ({ ...r, score: 1 }))

  it('returns null for an empty list', () => {
    expect(formatExemplarBlock([])).toBeNull()
  })

  it('includes the injection-hardening preamble and delimiters', () => {
    const block = formatExemplarBlock(scoredOf(EXEMPLARS.slice(0, 1)))
    expect(block).toContain('illustrative reference material')
    expect(block).toContain('<worked_examples>')
    expect(block).toContain('</worked_examples>')
    expect(block).toContain('What is my scope 3 footprint?')
  })

  it('sheds the lowest-scoring (last) exemplar first to fit the char budget', () => {
    const long: ExemplarRow = {
      id: 'long',
      question: 'A very long question that goes on and on',
      ideal_answer: 'x'.repeat(2000),
      tags: [],
    }
    const block = formatExemplarBlock([...scoredOf(EXEMPLARS.slice(0, 1)), { ...long, score: 0.5 }], { maxChars: 900 })
    expect(block).not.toBeNull()
    expect(block).not.toContain('A very long question')
    expect(block).toContain('What is my scope 3 footprint?')
  })

  it('returns null when even a single exemplar exceeds the budget', () => {
    const long: ExemplarRow = { id: 'long', question: 'q', ideal_answer: 'x'.repeat(5000), tags: [] }
    const block = formatExemplarBlock(scoredOf([long]), { maxChars: 500 })
    expect(block).toBeNull()
  })

  it('never truncates mid-text -- the full ideal_answer or nothing', () => {
    const block = formatExemplarBlock(scoredOf(EXEMPLARS.slice(0, 1)), { maxChars: 5000 })
    expect(block).toContain('Your scope 3 footprint is 42 tonnes CO2e, driven mostly by ingredients.')
  })
})
