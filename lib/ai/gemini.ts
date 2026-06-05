/**
 * Gemini client + helpers.
 *
 * All Gemini SDK contact happens here. Other files import these helpers
 * rather than touching @google/generative-ai directly, so the migration
 * away from Anthropic is contained to one module.
 *
 * Provides:
 *   - getGeminiClient(apiKey)
 *   - toGeminiFunctionDeclarations(rosaTools) — JSON Schema → Gemini schema
 *   - toGeminiInlineData(attachment)          — base64 file → inlineData part
 *   - runToolLoop(...)                         — non-streaming multi-round
 *   - streamToolLoop(...)                      — streaming multi-round
 *   - extractStructured(...)                   — vision + JSON-mode extraction
 */
import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerativeModel,
  type Part,
  type Tool,
} from '@google/generative-ai';
import { GEMINI_FAST_MODEL, GEMINI_ROSA_MODEL } from './models';
import { logGeminiUsage } from './usage-log';

export { GEMINI_FAST_MODEL, GEMINI_ROSA_MODEL };

export interface RosaToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LoadedAttachmentLike {
  base64: string;
  media_type: string;
}

export interface ToolCallAudit {
  name: string;
  input: unknown;
  is_error: boolean;
  preview: string;
  audit: Record<string, unknown>;
}

export interface ToolExecutor {
  (name: string, input: unknown): Promise<{
    content: string;
    is_error: boolean;
    audit: Record<string, unknown>;
  }>;
}

export interface ToolLoopResult {
  text: string;
  tools: ToolCallAudit[];
  rounds: number;
  stopped_early: boolean;
}

/** Build a Gemini client. Throws if no key is set. */
export function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Convert JSON Schema (as used by ROSA_TOOLS' `input_schema`) into Gemini's
 * FunctionDeclarationSchema. Gemini accepts a JSON-Schema subset: object,
 * string, number, integer, boolean, array, enum, required, items, properties.
 * It does NOT accept: $schema, additionalProperties, oneOf/anyOf/allOf, $ref.
 */
function normaliseSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof s.type === 'string') out.type = s.type.toUpperCase();
  if (typeof s.description === 'string') out.description = s.description;
  if (Array.isArray(s.enum)) out.enum = s.enum;
  if (Array.isArray(s.required)) out.required = s.required;
  if (s.properties && typeof s.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties as Record<string, unknown>)) {
      const nested = normaliseSchema(v);
      if (nested) props[k] = nested;
    }
    out.properties = props;
  }
  if (s.items) {
    const items = normaliseSchema(s.items);
    if (items) out.items = items;
  }
  return out;
}

/** Convert ROSA_TOOLS → Gemini Tool[] with one FunctionDeclarationsTool. */
export function toGeminiFunctionDeclarations(
  tools: ReadonlyArray<RosaToolDefinition>,
): Tool[] {
  const functionDeclarations: FunctionDeclaration[] = tools.map(t => {
    const params = normaliseSchema(t.input_schema);
    return {
      name: t.name,
      description: t.description,
      ...(params ? { parameters: params as unknown as FunctionDeclaration['parameters'] } : {}),
    };
  });
  return [{ functionDeclarations } as Tool];
}

/** Convert a loaded attachment into a Gemini inlineData part. */
export function toGeminiInlineData(att: LoadedAttachmentLike): Part {
  return {
    inlineData: {
      mimeType: att.media_type,
      data: att.base64,
    },
  };
}

/**
 * Build a GenerativeModel configured with a system instruction + tools.
 */
function buildModel(
  client: GoogleGenerativeAI,
  modelId: string,
  systemInstruction: string,
  tools?: Tool[],
  maxOutputTokens?: number,
): GenerativeModel {
  return client.getGenerativeModel({
    model: modelId,
    systemInstruction,
    ...(tools && tools.length > 0 ? { tools } : {}),
    generationConfig: {
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
    },
  });
}

/**
 * Walk a Gemini response and pull out text + function calls.
 */
function partsFromCandidate(candidate: { content?: Content }): Part[] {
  return candidate.content?.parts ?? [];
}

/**
 * Non-streaming tool-use loop. Mirrors the previous Anthropic runToolLoop
 * contract so callers can swap in without restructuring.
 */
export async function runToolLoop({
  apiKey,
  model = GEMINI_ROSA_MODEL,
  systemPrompt,
  userMessage,
  tools,
  executeTool,
  maxRounds = 4,
  maxTokens = 1500,
}: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  userMessage: string;
  tools: ReadonlyArray<RosaToolDefinition>;
  executeTool: ToolExecutor;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<ToolLoopResult> {
  const client = getGeminiClient(apiKey);
  const geminiTools = toGeminiFunctionDeclarations(tools);
  const generativeModel = buildModel(client, model, systemPrompt, geminiTools, maxTokens);

  const history: Content[] = [
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const toolAudit: ToolCallAudit[] = [];
  let finalText = '';
  let stoppedEarly = false;
  let lastRound = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    lastRound = round + 1;
    const result = await generativeModel.generateContent({ contents: history });
    const candidate = result.response.candidates?.[0];
    if (!candidate) break;

    const parts = partsFromCandidate(candidate);
    const functionCalls: FunctionCall[] = [];
    let roundText = '';
    for (const part of parts) {
      if (typeof (part as any).text === 'string') {
        roundText += (part as any).text;
      } else if ((part as any).functionCall) {
        functionCalls.push((part as any).functionCall as FunctionCall);
      }
    }
    if (roundText) finalText += roundText;

    if (functionCalls.length === 0) break;

    // Echo the model's parts back verbatim. Gemini 3.x requires
    // `thoughtSignature` on functionCall parts to round-trip unchanged.
    history.push({ role: 'model', parts });

    const responseParts: Part[] = [];
    for (const fc of functionCalls) {
      const res = await executeTool(fc.name, fc.args ?? {});
      toolAudit.push({
        name: fc.name,
        input: fc.args ?? {},
        is_error: res.is_error,
        preview: res.content.slice(0, 240),
        audit: res.audit,
      });
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: res.is_error
            ? { error: res.content }
            : safeParseJson(res.content) ?? { content: res.content },
        },
      });
    }
    history.push({ role: 'function', parts: responseParts });

    if (round === maxRounds - 1) stoppedEarly = true;
  }

  return { text: finalText, tools: toolAudit, rounds: lastRound, stopped_early: stoppedEarly };
}

export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result';
  data: Record<string, unknown>;
}

/**
 * Streaming tool-use loop. Calls `emit(event)` for each delta so the route
 * handler can fan it out over Server-Sent Events. Returns the final assembled
 * text + tool audit trail when done.
 *
 * NOTE on streaming + tool-use: Gemini's stream does not interleave function
 * calls inside a chunk; a streamed response either finishes with text or with
 * a function-call. So per round we stream text deltas, then if the candidate
 * ends in functionCall(s) we execute them and start the next round.
 */
export async function streamToolLoop({
  apiKey,
  model = GEMINI_ROSA_MODEL,
  systemPrompt,
  history,
  tools,
  executeTool,
  maxRounds = 8,
  maxTokens = 2000,
  emit,
}: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  history: Content[];
  tools: ReadonlyArray<RosaToolDefinition>;
  executeTool: ToolExecutor;
  maxRounds?: number;
  maxTokens?: number;
  emit: (event: StreamEvent) => void;
}): Promise<ToolLoopResult> {
  const client = getGeminiClient(apiKey);
  const geminiTools = toGeminiFunctionDeclarations(tools);
  const generativeModel = buildModel(client, model, systemPrompt, geminiTools, maxTokens);

  const conversation = [...history];
  const toolAudit: ToolCallAudit[] = [];
  let finalText = '';
  let stoppedEarly = false;
  let lastRound = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    lastRound = round + 1;

    const streamResult = await generativeModel.generateContentStream({ contents: conversation });

    let roundText = '';
    const functionCalls: FunctionCall[] = [];
    // Preserve the model's parts verbatim. Gemini 3.x requires
    // `thoughtSignature` (a sibling of `functionCall` on the Part) to
    // round-trip unchanged or the follow-up request 400s.
    const modelParts: Part[] = [];

    for await (const chunk of streamResult.stream) {
      const candidates = chunk.candidates ?? [];
      for (const cand of candidates) {
        for (const part of partsFromCandidate(cand)) {
          modelParts.push(part);
          if (typeof (part as any).text === 'string') {
            const delta = (part as any).text as string;
            if (delta) {
              roundText += delta;
              emit({ type: 'text', data: { delta } });
            }
          } else if ((part as any).functionCall) {
            functionCalls.push((part as any).functionCall as FunctionCall);
          }
        }
      }
    }

    if (roundText) finalText += roundText;

    if (functionCalls.length === 0) break;

    conversation.push({ role: 'model', parts: modelParts });

    const responseParts: Part[] = [];
    for (const fc of functionCalls) {
      emit({ type: 'tool_use', data: { name: fc.name, input: fc.args ?? {} } });
      const res = await executeTool(fc.name, fc.args ?? {});
      toolAudit.push({
        name: fc.name,
        input: fc.args ?? {},
        is_error: res.is_error,
        preview: res.content.slice(0, 240),
        audit: res.audit,
      });
      emit({
        type: 'tool_result',
        data: {
          name: fc.name,
          is_error: res.is_error,
          content: res.content,
        },
      });
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: res.is_error
            ? { error: res.content }
            : safeParseJson(res.content) ?? { content: res.content },
        },
      });
    }
    conversation.push({ role: 'function', parts: responseParts });

    if (round === maxRounds - 1) stoppedEarly = true;
  }

  return { text: finalText, tools: toolAudit, rounds: lastRound, stopped_early: stoppedEarly };
}

/**
 * Vision-aware structured extraction. Uses Gemini's responseMimeType
 * to force JSON output, no markdown or prose.
 */
export async function extractStructured({
  apiKey,
  model = GEMINI_FAST_MODEL,
  attachment,
  fields,
  documentKind,
  maxTokens = 1500,
}: {
  apiKey: string;
  model?: string;
  attachment: LoadedAttachmentLike;
  fields: string[];
  documentKind?: string;
  maxTokens?: number;
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const client = getGeminiClient(apiKey);
    const generativeModel = client.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    });

    const keys = fields.length > 0
      ? fields.join(', ')
      : 'any fields that look structured and relevant';
    const kind = documentKind ?? 'document';
    const instruction = `Look at the attached ${kind} and extract the following fields as a single flat JSON object: ${keys}.

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no code fences.
- If a field is missing, use null.
- Use ISO 8601 for dates (YYYY-MM-DD).
- Numeric values as numbers, not strings. Strip units; name the unit in a separate key when relevant (e.g. "quantity_value" + "quantity_unit").
- Do not invent values. If uncertain, return null and add a key "uncertainty_notes" with a short reason.`;

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [toGeminiInlineData(attachment), { text: instruction }],
        },
      ],
    });

    logGeminiUsage('extract_structured', model, result);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return { ok: true, data: JSON.parse(cleaned) as Record<string, unknown> };
    } catch {
      return { ok: false, error: 'Could not parse extraction response as JSON' };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Extraction failed' };
  }
}

/**
 * Single-shot prompt with Google Search grounding. The model searches the
 * live web and grounds its answer in real results — the Gemini equivalent of
 * Anthropic's `web_search` server tool. Returns the raw text; callers that
 * want JSON should prompt for it and parse (grounding cannot be combined with
 * `responseMimeType: application/json`).
 *
 * Note: the installed @google/generative-ai (0.24.1) only types the legacy
 * `googleSearchRetrieval`; Gemini 2.0+/3.x require the `googleSearch` tool, so
 * we pass it through with a cast (the SDK forwards tools to the API verbatim).
 */
export async function runGroundedSearch({
  apiKey,
  model = GEMINI_FAST_MODEL,
  prompt,
  maxTokens = 8000,
  temperature = 0.4,
}: {
  apiKey: string;
  model?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = getGeminiClient(apiKey);
  const generativeModel = client.getGenerativeModel({
    model,
    tools: [{ googleSearch: {} } as unknown as Tool],
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  });
  const result = await generativeModel.generateContent(prompt);
  logGeminiUsage('grounded_search', model, result);
  return result.response.text();
}

/**
 * Single-shot text→text prompt. The migration workhorse for everything that
 * used `anthropic.messages.create({ messages:[{role:'user',content}] })` and
 * read `response.content[0].text`. Logs token usage.
 */
/**
 * Hard ceiling for a single non-interactive Gemini call. Without this,
 * a stalled request blocks forever — and in the scraping pipeline (which
 * makes several LLM calls per brand inside one Inngest step) a single
 * hung call runs the step to its maxDuration, gets retried, and leaves
 * the job stuck `running`. A timeout turns a hang into a clean error the
 * caller can fall back on, so the job always completes.
 */
const GEMINI_CALL_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`gemini_timeout:${label}:${ms}ms`)), ms),
    ),
  ]);
}

export async function runTextPrompt({
  apiKey,
  model = GEMINI_FAST_MODEL,
  prompt,
  maxTokens = 1024,
  temperature,
  op = 'text',
}: {
  apiKey: string;
  model?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  op?: string;
}): Promise<string> {
  const client = getGeminiClient(apiKey);
  const generativeModel = client.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
    },
  });
  const result = await withTimeout(generativeModel.generateContent(prompt), GEMINI_CALL_TIMEOUT_MS, op);
  logGeminiUsage(op, model, result);
  return result.response.text();
}

/**
 * Single-shot text→JSON prompt with `responseMimeType: application/json`.
 * Strips stray code fences and parses; returns null on parse failure so
 * callers keep their existing fallback behaviour. Logs token usage.
 */
export async function runJsonPrompt<T = Record<string, unknown>>({
  apiKey,
  model = GEMINI_FAST_MODEL,
  prompt,
  maxTokens = 2048,
  op = 'json',
}: {
  apiKey: string;
  model?: string;
  prompt: string;
  maxTokens?: number;
  op?: string;
}): Promise<T | null> {
  const client = getGeminiClient(apiKey);
  const generativeModel = client.getGenerativeModel({
    model,
    generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  });
  const result = await withTimeout(generativeModel.generateContent(prompt), GEMINI_CALL_TIMEOUT_MS, op);
  logGeminiUsage(op, model, result);
  const text = result.response
    .text()
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function safeParseJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    return { content: v };
  } catch {
    return null;
  }
}
