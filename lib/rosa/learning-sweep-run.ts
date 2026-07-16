/**
 * Rosa learning curation sweep -- I/O layer (Pillar 4 step 2 "Curate").
 *
 * Gathers the last 7 days of failure signals, clusters them with the pure
 * functions in lib/rosa/learning-sweep.ts, and writes new
 * rosa_learning_cases rows (deduped by cluster_key). Exported as a plain
 * async function -- rather than being embedded directly in the Inngest
 * function's step callbacks -- so it can also be run directly (a manual
 * admin trigger, a one-off backfill, or local verification) without
 * needing the Inngest runtime. lib/inngest/functions/rosa-learning.ts
 * wraps a single call to this in one step.run for retry/observability.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clusterKnowledgeMisses,
  clusterProposalCancellations,
  clusterConversationSignals,
  matchNearestConversation,
  type ClusteredCase,
  type KnowledgeMissEvent,
  type ProposalCancelledEvent,
  type FeedbackEvent,
  type RephraseEvent,
  type TicketAfterAnswerEvent,
  type ConversationWindow,
} from './learning-sweep';

const WINDOW_DAYS = 7;
const CONVERSATION_MATCH_TOLERANCE_MS = 15 * 60 * 1000;

export interface LearningSweepResult {
  checked: number;
  created: number;
  candidates: ClusteredCase[];
}

export async function runLearningSweep(
  supabase: SupabaseClient,
  opts?: { windowDays?: number },
): Promise<LearningSweepResult> {
  const windowDays = opts?.windowDays ?? WINDOW_DAYS;
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  // 1. Explicit feedback (not_right / too_vague), with the question +
  //    answer excerpt pulled from the surrounding conversation.
  const feedbackEvents = await gatherFeedbackEvents(supabase, sinceIso).catch((err: unknown) => {
    console.warn('[rosa-learning-sweep] gather-feedback failed:', (err as Error)?.message);
    return [] as FeedbackEvent[];
  });

  // 2. Telemetry: knowledge misses, proposal cancellations, rephrases, and
  //    post-answer tickets.
  const telemetry = await gatherTelemetry(supabase, sinceIso).catch((err: unknown) => {
    console.warn('[rosa-learning-sweep] gather-telemetry failed:', (err as Error)?.message);
    return [] as TelemetryRow[];
  });

  const knowledgeMissEvents: KnowledgeMissEvent[] = telemetry
    .filter((t) => t.event === 'learning.knowledge_miss')
    .map((t) => ({
      query: typeof t.payload?.query === 'string' ? t.payload.query : '',
      organizationId: t.organization_id,
      tool: typeof t.payload?.tool === 'string' ? t.payload.tool : null,
      createdAt: t.created_at,
    }));

  const proposalCancelledEvents: ProposalCancelledEvent[] = telemetry
    .filter((t) => t.event === 'learning.proposal_cancelled')
    .map((t) => ({
      toolName: typeof t.payload?.tool_name === 'string' ? t.payload.tool_name : '',
      organizationId: t.organization_id,
      createdAt: t.created_at,
    }));

  const rephraseTelemetry = telemetry.filter((t) => t.event === 'learning.rephrase');
  const ticketAfterAnswerTelemetry = telemetry.filter(
    (t) => t.event === 'support.ticket_filed' && t.payload?.after_answer === true,
  );

  // 3. Approximate conversation ids for the two telemetry event kinds that
  //    don't carry one (see matchNearestConversation's header note).
  const conversationWindows = await gatherConversationWindows(
    supabase,
    [...rephraseTelemetry, ...ticketAfterAnswerTelemetry],
    windowDays,
  ).catch((err: unknown) => {
    console.warn('[rosa-learning-sweep] gather-conversation-windows failed:', (err as Error)?.message);
    return [] as ConversationWindow[];
  });

  const rephraseEvents: RephraseEvent[] = rephraseTelemetry.map((t) => ({
    conversationId: matchNearestConversation(
      conversationWindows,
      { userId: t.user_id, organizationId: t.organization_id, createdAt: t.created_at },
      CONVERSATION_MATCH_TOLERANCE_MS,
    ),
    organizationId: t.organization_id,
    query: typeof t.payload?.query === 'string' ? t.payload.query : '',
    createdAt: t.created_at,
  }));

  const ticketAfterAnswerEvents: TicketAfterAnswerEvent[] = ticketAfterAnswerTelemetry.map((t) => ({
    conversationId: matchNearestConversation(
      conversationWindows,
      { userId: t.user_id, organizationId: t.organization_id, createdAt: t.created_at },
      CONVERSATION_MATCH_TOLERANCE_MS,
    ),
    organizationId: t.organization_id,
    ticketId: typeof t.payload?.ticket_id === 'string' ? t.payload.ticket_id : '',
    createdAt: t.created_at,
  }));

  // 4. Cluster (pure, no I/O).
  const candidates: ClusteredCase[] = [
    ...clusterKnowledgeMisses(knowledgeMissEvents),
    ...clusterProposalCancellations(proposalCancelledEvents),
    ...clusterConversationSignals({ feedback: feedbackEvents, rephrases: rephraseEvents, ticketsAfterAnswer: ticketAfterAnswerEvents }),
  ];

  if (candidates.length === 0) {
    return { checked: telemetry.length + feedbackEvents.length, created: 0, candidates: [] };
  }

  // 5. Write: skip clusters that already have an OPEN case (dedupe by
  //    cluster_key), each candidate isolated so a bad row never blocks the
  //    rest.
  let created = 0;
  for (const candidate of candidates) {
    const wasCreated = await writeCandidate(supabase, candidate).catch((err: unknown) => {
      console.error(`[rosa-learning-sweep] candidate ${candidate.evidence.cluster_key} failed:`, (err as Error)?.message);
      return false;
    });
    if (wasCreated) created++;
  }

  return { checked: candidates.length, created, candidates };
}

interface TelemetryRow {
  id: number;
  organization_id: string;
  user_id: string | null;
  event: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

async function gatherFeedbackEvents(supabase: SupabaseClient, sinceIso: string): Promise<FeedbackEvent[]> {
  const { data: feedback, error } = await supabase
    .from('rosa_message_feedback')
    .select('id, message_id, conversation_id, organization_id, verdict, created_at')
    .in('verdict', ['not_right', 'too_vague'])
    .gte('created_at', sinceIso)
    .limit(1000);
  if (error) throw new Error(`feedback query failed: ${error.message}`);
  if (!feedback || feedback.length === 0) return [];

  const conversationIds = Array.from(new Set(feedback.map((f) => f.conversation_id)));
  const { data: messages, error: msgErr } = await supabase
    .from('gaia_messages')
    .select('id, conversation_id, role, content, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });
  if (msgErr) throw new Error(`messages query failed: ${msgErr.message}`);

  const byConversation = new Map<string, Array<{ id: string; role: string; content: string; created_at: string }>>();
  for (const m of messages ?? []) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m);
    byConversation.set(m.conversation_id, list);
  }

  return feedback.map((f) => {
    const convoMessages = byConversation.get(f.conversation_id) ?? [];
    const rated = convoMessages.find((m) => m.id === f.message_id);
    const ratedIndex = rated ? convoMessages.indexOf(rated) : -1;
    const precedingUser =
      ratedIndex >= 0 ? [...convoMessages.slice(0, ratedIndex)].reverse().find((m) => m.role === 'user') : undefined;
    return {
      conversationId: f.conversation_id,
      organizationId: f.organization_id,
      verdict: f.verdict as 'not_right' | 'too_vague',
      question: precedingUser?.content?.slice(0, 300) ?? null,
      answerExcerpt: rated?.content?.slice(0, 300) ?? null,
      messageId: f.message_id,
      createdAt: f.created_at,
    };
  });
}

async function gatherTelemetry(supabase: SupabaseClient, sinceIso: string): Promise<TelemetryRow[]> {
  const { data, error } = await supabase
    .from('rosa_telemetry')
    .select('id, organization_id, user_id, event, payload, created_at')
    .in('event', ['learning.knowledge_miss', 'learning.proposal_cancelled', 'learning.rephrase', 'support.ticket_filed'])
    .gte('created_at', sinceIso)
    .limit(5000);
  if (error) throw new Error(`telemetry query failed: ${error.message}`);
  return (data ?? []) as TelemetryRow[];
}

async function gatherConversationWindows(
  supabase: SupabaseClient,
  events: TelemetryRow[],
  windowDays: number,
): Promise<ConversationWindow[]> {
  const userIds = Array.from(new Set(events.map((t) => t.user_id).filter((id): id is string => !!id)));
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('gaia_conversations')
    .select('id, user_id, organization_id, updated_at')
    .in('user_id', userIds)
    .gte('updated_at', new Date(Date.now() - (windowDays * 86_400_000 + CONVERSATION_MATCH_TOLERANCE_MS)).toISOString())
    .limit(2000);
  if (error) throw new Error(`conversations query failed: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    organizationId: c.organization_id,
    updatedAt: c.updated_at,
  }));
}

async function writeCandidate(supabase: SupabaseClient, candidate: ClusteredCase): Promise<boolean> {
  const clusterKey = candidate.evidence.cluster_key as string;
  const { data: existing, error: existingErr } = await supabase
    .from('rosa_learning_cases')
    .select('id')
    .eq('status', 'open')
    .eq('evidence->>cluster_key', clusterKey)
    .limit(1);
  if (existingErr) {
    console.warn(`[rosa-learning-sweep] dedupe check failed for ${clusterKey}: ${existingErr.message}`);
    return false;
  }
  if (existing && existing.length > 0) return false;

  const { error: insertErr } = await supabase.from('rosa_learning_cases').insert({
    kind: candidate.kind,
    summary: candidate.summary,
    evidence: candidate.evidence,
    organization_id: candidate.organizationId,
  });
  if (insertErr) {
    console.warn(`[rosa-learning-sweep] insert failed for ${clusterKey}: ${insertErr.message}`);
    return false;
  }
  return true;
}
