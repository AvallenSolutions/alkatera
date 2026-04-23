/**
 * Rosa -- Reusable tool-use loop.
 *
 * Non-streaming runner that takes a system prompt + user message and
 * runs the Anthropic tool-use loop using the shared ROSA_TOOLS catalogue.
 * Returns the final text plus an audit trail of tool calls.
 *
 * Used by callers that want a one-shot answer (anomaly explain, etc).
 * The streaming chat route at /api/rosa/chat keeps its own copy of the
 * loop because it needs to emit deltas as they arrive.
 */

import { executeTool, ROSA_TOOLS, type ToolContext } from './tools';

export interface ToolCallAudit {
  name: string;
  input: unknown;
  is_error: boolean;
  preview: string;
  audit: Record<string, unknown>;
}

export interface RunToolLoopResult {
  text: string;
  tools: ToolCallAudit[];
  rounds: number;
  stopped_early: boolean;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_TOKENS = 1500;

export async function runToolLoop({
  apiKey,
  systemPrompt,
  userMessage,
  toolContext,
  model = DEFAULT_MODEL,
  maxRounds = DEFAULT_MAX_ROUNDS,
  maxTokens = DEFAULT_MAX_TOKENS,
}: {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  toolContext: ToolContext;
  model?: string;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<RunToolLoopResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [
    { role: 'user', content: userMessage },
  ];

  const tools: ToolCallAudit[] = [];
  let finalText = '';
  let stoppedEarly = false;
  let lastRound = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    lastRound = round + 1;
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: ROSA_TOOLS as any,
      messages: messages as any,
    });

    const toolUses: Array<{ id: string; name: string; input: any }> = [];
    let roundText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        roundText += block.text;
      } else if (block.type === 'tool_use') {
        toolUses.push({ id: block.id, name: block.name, input: block.input });
      }
    }
    if (roundText) finalText += roundText;

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResultBlocks: any[] = [];
    for (const tu of toolUses) {
      const res = await executeTool(toolContext, tu.name, tu.input);
      tools.push({
        name: tu.name,
        input: tu.input,
        is_error: res.is_error,
        preview: res.content.slice(0, 240),
        audit: res.audit,
      });
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: res.content,
        is_error: res.is_error,
      });
    }
    messages.push({ role: 'user', content: toolResultBlocks });

    if (round === maxRounds - 1) {
      stoppedEarly = true;
    }
  }

  return { text: finalText, tools, rounds: lastRound, stopped_early: stoppedEarly };
}
