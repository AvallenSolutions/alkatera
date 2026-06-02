/**
 * Lightweight per-call AI token logging. Emits one greppable line per model
 * call so the real token cost of an import/scrape can be summed from the
 * Netlify function logs (search `[ai-usage]`). Cheap and side-effect-free —
 * we don't have a metering table, this is the pragmatic visibility layer.
 *
 * Example:
 *   [ai-usage] provider=gemini op=website_finder model=gemini-3.5-flash in=210 out=180 total=390
 */

interface GeminiLike {
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  response?: GeminiLike;
}

export function logGeminiUsage(op: string, model: string, result: unknown): void {
  const r = result as GeminiLike | undefined;
  const u = r?.usageMetadata ?? r?.response?.usageMetadata;
  if (!u) return;
  const inTok = u.promptTokenCount ?? 0;
  const outTok = u.candidatesTokenCount ?? 0;
  const total = u.totalTokenCount ?? inTok + outTok;
  console.log(`[ai-usage] provider=gemini op=${op} model=${model} in=${inTok} out=${outTok} total=${total}`);
}

export function logClaudeUsage(op: string, model: string, message: unknown): void {
  const u = (message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)
    ?.usage;
  if (!u) return;
  const inTok = u.input_tokens ?? 0;
  const outTok = u.output_tokens ?? 0;
  console.log(`[ai-usage] provider=claude op=${op} model=${model} in=${inTok} out=${outTok} total=${inTok + outTok}`);
}
