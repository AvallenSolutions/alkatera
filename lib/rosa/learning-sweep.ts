/**
 * Rosa learning-sweep clustering -- Pillar 4 step 2 "Curate"
 * (data-revolution-plan.md).
 *
 * Pure clustering logic, no I/O. The weekly Inngest sweep
 * (lib/inngest/functions/rosa-learning.ts) gathers the last 7 days of
 * failure signals already captured by step 1 -- rosa_message_feedback
 * verdicts, rosa_telemetry learning.knowledge_miss / learning.
 * proposal_cancelled / learning.rephrase events, and support.ticket_filed
 * events with after_answer=true -- and hands them to the functions here to
 * turn into candidate rosa_learning_cases rows. Deterministic v1, no LLM:
 * knowledge misses cluster by normalised query similarity (reusing the
 * same Jaccard overlap heuristic as the rephrase detector); proposal
 * cancellations cluster by tool name; explicit feedback, rephrases and
 * post-answer tickets cluster by conversation, since those are all signals
 * about how one specific answer landed.
 */

import { jaccardWordOverlap } from './learning-signals'

export type LearningCaseKind = 'missing_knowledge' | 'wrong_tool' | 'wrong_data' | 'wrong_tone' | 'unclassified'

export interface ClusteredCase {
  kind: LearningCaseKind
  summary: string
  /** Always includes cluster_key, used by the sweep to dedupe against existing open cases. */
  evidence: Record<string, unknown>
  /** null = pattern spans more than one organisation. */
  organizationId: string | null
}

const DEFAULT_OVERLAP_THRESHOLD = 0.5

// ─── Knowledge misses (missing_knowledge) ──────────────────────────────────

export interface KnowledgeMissEvent {
  query: string
  organizationId: string
  tool?: string | null
  createdAt: string
}

/**
 * Groups knowledge-miss queries into clusters by pairwise word-overlap
 * (greedy: each query joins the first cluster whose representative it
 * overlaps >= threshold with, else starts a new cluster). Small numbers of
 * events per week make the O(n*clusters) greedy pass fine -- this is not
 * meant to scale to thousands of rows.
 */
export function clusterKnowledgeMisses(
  events: KnowledgeMissEvent[],
  opts?: { overlapThreshold?: number },
): ClusteredCase[] {
  const threshold = opts?.overlapThreshold ?? DEFAULT_OVERLAP_THRESHOLD
  const clean = events.filter((e) => e.query && e.query.trim().length > 0)
  if (clean.length === 0) return []

  interface Cluster {
    representative: string
    members: KnowledgeMissEvent[]
  }
  const clusters: Cluster[] = []

  for (const event of clean) {
    const match = clusters.find((c) => jaccardWordOverlap(c.representative, event.query) >= threshold)
    if (match) {
      match.members.push(event)
    } else {
      clusters.push({ representative: event.query, members: [event] })
    }
  }

  return clusters.map((cluster) => {
    const orgs = new Set(cluster.members.map((m) => m.organizationId))
    const tools = Array.from(new Set(cluster.members.map((m) => m.tool).filter((t): t is string => !!t)))
    const clusterKey = `missing_knowledge:${normaliseKey(cluster.representative)}`
    return {
      kind: 'missing_knowledge',
      summary:
        cluster.members.length === 1
          ? `Knowledge-bank search returned nothing for "${cluster.representative}".`
          : `Knowledge-bank search returned nothing for "${cluster.representative}" and ${cluster.members.length - 1} similar question${cluster.members.length - 1 === 1 ? '' : 's'}.`,
      evidence: {
        cluster_key: clusterKey,
        query: cluster.representative,
        queries: cluster.members.map((m) => m.query),
        count: cluster.members.length,
        tools,
        organisation_count: orgs.size,
      },
      organizationId: orgs.size === 1 ? Array.from(orgs)[0] : null,
    }
  })
}

// ─── Proposal cancellations (wrong_tool) ───────────────────────────────────

export interface ProposalCancelledEvent {
  toolName: string
  organizationId: string
  createdAt: string
}

/** Groups cancelled-proposal events by exact tool name. */
export function clusterProposalCancellations(events: ProposalCancelledEvent[]): ClusteredCase[] {
  const clean = events.filter((e) => e.toolName)
  if (clean.length === 0) return []

  const byTool = new Map<string, ProposalCancelledEvent[]>()
  for (const event of clean) {
    const list = byTool.get(event.toolName) ?? []
    list.push(event)
    byTool.set(event.toolName, list)
  }

  return Array.from(byTool.entries()).map(([toolName, members]) => {
    const orgs = new Set(members.map((m) => m.organizationId))
    return {
      kind: 'wrong_tool',
      summary:
        members.length === 1
          ? `A proposal from "${toolName}" was cancelled.`
          : `${members.length} proposals from "${toolName}" were cancelled.`,
      evidence: {
        cluster_key: `wrong_tool:${toolName}`,
        tool_name: toolName,
        count: members.length,
        organisation_count: orgs.size,
      },
      organizationId: orgs.size === 1 ? Array.from(orgs)[0] : null,
    }
  })
}

// ─── Conversation-level signals (wrong_data / wrong_tone / unclassified) ──

export interface FeedbackEvent {
  conversationId: string
  organizationId: string
  verdict: 'not_right' | 'too_vague'
  question: string | null
  answerExcerpt: string | null
  messageId: string
  createdAt: string
}

export interface RephraseEvent {
  conversationId: string | null
  organizationId: string
  query: string
  createdAt: string
}

export interface TicketAfterAnswerEvent {
  conversationId: string | null
  organizationId: string
  ticketId: string
  createdAt: string
}

/**
 * One case per conversation that carries any negative signal in the
 * window. Kind is decided from the strongest signal present:
 *   - any "not_right" feedback -> wrong_data (the answer was factually off)
 *   - else any "too_vague" feedback -> wrong_tone (the answer landed but was
 *     unclear or unspecific)
 *   - else (only a rephrase or a post-answer ticket, no explicit verdict)
 *     -> unclassified, since neither signal alone says what was wrong.
 * Rephrases and post-answer tickets without a matching feedback verdict
 * still surface as their own unclassified cases (grouped by conversation)
 * so they aren't silently dropped.
 */
export function clusterConversationSignals(input: {
  feedback: FeedbackEvent[]
  rephrases: RephraseEvent[]
  ticketsAfterAnswer: TicketAfterAnswerEvent[]
}): ClusteredCase[] {
  interface ConvoBucket {
    organizationId: string
    feedback: FeedbackEvent[]
    rephrases: RephraseEvent[]
    tickets: TicketAfterAnswerEvent[]
  }
  const byConversation = new Map<string, ConvoBucket>()

  const bucket = (conversationId: string, organizationId: string): ConvoBucket => {
    let b = byConversation.get(conversationId)
    if (!b) {
      b = { organizationId, feedback: [], rephrases: [], tickets: [] }
      byConversation.set(conversationId, b)
    }
    return b
  }

  for (const f of input.feedback) {
    if (!f.conversationId) continue
    bucket(f.conversationId, f.organizationId).feedback.push(f)
  }
  for (const r of input.rephrases) {
    if (!r.conversationId) continue
    bucket(r.conversationId, r.organizationId).rephrases.push(r)
  }
  for (const t of input.ticketsAfterAnswer) {
    if (!t.conversationId) continue
    bucket(t.conversationId, t.organizationId).tickets.push(t)
  }

  const cases: ClusteredCase[] = []
  for (const [conversationId, b] of Array.from(byConversation.entries())) {
    const hasNotRight = b.feedback.some((f) => f.verdict === 'not_right')
    const hasTooVague = b.feedback.some((f) => f.verdict === 'too_vague')
    const kind: LearningCaseKind = hasNotRight ? 'wrong_data' : hasTooVague ? 'wrong_tone' : 'unclassified'

    const representativeQuestion =
      b.feedback.find((f) => f.question)?.question ?? b.rephrases[0]?.query ?? null
    const representativeAnswer = b.feedback.find((f) => f.answerExcerpt)?.answerExcerpt ?? null

    const signalParts: string[] = []
    if (b.feedback.length > 0) signalParts.push(`${b.feedback.length} feedback tap${b.feedback.length === 1 ? '' : 's'}`)
    if (b.rephrases.length > 0) signalParts.push(`${b.rephrases.length} rephrase${b.rephrases.length === 1 ? '' : 's'}`)
    if (b.tickets.length > 0) signalParts.push(`${b.tickets.length} ticket${b.tickets.length === 1 ? '' : 's'} filed after an answer`)

    cases.push({
      kind,
      summary: representativeQuestion
        ? `"${representativeQuestion}" -- ${signalParts.join(', ')}.`
        : `A conversation had ${signalParts.join(', ')}.`,
      evidence: {
        cluster_key: `conversation:${conversationId}`,
        conversation_id: conversationId,
        question: representativeQuestion,
        answer_excerpt: representativeAnswer,
        message_ids: b.feedback.map((f) => f.messageId),
        feedback_count: b.feedback.length,
        rephrase_count: b.rephrases.length,
        tickets_after_answer_count: b.tickets.length,
      },
      organizationId: b.organizationId,
    })
  }

  return cases
}

// ─── Conversation matching for conversation-less telemetry rows ───────────

export interface ConversationWindow {
  id: string
  userId: string
  organizationId: string
  updatedAt: string
}

export interface TelemetryLocation {
  userId: string | null
  organizationId: string
  createdAt: string
}

/**
 * rosa_telemetry has no conversation_id column (learning.rephrase and
 * support.ticket_filed payloads only carry the query text / ticket id), so
 * the sweep approximates which conversation a telemetry row belongs to by
 * finding the nearest gaia_conversations row for the same user+org by
 * updated_at, within toleranceMs. Best-effort and heuristic by design:
 * returns null when there's no user id, no candidate for that user+org, or
 * the nearest candidate falls outside the tolerance window.
 */
export function matchNearestConversation(
  conversations: ConversationWindow[],
  event: TelemetryLocation,
  toleranceMs = 15 * 60 * 1000,
): string | null {
  if (!event.userId) return null
  const eventTime = new Date(event.createdAt).getTime()
  if (Number.isNaN(eventTime)) return null

  let best: { id: string; distance: number } | null = null
  for (const c of conversations) {
    if (c.userId !== event.userId || c.organizationId !== event.organizationId) continue
    const distance = Math.abs(new Date(c.updatedAt).getTime() - eventTime)
    if (Number.isNaN(distance)) continue
    if (!best || distance < best.distance) best = { id: c.id, distance }
  }
  if (!best || best.distance > toleranceMs) return null
  return best.id
}

function normaliseKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, '-')
    .trim()
    .slice(0, 80)
}
