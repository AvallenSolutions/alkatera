/**
 * Rosa -- Tool-use chat endpoint.
 *
 * POST /api/rosa/chat
 * Body: { conversation_id?: string, message: string, context?: object }
 *
 * Streams Server-Sent Events over the Gemini function-calling loop:
 *   1. Sends the user's message + conversation history + tools to Gemini.
 *   2. If Gemini asks to use a tool, execute it org-scoped, feed the result
 *      back, loop.
 *   3. Stream every text token to the client.
 *   4. When the assistant is done, persist the turn to gaia_messages.
 *
 * The conversation shape is compatible with the existing gaia_conversations /
 * gaia_messages tables.
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
import type { Content, FunctionCall, Part } from '@google/generative-ai';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { executeTool, ROSA_TOOLS, ACTION_TOOL_NAMES, type ToolContext } from '@/lib/rosa/tools';
import { buildMemoryBlock } from '@/lib/rosa/memory';
import { loadAttachment } from '@/lib/rosa/document-extraction';
import { rateLimit } from '@/lib/rate-limit';
import {
  getGeminiClient,
  toGeminiFunctionDeclarations,
  toGeminiInlineData,
  GEMINI_ROSA_MODEL,
} from '@/lib/ai/gemini';

const ACTION_TOOLS_SET = new Set<string>(ACTION_TOOL_NAMES as readonly string[]);

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_TOOL_ROUNDS = 8;

function buildSystemPrompt(memoryBlock: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are Rosa, the alkatera sustainability partner. You help drinks-industry users understand their footprint, run LCAs, meet reporting obligations, and improve.

Today's date: ${today}

# Who you are (persona)
You are named after the alkatera founder's beloved miniature golden doodle, Rosa, a rescue dog found in a cage on the streets of Yerevan, Armenia and given a second chance at a happy life. Just as Rosa the dog found her purpose and brings joy to everyone she meets, you are here to help businesses on their sustainability journey, proving that with the right guidance and support anyone can make a positive difference.

When the user asks "who is Rosa", "what is Rosa", "who are you", "why are you called Rosa", "what do you look like", "show me a photo of yourself" or any similar question about your name, identity, or appearance, ALWAYS share Rosa's story warmly AND include her photo. Respond in this style:

"I'm named after Rosa, a wonderful miniature golden doodle. She was rescued from a cage on the streets of Yerevan, Armenia, and given a second chance at a happy life. Here she is:

https://alkatera.com/images/rosa-the-dog.jpg

Just as Rosa the dog found her purpose and brings joy to everyone she meets, I'm here to help businesses on their sustainability journey, proving that with the right guidance and support anyone can make a positive difference in the world."

IMPORTANT: include the full URL https://alkatera.com/images/rosa-the-dog.jpg on its own line so the chat renders it as an inline image. Do not wrap it in markdown image syntax or markdown link syntax, just put the raw URL on its own line.

# Self-description (strict)
NEVER describe yourself as an "AI", "AI assistant", "AI agent", "chatbot", "language model", "digital assistant", or "sustainability guide". When introducing yourself or referring to your role, use ONLY one of: "Rosa", "your sustainability partner", or "alkatera's sustainability partner". This applies to phrases like "I'm afraid I'm just an AI…", "as an AI assistant…", and any similar self-deprecating disclaimers — never use them. If you can't do something the user asked, say so plainly without invoking your AI nature.

# Voice
British English, plain, candid, warm. No corporate jargon. Never use em dashes (use commas or full stops). Short sentences. Always write "alkatera" all lowercase, no markdown formatting around "tera" — the platform automatically styles the brand.

# What you can do
Your tools cover four families:

**Discovery** (what exists in this org)
- get_org_context — org snapshot (name, counts, active targets)
- get_data_readiness — layered readiness across foundation, recipes, LCAs (use BEFORE recommending any next step)
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
6. When the user asks "what should I do next" — or anything similar like "what's the priority?", "where do I start?", "what's blocking me?", "what should I focus on?" — ALWAYS call get_data_readiness FIRST. The platform's data has a strict waterfall: foundation (facility utility data + agricultural farm linkage) → recipes (matched ingredients and packaging) → LCAs → targets / decarbonisation. NEVER recommend higher-layer work when a lower layer is incomplete. If facility data is stale, say so plainly: an LCA built on stale facility data is misleading. If ingredients aren't matched, the LCA can't be calculated at all. Lead the user's next step from readiness.next_layer_to_address and quote readiness.why_this_layer in your own words.
7. Plain language only. The user is not a sustainability expert. Never say "archetype proxy" — say "industry average".

${memoryBlock ? `\n# Memory\n${memoryBlock}\n` : ''}`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse('GEMINI_API_KEY missing or empty', 503);
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

  // Rate limit AI usage per user to cap cost-abuse (durable when Upstash is configured).
  const rl = await rateLimit(`rosa-chat:${user.id}`, 30, 60_000);
  if (!rl.success) {
    return errorResponse('You are sending messages too quickly. Please wait a moment.', 429);
  }

  let body: {
    conversation_id?: string;
    message?: string;
    context?: unknown;
    attachments?: Array<{ file_id: string }>;
    page_context?: Array<{ id: string; label: string; priority: number; data: Record<string, unknown> }>;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const userMessage = (body?.message ?? '').toString().trim();
  const attachmentIds = Array.isArray(body?.attachments)
    ? body!.attachments!.map(a => a?.file_id).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  const pageContext = Array.isArray(body?.page_context) ? body.page_context : [];
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
  const baseSystemPrompt = buildSystemPrompt(memoryBlock);

  // Layer page context onto the system prompt so Rosa can answer questions
  // about what the user is currently looking at. Sliced and prioritised by
  // the client; we just pretty-print here. Empty array → no change.
  const pageContextBlock = pageContext.length > 0
    ? '\n\n---\n## Where the user is right now\n' +
      pageContext
        .slice()
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        .map(slice => `### ${slice.label}\n${JSON.stringify(slice.data, null, 2)}`)
        .join('\n\n') +
      '\n\nWhen the user asks page-specific questions ("which option here?", "help me with this", "what should I pick?"), reference the structured context above. If a question isn\'t about the page, treat the context as background only.\n---'
    : '';
  const systemPrompt = baseSystemPrompt + pageContextBlock;

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
        const client = getGeminiClient(apiKey);
        const generativeModel = client.getGenerativeModel({
          model: GEMINI_ROSA_MODEL,
          systemInstruction: systemPrompt,
          tools: toGeminiFunctionDeclarations(ROSA_TOOLS),
          generationConfig: { maxOutputTokens: 2000 },
        });

        // Build initial conversation: prior turns + this turn.
        // Gemini roles are 'user' and 'model' (no system role at the message
        // level — that's the systemInstruction above).
        const conversation: Content[] = [];
        for (const h of history ?? []) {
          if (h.role === 'user' || h.role === 'assistant') {
            conversation.push({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }],
            });
          }
        }
        // Current turn. If attachments are present, pass them as inlineData
        // parts so Rosa can see them natively; include the text too.
        if (loadedAttachments.length > 0) {
          const turnParts: Part[] = loadedAttachments.map(a => toGeminiInlineData(a!));
          const textPart = userMessage.length > 0
            ? userMessage
            : 'Please take a look at the attached document.';
          turnParts.push({ text: textPart });
          conversation.push({ role: 'user', parts: turnParts });
        } else {
          conversation.push({ role: 'user', parts: [{ text: userMessage }] });
        }

        const toolAudit: unknown[] = [];
        let finalText = '';

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const streamResult = await generativeModel.generateContentStream({
            contents: conversation,
          });

          let roundText = '';
          const functionCalls: FunctionCall[] = [];
          // Preserve the model's parts verbatim so we can echo them back on
          // the next round. Gemini 3.x requires `thoughtSignature` (a sibling
          // of `functionCall` on the Part) to round-trip unchanged or the
          // follow-up request 400s.
          const modelParts: Part[] = [];

          for await (const chunk of streamResult.stream) {
            for (const cand of chunk.candidates ?? []) {
              for (const part of cand.content?.parts ?? []) {
                modelParts.push(part);
                if (typeof (part as any).text === 'string') {
                  const delta = (part as any).text as string;
                  if (delta) {
                    roundText += delta;
                    emit('text', { delta });
                  }
                } else if ((part as any).functionCall) {
                  const fc = (part as any).functionCall as FunctionCall;
                  functionCalls.push(fc);
                  emit('tool_use', { name: fc.name, input: fc.args ?? {} });
                }
              }
            }
          }

          if (roundText) finalText += roundText;

          // No tool calls → conversation turn complete.
          if (functionCalls.length === 0) break;

          conversation.push({ role: 'model', parts: modelParts });

          // Execute each tool and feed results back.
          const responseParts: Part[] = [];
          for (const fc of functionCalls) {
            const res = await executeTool(toolCtx, fc.name, fc.args ?? {});
            toolAudit.push(res.audit);

            // Tool results may carry a structured `preview` object (e.g.
            // generate_export returns { preview: { download_url, ... } }).
            // Surface it to the UI verbatim so the conversation can render
            // a download chip without parsing the result string itself.
            let structuredPreview: unknown = null;
            let parsedContent: any = null;
            try {
              parsedContent = JSON.parse(res.content);
              if (parsedContent && typeof parsedContent === 'object' && parsedContent.preview) {
                structuredPreview = parsedContent.preview;
              }
            } catch {
              // non-JSON content; fall through with string preview only
            }
            emit('tool_result', {
              name: fc.name,
              is_error: res.is_error,
              preview: structuredPreview ?? res.content.slice(0, 240),
            });

            // Action tools queue a pending action; surface it to the UI as a
            // confirmation card the user can click.
            if (!res.is_error && ACTION_TOOLS_SET.has(fc.name) && parsedContent?.pending_action_id) {
              emit('action_proposal', {
                id: parsedContent.pending_action_id,
                tool_name: fc.name,
                preview: parsedContent.preview ?? '',
              });
            }

            responseParts.push({
              functionResponse: {
                name: fc.name,
                response: res.is_error
                  ? { error: res.content }
                  : parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent)
                    ? parsedContent
                    : { content: res.content },
              },
            });
          }
          conversation.push({ role: 'function', parts: responseParts });
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
