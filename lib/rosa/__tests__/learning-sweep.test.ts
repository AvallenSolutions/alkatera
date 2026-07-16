import { describe, it, expect } from 'vitest'
import {
  clusterKnowledgeMisses,
  clusterProposalCancellations,
  clusterConversationSignals,
  matchNearestConversation,
  type KnowledgeMissEvent,
  type ProposalCancelledEvent,
  type ConversationWindow,
} from '../learning-sweep'

describe('clusterKnowledgeMisses', () => {
  it('groups near-identical queries into one cluster', () => {
    const events: KnowledgeMissEvent[] = [
      { query: 'what is scope 3', organizationId: 'org-a', createdAt: '2026-07-10T00:00:00Z' },
      { query: 'what is scope 3?', organizationId: 'org-a', createdAt: '2026-07-11T00:00:00Z' },
      { query: 'scope 3, what is it', organizationId: 'org-b', createdAt: '2026-07-12T00:00:00Z' },
    ]
    const cases = clusterKnowledgeMisses(events)
    expect(cases).toHaveLength(1)
    expect(cases[0].kind).toBe('missing_knowledge')
    expect((cases[0].evidence.count as number)).toBe(3)
    expect(cases[0].organizationId).toBeNull() // spans org-a and org-b
  })

  it('keeps unrelated queries in separate clusters', () => {
    const events: KnowledgeMissEvent[] = [
      { query: 'what is scope 3', organizationId: 'org-a', createdAt: '2026-07-10T00:00:00Z' },
      { query: 'how do I add a facility', organizationId: 'org-a', createdAt: '2026-07-11T00:00:00Z' },
    ]
    const cases = clusterKnowledgeMisses(events)
    expect(cases).toHaveLength(2)
  })

  it('single-org cluster keeps its organisation id', () => {
    const events: KnowledgeMissEvent[] = [
      { query: 'what is EPR', organizationId: 'org-a', createdAt: '2026-07-10T00:00:00Z' },
      { query: 'what is EPR?', organizationId: 'org-a', createdAt: '2026-07-11T00:00:00Z' },
    ]
    const cases = clusterKnowledgeMisses(events)
    expect(cases[0].organizationId).toBe('org-a')
  })

  it('ignores empty queries and returns no clusters for an empty list', () => {
    expect(clusterKnowledgeMisses([])).toEqual([])
    expect(clusterKnowledgeMisses([{ query: '  ', organizationId: 'org-a', createdAt: 'x' }])).toEqual([])
  })

  it('produces a stable cluster_key for dedupe', () => {
    const events: KnowledgeMissEvent[] = [
      { query: 'What Is Scope 3?', organizationId: 'org-a', createdAt: '2026-07-10T00:00:00Z' },
    ]
    const cases = clusterKnowledgeMisses(events)
    expect(cases[0].evidence.cluster_key).toBe('missing_knowledge:what-is-scope-3')
  })
})

describe('clusterProposalCancellations', () => {
  it('groups by exact tool name', () => {
    const events: ProposalCancelledEvent[] = [
      { toolName: 'propose_support_ticket', organizationId: 'org-a', createdAt: '2026-07-10T00:00:00Z' },
      { toolName: 'propose_support_ticket', organizationId: 'org-b', createdAt: '2026-07-11T00:00:00Z' },
      { toolName: 'propose_save_bcorp_answer', organizationId: 'org-a', createdAt: '2026-07-12T00:00:00Z' },
    ]
    const cases = clusterProposalCancellations(events)
    expect(cases).toHaveLength(2)
    const ticketCase = cases.find((c) => c.evidence.tool_name === 'propose_support_ticket')!
    expect(ticketCase.kind).toBe('wrong_tool')
    expect(ticketCase.evidence.count).toBe(2)
    expect(ticketCase.organizationId).toBeNull() // org-a + org-b
  })

  it('returns nothing for an empty list', () => {
    expect(clusterProposalCancellations([])).toEqual([])
  })
})

describe('clusterConversationSignals', () => {
  it('classifies wrong_data when not_right feedback is present', () => {
    const cases = clusterConversationSignals({
      feedback: [
        {
          conversationId: 'conv-1',
          organizationId: 'org-a',
          verdict: 'not_right',
          question: 'What is my scope 1 footprint?',
          answerExcerpt: 'Your scope 1 footprint is 12 tonnes.',
          messageId: 'msg-1',
          createdAt: '2026-07-10T00:00:00Z',
        },
      ],
      rephrases: [],
      ticketsAfterAnswer: [],
    })
    expect(cases).toHaveLength(1)
    expect(cases[0].kind).toBe('wrong_data')
    expect(cases[0].evidence.conversation_id).toBe('conv-1')
    expect(cases[0].evidence.question).toBe('What is my scope 1 footprint?')
  })

  it('classifies wrong_tone when only too_vague feedback is present', () => {
    const cases = clusterConversationSignals({
      feedback: [
        {
          conversationId: 'conv-2',
          organizationId: 'org-a',
          verdict: 'too_vague',
          question: 'How do I improve my score?',
          answerExcerpt: null,
          messageId: 'msg-2',
          createdAt: '2026-07-10T00:00:00Z',
        },
      ],
      rephrases: [],
      ticketsAfterAnswer: [],
    })
    expect(cases[0].kind).toBe('wrong_tone')
  })

  it('not_right takes precedence over too_vague in the same conversation', () => {
    const cases = clusterConversationSignals({
      feedback: [
        {
          conversationId: 'conv-3',
          organizationId: 'org-a',
          verdict: 'too_vague',
          question: 'q1',
          answerExcerpt: null,
          messageId: 'msg-3a',
          createdAt: '2026-07-10T00:00:00Z',
        },
        {
          conversationId: 'conv-3',
          organizationId: 'org-a',
          verdict: 'not_right',
          question: 'q1 again',
          answerExcerpt: null,
          messageId: 'msg-3b',
          createdAt: '2026-07-10T00:05:00Z',
        },
      ],
      rephrases: [],
      ticketsAfterAnswer: [],
    })
    expect(cases).toHaveLength(1)
    expect(cases[0].kind).toBe('wrong_data')
    expect(cases[0].evidence.feedback_count).toBe(2)
  })

  it('classifies unclassified when only a rephrase or post-answer ticket is present', () => {
    const rephraseOnly = clusterConversationSignals({
      feedback: [],
      rephrases: [{ conversationId: 'conv-4', organizationId: 'org-a', query: 'what now', createdAt: '2026-07-10T00:00:00Z' }],
      ticketsAfterAnswer: [],
    })
    expect(rephraseOnly[0].kind).toBe('unclassified')

    const ticketOnly = clusterConversationSignals({
      feedback: [],
      rephrases: [],
      ticketsAfterAnswer: [{ conversationId: 'conv-5', organizationId: 'org-a', ticketId: 't-1', createdAt: '2026-07-10T00:00:00Z' }],
    })
    expect(ticketOnly[0].kind).toBe('unclassified')
  })

  it('merges all three signal types for the same conversation into one case', () => {
    const cases = clusterConversationSignals({
      feedback: [
        {
          conversationId: 'conv-6',
          organizationId: 'org-a',
          verdict: 'not_right',
          question: 'q',
          answerExcerpt: null,
          messageId: 'msg-6',
          createdAt: '2026-07-10T00:00:00Z',
        },
      ],
      rephrases: [{ conversationId: 'conv-6', organizationId: 'org-a', query: 'q again', createdAt: '2026-07-10T00:01:00Z' }],
      ticketsAfterAnswer: [{ conversationId: 'conv-6', organizationId: 'org-a', ticketId: 't-2', createdAt: '2026-07-10T00:02:00Z' }],
    })
    expect(cases).toHaveLength(1)
    expect(cases[0].evidence.feedback_count).toBe(1)
    expect(cases[0].evidence.rephrase_count).toBe(1)
    expect(cases[0].evidence.tickets_after_answer_count).toBe(1)
  })

  it('ignores signals with no conversation id', () => {
    const cases = clusterConversationSignals({
      feedback: [],
      rephrases: [{ conversationId: null, organizationId: 'org-a', query: 'x', createdAt: '2026-07-10T00:00:00Z' }],
      ticketsAfterAnswer: [],
    })
    expect(cases).toEqual([])
  })
})

describe('matchNearestConversation', () => {
  const conversations: ConversationWindow[] = [
    { id: 'conv-1', userId: 'user-a', organizationId: 'org-a', updatedAt: '2026-07-10T12:00:00Z' },
    { id: 'conv-2', userId: 'user-a', organizationId: 'org-a', updatedAt: '2026-07-10T18:00:00Z' },
    { id: 'conv-3', userId: 'user-b', organizationId: 'org-a', updatedAt: '2026-07-10T12:01:00Z' },
  ]

  it('picks the nearest conversation for the same user+org within tolerance', () => {
    const id = matchNearestConversation(conversations, {
      userId: 'user-a',
      organizationId: 'org-a',
      createdAt: '2026-07-10T12:02:00Z',
    })
    expect(id).toBe('conv-1')
  })

  it('returns null when nothing is within tolerance', () => {
    const id = matchNearestConversation(
      conversations,
      { userId: 'user-a', organizationId: 'org-a', createdAt: '2026-07-11T12:00:00Z' },
      15 * 60 * 1000,
    )
    expect(id).toBeNull()
  })

  it('returns null when there is no user id', () => {
    expect(matchNearestConversation(conversations, { userId: null, organizationId: 'org-a', createdAt: '2026-07-10T12:00:00Z' })).toBeNull()
  })

  it('never matches a different user, even in the same org', () => {
    const id = matchNearestConversation(conversations, {
      userId: 'user-b',
      organizationId: 'org-a',
      createdAt: '2026-07-10T12:00:00Z',
    })
    expect(id).toBe('conv-3')
  })
})
