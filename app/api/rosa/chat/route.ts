/**
 * Rosa -- Tool-use chat endpoint.
 *
 * POST /api/rosa/chat
 * Body: { conversation_id?: string, message: string, context?: object }
 *
 * Streams Server-Sent Events over the Anthropic tool-use loop:
 *   1. Sends the user's message + conversation history + tools to Claude.
 *   2. If Claude asks to use a tool, execute it org-scoped, feed the result
 *      back, loop.
 *   3. Stream every text token to the client.
 *   4. When the assistant is done, persist the turn to gaia_messages.
 *
 * The conversation shape is compatible with the existing gaia_conversations /
 * gaia_messages tables -- the legacy Supabase edge function at
 * supabase/functions/gaia-query can keep serving today's Rosa while this
 * endpoint powers Pulse-aware tool-use (#4, #5, #7, #10).
 *
 * Events streamed to the client:
 *   event: text          → data: { delta: string }
 *   event: tool_use      → data: { name: string, input: object }
 *   event: tool_result   → data: { name: string, is_error: boolean, preview: string }
 *   event: done          → data: { conversation_id, message_id, final_text }
 *   event: error         → data: { message }
 */

import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { executeTool, ROSA_TOOLS, ACTION_TOOL_NAMES, type ToolContext } from '@/lib/rosa/tools';
import { buildMemoryBlock } from '@/lib/rosa/memory';
import { loadAttachment, toAnthropicBlock } from '@/lib/rosa/document-extraction';

const ACTION_TOOLS_SET = new Set<string>(ACTION_TOOL_NAMES as readonly string[]);

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_ROUNDS = 8;

function buildSystemPrompt(memoryBlock: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are Rosa, the alka**tera** sustainability partner. You help drinks-industry users understand their footprint, run LCAs, meet reporting obligations, and improve.

Today's date: ${today}

# Voice
British English, plain, candid, warm. No corporate jargon. Never use em dashes (use commas or full stops). Short sentences. Always use "alka**tera**" lowercase with "tera" in bold when the product is named.

# What you can do
Your tools cover four families:

**Discovery** (what exists in this org)
- get_org_context — org snapshot (name, counts, active targets)
- list_facilities / list_products / list_suppliers / list_lcas / list_reports / list_insights

**Data** (what the numbers say)
- query_pulse_metrics — daily time-series for one metric
- compare_facilities — rank sites by a metric
- list_recent_anomalies — what the detector has flagged
- get_product_footprint — the headline carbon footprint for one product
- get_lca_summary — a one-page LCA summary
- compare_to_benchmark — this product vs the published industry average
- suggest_data_gaps — the single next most-valuable step for this org
- run_safe_sql — escape hatch for custom SELECTs

**Knowledge** (sustainability expertise)
- search_knowledge_bank / explain_methodology — curated ISO 14044, ISO 14067, VSME, CSRD, GHG Protocol, Green Claims, BIER benchmarks etc. Every entry carries a source_url. When you cite methodology, cite the source_url verbatim.

**Memory** (carry context across conversations)
- list_memories at the start of a conversation when relevant
- save_memory when the user states a durable preference or fact (e.g. "we report to VSME", "keep answers short"). Never save ephemeral chat state.

# Rules
1. ALWAYS prefer tools over guessing. A cited number must come from a tool result.
2. If a tool errors, try a different approach. Fall back to run_safe_sql as last resort.
3. For methodology, regulations, frameworks: call search_knowledge_bank or explain_methodology first. Answer with the content + cite the source_url.
4. Never invent figures. If the data isn't there, say so and offer the next best step.
5. Start every answer with the headline finding in one or two sentences, then evidence.
6. When the user asks "what should I do next", call suggest_data_gaps.
7. Plain language only. The user is not a sustainability expert. Never say "archetype proxy" — say "industry average".

${memoryBlock ? `\n# Memory\n${memoryBlock}\n` : ''}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse('ANTHROPIC_API_KEY missing or empty', 503);
  }

  // Auth: caller must be a signed-in member of an organisation.
  const userSupabase = getSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser();
  if (userErr || !user) return errorResponse('Unauthenticated', 401);

  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return errorResponse('No organisation membership', 403);

  const organizationId = membership.organization_id;

  let body: { conversation_id?: string; message?: string; context?: unknown; attachments?: Array<{ file_id: string }> };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const userMessage = (body?.message ?? '').toString().trim();
  const attachmentIds = Array.isArray(body?.attachments)
    ? body!.attachments!.map(a => a?.file_id).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  if (!userMessage && attachmentIds.length === 0) {
    return errorResponse('message or attachments required', 400);
  }

  // Service-role client for tool execution + persistence (RLS is irrelevant
  // once we've verified org membership; tools enforce org scoping directly).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return errorResponse('Supabase service role not configured', 500);
  }
  const serviceSupabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // conversation id filled in below once resolved
  const toolCtx: ToolContext = {
    supabase: serviceSupabase,
    organizationId,
    userId: user.id,
  };

  // Resolve / create conversation.
  const conversationId = await ensureConversation(
    serviceSupabase,
    body.conversation_id,
    organizationId,
    user.id,
    userMessage,
  );
  toolCtx.conversationId = conversationId;

  // Load prior turns (last 20) for context continuity.
  const { data: history } = await serviceSupabase
    .from('gaia_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Load Rosa's memory for this user + org.
  const memoryBlock = await buildMemoryBlock(serviceSupabase, organizationId, user.id);
  const systemPrompt = buildSystemPrompt(memoryBlock);

  // Load any attachments up front so we can abort cleanly if one is missing.
  const loadedAttachments = [] as Array<Awaited<ReturnType<typeof loadAttachment>>>;
  for (const fileId of attachmentIds) {
    const att = await loadAttachment(serviceSupabase, fileId, organizationId, user.id);
    if (att) loadedAttachments.push(att);
  }

  const persistedUserContent = userMessage.length > 0
    ? userMessage
    : `(attached ${loadedAttachments.length} document${loadedAttachments.length === 1 ? '' : 's'})`;
  const attachmentNote = loadedAttachments.length > 0
    ? `\n\nAttached: ${loadedAttachments.map(a => a!.filename).join(', ')}`
    : '';

  // Persist the incoming user turn before we start streaming.
  await serviceSupabase.from('gaia_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: persistedUserContent + attachmentNote,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey });

        // Build initial messages: full history (user/assistant) + this turn.
        const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
        for (const h of history ?? []) {
          if (h.role === 'user' || h.role === 'assistant') {
            messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
          }
        }
        // Current turn. If attachments are present, pass them as document/image
        // content blocks so Rosa can see them natively; include the text too.
        if (loadedAttachments.length > 0) {
          const turnContent: any[] = loadedAttachments.map(a => toAnthropicBlock(a!));
          const textPart = userMessage.length > 0
            ? userMessage
            : 'Please take a look at the attached document.';
          turnContent.push({ type: 'text', text: textPart });
          messages.push({ role: 'user', content: turnContent });
        } else {
          messages.push({ role: 'user', content: userMessage });
        }

        const toolAudit: unknown[] = [];
        let finalText = '';

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 2000,
            system: systemPrompt,
            tools: ROSA_TOOLS as any,
            messages: messages as any,
          });

          // Accumulate any text blocks, surface any tool_use blocks.
          const toolUses: Array<{ id: string; name: string; input: any }> = [];
          for (const block of response.content) {
            if (block.type === 'text') {
              finalText += block.text;
              emit('text', { delta: block.text });
            } else if (block.type === 'tool_use') {
              toolUses.push({ id: block.id, name: block.name, input: block.input });
              emit('tool_use', { name: block.name, input: block.input });
            }
          }

          // No tool calls → conversation turn complete.
          if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
            break;
          }

          // Record the assistant turn (with tool_use blocks) so the follow-up
          // round can reference tool_use_id.
          messages.push({ role: 'assistant', content: response.content });

          // Execute each tool and feed results back.
          const toolResultBlocks: any[] = [];
          for (const tu of toolUses) {
            const res = await executeTool(toolCtx, tu.name, tu.input);
            toolAudit.push(res.audit);
            toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: res.content,
              is_error: res.is_error,
            });
            emit('tool_result', {
              name: tu.name,
              is_error: res.is_error,
              preview: res.content.slice(0, 240),
            });

            // Action tools queue a pending action; surface it to the UI as a
            // confirmation card the user can click.
            if (!res.is_error && ACTION_TOOLS_SET.has(tu.name)) {
              try {
                const parsed = JSON.parse(res.content);
                if (parsed?.pending_action_id) {
                  emit('action_proposal', {
                    id: parsed.pending_action_id,
                    tool_name: tu.name,
                    preview: parsed.preview ?? '',
                  });
                }
              } catch {
                // non-JSON content, skip
              }
            }
          }
          messages.push({ role: 'user', content: toolResultBlocks });
        }

        // Persist the assistant turn (with tool audit trail in data_sources).
        const { data: inserted } = await serviceSupabase
          .from('gaia_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalText || '(no response)',
            data_sources: toolAudit,
          })
          .select('id')
          .single();

        // Bump conversation last_message_at.
        await serviceSupabase
          .from('gaia_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        emit('done', {
          conversation_id: conversationId,
          message_id: inserted?.id ?? null,
          final_text: finalText,
        });
      } catch (err: any) {
        console.error('[rosa chat]', err);
        emit('error', { message: err?.message ?? 'Unknown error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function ensureConversation(
  supabase: SupabaseClient,
  existingId: string | undefined,
  organizationId: string,
  userId: string,
  firstMessage: string,
): Promise<string> {
  if (existingId) return existingId;
  const title = firstMessage.length > 60 ? `${firstMessage.slice(0, 57)}…` : firstMessage;
  const { data, error } = await supabase
    .from('gaia_conversations')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      title,
      is_active: true,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create conversation: ${error?.message ?? 'unknown'}`);
  return (data as { id: string }).id;
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
