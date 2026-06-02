import { describe, it, expect } from 'vitest'
import { ESG_QUESTIONS, type EsgResponse } from '@/lib/supplier-esg/questions'
import {
  getApplicableQuestions,
  isReadyToSubmit,
  DEFORESTATION_QUESTION_IDS,
} from '@/lib/supplier-esg/scoring'

const NON_DEFOREST_IDS = ESG_QUESTIONS.map((q) => q.id).filter(
  (id) => !DEFORESTATION_QUESTION_IDS.includes(id),
)

function answer(ids: string[], value: EsgResponse = 'yes'): Record<string, EsgResponse> {
  return Object.fromEntries(ids.map((id) => [id, value]))
}

describe('ESG submission applicability (deforestation conditional questions)', () => {
  it('a non-commodity supplier can submit without the deforestation questions', () => {
    const answers = answer(NON_DEFOREST_IDS)
    expect(isReadyToSubmit(answers, { hasCommodityProducts: false })).toBe(true)
    const ids = getApplicableQuestions(answers, { hasCommodityProducts: false }).map((q) => q.id)
    expect(ids).not.toContain('env_09')
    expect(ids).not.toContain('env_10')
  })

  it('defaults to not requiring the deforestation questions when no context is passed', () => {
    // This is the regression: previously isReadyToSubmit required ALL questions,
    // so a non-commodity supplier was stuck on env_09/env_10.
    expect(isReadyToSubmit(answer(NON_DEFOREST_IDS))).toBe(true)
  })

  it('a commodity supplier must answer env_09', () => {
    const answers = answer(NON_DEFOREST_IDS) // env_09/env_10 left blank
    expect(isReadyToSubmit(answers, { hasCommodityProducts: true })).toBe(false)
  })

  it('a commodity supplier answering env_09=no does not need env_10', () => {
    const answers = { ...answer(NON_DEFOREST_IDS), env_09: 'no' as EsgResponse }
    const ids = getApplicableQuestions(answers, { hasCommodityProducts: true }).map((q) => q.id)
    expect(ids).toContain('env_09')
    expect(ids).not.toContain('env_10')
    expect(isReadyToSubmit(answers, { hasCommodityProducts: true })).toBe(true)
  })

  it('a commodity supplier answering env_09=yes must also answer env_10', () => {
    const base = { ...answer(NON_DEFOREST_IDS), env_09: 'yes' as EsgResponse }
    expect(getApplicableQuestions(base, { hasCommodityProducts: true }).map((q) => q.id)).toContain('env_10')
    expect(isReadyToSubmit(base, { hasCommodityProducts: true })).toBe(false)
    expect(isReadyToSubmit({ ...base, env_10: 'yes' as EsgResponse }, { hasCommodityProducts: true })).toBe(true)
  })
})
