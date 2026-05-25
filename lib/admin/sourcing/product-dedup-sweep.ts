import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface ProductRow {
  id: string;
  name: string;
  gtin: string | null;
  category: string | null;
  abv: number | null;
  container_size_ml: number | null;
  container_format: string | null;
}

export interface DupeGroup {
  /** id we want to keep (the canonical). Picked deliberately by the model — see prompt rules. */
  canonical_id: string;
  /** ids that should be folded into the canonical. */
  duplicate_ids: string[];
  /** 0..1. We auto-merge only at ≥0.85; otherwise we surface to the admin. */
  confidence: number;
  /** Short explanation. */
  reason: string;
}

export interface ProductDedupSweepResult {
  groups: DupeGroup[];
  /** Tokens / summary metadata for telemetry. */
  summary?: string;
  error?: string;
}

/**
 * Ask Claude Sonnet to identify duplicate-product groups within a
 * single brand. Returns 0..N groups; each group's canonical_id is the
 * row we keep, with the others folded into it.
 *
 * The caller decides what to do with each group based on confidence:
 *   - ≥0.85: auto-merge
 *   - 0.6–0.85: surface to admin for one-click confirmation
 *   - <0.6: drop (false positive risk too high)
 */
export async function sweepProductDupes(
  brandName: string,
  products: ProductRow[],
): Promise<ProductDedupSweepResult> {
  if (products.length < 2) return { groups: [] };
  const client = getClient();
  if (!client) return { groups: [], error: 'ANTHROPIC_API_KEY not configured' };

  const lines = products.map((p) => formatLine(p)).join('\n');

  const prompt = `You are deduplicating the product list for the drinks brand "${brandName}". Identify groups of rows that refer to the SAME SKU.

A SKU is uniquely identified by (liquid, variant, size). Different sizes of the same liquid are DIFFERENT SKUs. Different blends or editions are DIFFERENT SKUs. Brand-prefix differences ("Two Drifters White Rum 70cl" vs "Pure White Rum 70cl") DO NOT prevent a match.

Products:
${lines}

Return ONE JSON object and NOTHING else:

{
  "summary": "1-sentence note on what you found",
  "groups": [
    {
      "canonical_id": "uuid-of-the-row-to-keep",
      "duplicate_ids": ["uuid-to-fold-in", "uuid-to-fold-in"],
      "confidence": 0.95,
      "reason": "Same liquid + size, different name conventions."
    }
  ]
}

Rules:
- Use ids verbatim from the list above.
- A row's id may appear only once across all groups (either as canonical or as a duplicate).
- Pick the canonical with this precedence: (1) row with a GTIN, (2) row with the most populated fields (size, abv, format, category), (3) shortest cleanest name.
- Confidence is 0..1. Use 0.95+ for unambiguous matches; 0.80–0.94 for high-confidence; <0.80 for "looks similar but I'm not sure".
- Conservative: when in doubt, return NO group. Creating a dupe is recoverable; auto-merging two real SKUs is not.
- Return { "groups": [] } if every product is genuinely distinct.`;

  let text = '';
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    for (const block of response.content) {
      if (block.type === 'text') text += block.text + '\n';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { groups: [], error: `anthropic_error: ${message}` };
  }

  const parsed = extractJson(text);
  if (!parsed) return { groups: [], error: 'model_returned_invalid_json' };
  return {
    groups: sanitiseGroups(parsed.groups, new Set(products.map((p) => p.id))),
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
  };
}

function formatLine(p: ProductRow): string {
  const parts: string[] = [`  - id "${p.id}": ${p.name}`];
  const extras: string[] = [];
  if (p.gtin) extras.push(`GTIN ${p.gtin}`);
  if (p.container_size_ml) extras.push(`${p.container_size_ml}ml`);
  if (p.abv != null) extras.push(`${p.abv}% ABV`);
  if (p.container_format) extras.push(p.container_format);
  if (p.category) extras.push(p.category);
  if (extras.length > 0) parts.push(`(${extras.join(', ')})`);
  return parts.join(' ');
}

function extractJson(text: string): { summary?: unknown; groups?: unknown } | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sanitiseGroups(input: unknown, validIds: Set<string>): DupeGroup[] {
  if (!Array.isArray(input)) return [];
  const out: DupeGroup[] = [];
  const usedIds = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const g = raw as Record<string, unknown>;
    const canonicalId = typeof g.canonical_id === 'string' ? g.canonical_id.trim() : null;
    if (!canonicalId || !validIds.has(canonicalId)) continue;
    if (usedIds.has(canonicalId)) continue;
    const dupeIdsRaw = Array.isArray(g.duplicate_ids) ? g.duplicate_ids : [];
    const dupeIds: string[] = [];
    for (const id of dupeIdsRaw) {
      if (typeof id !== 'string') continue;
      const trimmed = id.trim();
      if (!validIds.has(trimmed)) continue;
      if (trimmed === canonicalId) continue;
      if (usedIds.has(trimmed)) continue;
      dupeIds.push(trimmed);
      usedIds.add(trimmed);
    }
    if (dupeIds.length === 0) continue;
    usedIds.add(canonicalId);
    const confidence = typeof g.confidence === 'number' ? Math.min(1, Math.max(0, g.confidence)) : 0;
    const reason = typeof g.reason === 'string' ? g.reason : '';
    out.push({ canonical_id: canonicalId, duplicate_ids: dupeIds, confidence, reason });
  }
  return out;
}
