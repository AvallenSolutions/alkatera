/**
 * Rosa -- Reusable tool-use loop.
 *
 * Non-streaming runner that takes a system prompt + user message and runs
 * the Gemini function-calling loop using the shared ROSA_TOOLS catalogue.
 * Returns the final text plus an audit trail of tool calls.
 *
 * Used by callers that want a one-shot answer (anomaly explain, etc).
 * The streaming chat route at /api/rosa/chat uses streamToolLoop from
 * lib/ai/gemini.ts because it needs to emit deltas as they arrive.
 */

import { executeTool, rosaToolsFor, type ToolContext } from './tools';
import { runToolLoop as runGeminiToolLoop, GEMINI_ROSA_MODEL } from '@/lib/ai/gemini';

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

const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_MAX_TOKENS = 1500;

export async function runToolLoop({
  apiKey,
  systemPrompt,
  userMessage,
  toolContext,
  model = GEMINI_ROSA_MODEL,
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
  return runGeminiToolLoop({
    apiKey,
    model,
    systemPrompt,
    userMessage,
    // Only the tools this caller's section access allows; executeTool refuses
    // the rest a second time in case one is named anyway.
    tools: rosaToolsFor(toolContext.sectionAccess),
    maxRounds,
    maxTokens,
    executeTool: (name, input) => executeTool(toolContext, name, input),
  });
}
