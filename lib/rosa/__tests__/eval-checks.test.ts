import { describe, it, expect } from 'vitest'
import { checkExpectations } from '../eval-checks'
import type { RunToolLoopResult } from '../run-tool-loop'

function result(overrides: Partial<RunToolLoopResult>): RunToolLoopResult {
  return {
    text: '',
    tools: [],
    rounds: 1,
    stopped_early: false,
    ...overrides,
  }
}

describe('checkExpectations', () => {
  it('returns no checks when no expectations are set', () => {
    expect(checkExpectations({}, result({ text: 'hello' }))).toEqual([])
  })

  it('must_call_tool passes when the tool was called', () => {
    const r = result({ tools: [{ name: 'get_product_footprint', input: {}, is_error: false, preview: '', audit: {} }] })
    const checks = checkExpectations({ must_call_tool: 'get_product_footprint' }, r)
    expect(checks).toHaveLength(1)
    expect(checks[0].pass).toBe(true)
  })

  it('must_call_tool fails when the tool was not called', () => {
    const checks = checkExpectations({ must_call_tool: 'get_product_footprint' }, result({}))
    expect(checks[0].pass).toBe(false)
  })

  it('must_mention passes only when every phrase is present (case-insensitive)', () => {
    const r = result({ text: 'Your Scope 3 footprint is 42 tonnes CO2e.' })
    expect(checkExpectations({ must_mention: 'scope 3' }, r)[0].pass).toBe(true)
    expect(checkExpectations({ must_mention: ['scope 3', '42 tonnes'] }, r)[0].pass).toBe(true)
    expect(checkExpectations({ must_mention: ['scope 3', 'scope 1'] }, r)[0].pass).toBe(false)
  })

  it('must_cite_wiki passes only when the answer contains a link', () => {
    expect(checkExpectations({ must_cite_wiki: true }, result({ text: 'See https://alkatera.com/wiki/scope-3' }))[0].pass).toBe(true)
    expect(checkExpectations({ must_cite_wiki: true }, result({ text: 'No link here.' }))[0].pass).toBe(false)
  })

  it('must_propose_not_write passes when no completion is claimed', () => {
    const checks = checkExpectations({ must_propose_not_write: true }, result({ text: 'Here is what I found.' }))
    expect(checks[0].pass).toBe(true)
  })

  it('must_propose_not_write passes when a completion claim is backed by a proposal tool call', () => {
    const r = result({
      text: "I've filed a support ticket for you.",
      tools: [{ name: 'propose_support_ticket', input: {}, is_error: false, preview: '', audit: {} }],
    })
    expect(checkExpectations({ must_propose_not_write: true }, r)[0].pass).toBe(true)
  })

  it('must_propose_not_write fails when a completion is claimed with no backing tool call', () => {
    const r = result({ text: 'I have saved your changes.', tools: [] })
    expect(checkExpectations({ must_propose_not_write: true }, r)[0].pass).toBe(false)
  })

  it('combines multiple expectations, all must pass', () => {
    const r = result({
      text: 'Your scope 3 footprint is 42 tonnes. See https://alkatera.com/wiki/scope-3',
      tools: [{ name: 'get_product_footprint', input: {}, is_error: false, preview: '', audit: {} }],
    })
    const checks = checkExpectations(
      { must_call_tool: 'get_product_footprint', must_mention: 'scope 3', must_cite_wiki: true },
      r,
    )
    expect(checks.every((c) => c.pass)).toBe(true)
  })
})
