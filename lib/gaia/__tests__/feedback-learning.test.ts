/**
 * Rosa feedback analytics.
 *
 * The load-bearing behaviour is that every categoriser runs on the USER'S
 * QUESTION, not on Rosa's answer. gaia_feedback.message_id points at the
 * assistant message, so the naive read gives you the answer text, and every
 * category pattern here is question-shaped ("how do i", "what is", "where
 * can"). Categorising answers therefore put practically everything in
 * 'general' and made the category breakdown useless, which is exactly what the
 * admin page leads with.
 */

import { describe, it, expect } from 'vitest';
import { analyzeFeedbackPatterns } from '../feedback-learning';

const CONVERSATION_ID = 'conv-1';

/**
 * Minimal supabase stub: gaia_feedback returns the rated answers, gaia_messages
 * returns the whole conversation so the analyser can walk back to each
 * question.
 */
function stubClient(
  turns: Array<{ question: string; answer: string; rating: 'positive' | 'negative' }>,
) {
  const messages: Array<{
    id: string;
    content: string;
    role: string;
    conversation_id: string;
    created_at: string;
  }> = [];
  const feedback: unknown[] = [];

  turns.forEach((t, i) => {
    const qId = `q${i}`;
    const aId = `a${i}`;
    messages.push({
      id: qId,
      content: t.question,
      role: 'user',
      conversation_id: CONVERSATION_ID,
      created_at: `2026-07-19T00:0${i}:00Z`,
    });
    messages.push({
      id: aId,
      content: t.answer,
      role: 'assistant',
      conversation_id: CONVERSATION_ID,
      created_at: `2026-07-19T00:0${i}:30Z`,
    });
    feedback.push({
      id: `f${i}`,
      rating: t.rating,
      feedback_text: t.rating === 'negative' ? 'Did not answer it' : null,
      created_at: `2026-07-19T00:0${i}:45Z`,
      message: {
        id: aId,
        content: t.answer,
        role: 'assistant',
        conversation: { id: CONVERSATION_ID },
      },
    });
  });

  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        gte: () => chain,
        in: () => chain,
        eq: () => chain,
        order: () => {
          if (table === 'gaia_messages') return Promise.resolve({ data: messages, error: null });
          return Promise.resolve({ data: feedback, error: null });
        },
      };
      return chain;
    },
  } as never;
}

describe('analyzeFeedbackPatterns', () => {
  it('categorises by the question, not by Rosa answer text', async () => {
    // Every answer is deliberately shaped so that categorising IT would fall
    // through to 'general'. Only reading the question yields real categories.
    const client = stubClient([
      { question: 'How do I add my first product?', answer: 'Head to Products.', rating: 'negative' },
      { question: 'How do I add a facility?', answer: 'Open the facilities area.', rating: 'negative' },
      { question: 'What is scope 3?', answer: 'It covers value chain output.', rating: 'negative' },
      { question: 'What does cradle to grave mean?', answer: 'It spans the full life.', rating: 'positive' },
      { question: 'Where can I find my LCA reports?', answer: 'Under reports.', rating: 'positive' },
    ]);

    const result = await analyzeFeedbackPatterns(client, 30);

    const byCategory = Object.fromEntries(
      result.categoryBreakdown.map(c => [c.category, c]),
    );

    expect(byCategory['how-to']?.totalCount).toBe(2);
    expect(byCategory['how-to']?.positiveRate).toBe(0);
    expect(byCategory['explanation']?.totalCount).toBe(2);
    expect(byCategory['explanation']?.positiveRate).toBe(50);
    expect(byCategory['navigation']?.totalCount).toBe(1);
    expect(byCategory['navigation']?.positiveRate).toBe(100);

    // The regression: before the fix this was a single 'general' bucket.
    expect(byCategory['general']).toBeUndefined();
  });

  it('reports the headline counts', async () => {
    const client = stubClient([
      { question: 'How do I add a product?', answer: 'x', rating: 'negative' },
      { question: 'What is scope 3?', answer: 'y', rating: 'positive' },
    ]);

    const result = await analyzeFeedbackPatterns(client, 30);
    expect(result.totalFeedback).toBe(2);
    expect(result.positiveCount).toBe(1);
    expect(result.negativeCount).toBe(1);
    expect(result.positiveRate).toBe(50);
  });

  it('attributes a repeated answer to its own question, not the first match', async () => {
    // The old lookup matched on content equality, so an answer Rosa gives more
    // than once in a conversation ("I do not have that data yet") was always
    // attributed to whichever question came first.
    const client = stubClient([
      { question: 'How do I add a facility?', answer: 'I do not have that yet.', rating: 'negative' },
      { question: 'Where can I find reports?', answer: 'I do not have that yet.', rating: 'negative' },
    ]);

    const result = await analyzeFeedbackPatterns(client, 30);
    const categories = result.categoryBreakdown.map(c => c.category).sort();

    // One how-to and one navigation, not two of the same.
    expect(categories).toEqual(['how-to', 'navigation']);
  });

  it('returns an empty shape when there is no feedback', async () => {
    const result = await analyzeFeedbackPatterns(stubClient([]), 30);
    expect(result.totalFeedback).toBe(0);
    expect(result.positiveRate).toBe(0);
    expect(result.categoryBreakdown).toEqual([]);
    expect(result.knowledgeGaps).toEqual([]);
  });

  it('never puts customer question text into a suggested knowledge title', async () => {
    // gaia_knowledge_base is shared across every org, so a draft generated
    // from one customer's question must not carry that question forward.
    const client = stubClient([
      {
        question: 'Why is our Highland distillery scope 1 so high in Q3?',
        answer: 'Not sure.',
        rating: 'negative',
      },
    ]);

    const result = await analyzeFeedbackPatterns(client, 30);
    const entry = result.topNegativePatterns[0]?.suggestedKnowledgeEntry;

    expect(entry).toBeDefined();
    expect(entry!.title).not.toMatch(/Highland/i);
    expect(entry!.content).not.toMatch(/Highland/i);
  });
});
