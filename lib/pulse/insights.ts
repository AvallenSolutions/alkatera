/**
 * Pulse — AI insight generator.
 *
 * Builds a structured prompt from the org's snapshot deltas + open anomalies
 * + at-risk targets, sends it to Claude, and returns a parsed insight ready
 * for dashboard_insights.
 *
 * Cost discipline: we use Sonnet 4.6 by default (the cheaper, fast model) and
 * Opus 4.6 only for the weekly deep-dive period.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { METRIC_DEFINITIONS, type MetricKey } from './metric-keys';

export interface GeneratedInsight {
  headline: string;
  narrative_md: string;
  supporting_metrics: Record<string, unknown>;
  confidence: number | null;
  model: string;
}

const SONNET = 'claude-sonnet-4-6';
const OPUS = 'claude-opus-4-6';

const SYSTEM_PROMPT = `You are the alkatera Pulse insight writer. You read a snapshot of an organisation's sustainability data and write a concise, evidence-backed brief explaining what changed and what to do about it.

Voice: British English, plain, candid, avoid corporate jargon, never use em dashes. Always reference specific numbers from the data, never invent figures. Keep it tight: 1 short headline (max 12 words) and 3-5 sentences of narrative.

Output strict JSON matching this shape:
{
  "headline": "string",
  "narrative_md": "string (markdown allowed)",
  "confidence": number between 0 and 1
}`;

interface SnapshotInput {
  metric_key: MetricKey;
  current: number;
  prior: number | null;
  unit: string;
  delta_pct: number | null;
}

interface AnomalyInput {
  metric_key: MetricKey;
  severity: string;
  observed: number;
  expected: number;
  z_score: number;
}

interface TargetInput {
  metric_key: MetricKey;
  target_value: number;
  target_date: string;
  status: 'on_track' | 'at_risk' | 'off_track' | 'unknown';
}

/** Pull the data needed to brief Claude. */
export async function gatherInsightContext(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{
  snapshots: SnapshotInput[];
  anomalies: AnomalyInput[];
  targets: TargetInput[];
}> {
  // Latest snapshot per metric vs the snapshot ~30 days prior.
  const sinceStr = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from('metric_snapshots')
    .select('metric_key, snapshot_date, value, unit')
    .eq('organization_id', orgId)
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: true });

  const byKey = new Map<string, { date: string; value: number; unit: string }[]>();
  for (const r of rows ?? []) {
    const arr = byKey.get(r.metric_key) ?? [];
    arr.push({ date: r.snapshot_date as string, value: Number(r.value), unit: r.unit as string });
    byKey.set(r.metric_key, arr);
  }

  const snapshots: SnapshotInput[] = [];
  // Array.from required: tsconfig target doesn't allow direct Map iteration.
  for (const [key, history] of Array.from(byKey.entries())) {
    const current = history[history.length - 1];
    const prior =
      history.find(
        (h: { date: string; value: number; unit: string }) =>
          Math.abs(daysBetween(h.date, current.date) - 30) < 7,
      ) ?? history[0];
    const deltaPct =
      prior && prior.value !== 0
        ? ((current.value - prior.value) / Math.abs(prior.value)) * 100
        : null;
    snapshots.push({
      metric_key: key as MetricKey,
      current: current.value,
      prior: prior?.value ?? null,
      unit: current.unit,
      delta_pct: deltaPct,
    });
  }

  const { data: anomalyRows } = await supabase
    .from('dashboard_anomalies')
    .select('metric_key, severity, observed, expected, z_score')
    .eq('organization_id', orgId)
    .eq('status', 'open')
    .order('detected_at', { ascending: false })
    .limit(10);
  const anomalies: AnomalyInput[] = (anomalyRows ?? []).map(a => ({
    metric_key: a.metric_key as MetricKey,
    severity: a.severity as string,
    observed: Number(a.observed),
    expected: Number(a.expected),
    z_score: Number(a.z_score),
  }));

  const { data: targetRows } = await supabase
    .from('sustainability_targets')
    .select('metric_key, target_value, target_date')
    .eq('organization_id', orgId)
    .eq('status', 'active');
  const targets: TargetInput[] = (targetRows ?? []).map(t => ({
    metric_key: t.metric_key as MetricKey,
    target_value: Number(t.target_value),
    target_date: t.target_date as string,
    status: 'unknown',
  }));

  return { snapshots, anomalies, targets };
}

export interface GenerateInsightOptions {
  /** 'daily' uses Sonnet; 'weekly' uses Opus. */
  period?: 'daily' | 'weekly';
}

/** Call Claude and parse the JSON response. */
export async function generateInsight(
  context: Awaited<ReturnType<typeof gatherInsightContext>>,
  options: GenerateInsightOptions = {},
): Promise<GeneratedInsight | null> {
  // Trim because Claude Code (and some other parent processes) inject an
  // empty ANTHROPIC_API_KEY="" for security; Next.js's dotenv then skips
  // loading the real key from .env.local because the env var "exists".
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      '[Pulse insights] ANTHROPIC_API_KEY missing or empty; skipping generation. ' +
        'For local dev, ensure your shell does not export an empty ANTHROPIC_API_KEY ' +
        'before starting the dev server (Claude Code sets it to "" by default).',
    );
    return null;
  }

  const period = options.period ?? 'daily';
  const model = period === 'weekly' ? OPUS : SONNET;

  // Lazy-import to keep client bundle small.
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const userPrompt = buildPrompt(context, period);

  const response = await client.messages.create({
    model,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') {
    console.error('[Pulse insights] no text block in response', {
      model,
      content_types: response.content.map(b => b.type),
    });
    return null;
  }
  const raw = block.text.trim();

  // Some Sonnet outputs wrap JSON in fenced code blocks, sometimes preceded
  // by a short preamble ("Here is the JSON: ```json {…} ```"). Be liberal in
  // what we accept: try a fenced extraction first, fall back to extracting
  // the first {…} substring, and only then attempt the raw text.
  const candidates: string[] = [];
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) candidates.push(fencedMatch[1].trim());
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    candidates.push(raw.slice(braceStart, braceEnd + 1));
  }
  candidates.push(raw);

  let parsed: { headline?: string; narrative_md?: string; confidence?: number } | null = null;
  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      parsed = JSON.parse(c);
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!parsed) {
    console.error('[Pulse insights] failed to parse JSON from Claude', {
      model,
      raw_preview: raw.slice(0, 400),
      parse_error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    });
    return null;
  }
  if (!parsed.headline || !parsed.narrative_md) {
    console.error('[Pulse insights] response missing required fields', {
      model,
      has_headline: Boolean(parsed.headline),
      has_narrative: Boolean(parsed.narrative_md),
      raw_preview: raw.slice(0, 400),
    });
    return null;
  }

  return {
    headline: parsed.headline,
    narrative_md: parsed.narrative_md,
    supporting_metrics: {
      snapshots: context.snapshots,
      anomalies: context.anomalies,
      targets: context.targets,
    },
    confidence: parsed.confidence ?? null,
    model,
  };
}

function buildPrompt(
  ctx: Awaited<ReturnType<typeof gatherInsightContext>>,
  period: 'daily' | 'weekly',
): string {
  const snapshotLines = ctx.snapshots.map(s => {
    const def = METRIC_DEFINITIONS[s.metric_key];
    const label = def?.label ?? s.metric_key;
    const deltaStr =
      s.delta_pct === null ? 'no prior reading' : `${s.delta_pct.toFixed(1)}%`;
    return `- ${label}: ${formatNumber(s.current)} ${s.unit} (Δ ${deltaStr} vs ~30 days ago)`;
  });

  const anomalyLines =
    ctx.anomalies.length === 0
      ? '- none open'
      : ctx.anomalies.map(a => {
          const def = METRIC_DEFINITIONS[a.metric_key];
          return `- [${a.severity}] ${def?.label ?? a.metric_key}: observed ${formatNumber(a.observed)}, expected ~${formatNumber(a.expected)} (z=${a.z_score.toFixed(1)})`;
        });

  const targetLines =
    ctx.targets.length === 0
      ? '- none set'
      : ctx.targets.map(t => {
          const def = METRIC_DEFINITIONS[t.metric_key];
          return `- ${def?.label ?? t.metric_key} → ${formatNumber(t.target_value)} by ${t.target_date}`;
        });

  return [
    `Please brief me on the ${period === 'weekly' ? 'last week' : 'last 24 hours'} of sustainability data for this alkatera org.`,
    '',
    'METRIC SNAPSHOTS:',
    ...(typeof snapshotLines === 'string' ? [snapshotLines] : snapshotLines),
    '',
    'OPEN ANOMALIES:',
    ...(typeof anomalyLines === 'string' ? [anomalyLines] : anomalyLines),
    '',
    'ACTIVE TARGETS:',
    ...(typeof targetLines === 'string' ? [targetLines] : targetLines),
    '',
    'Write the insight as JSON only. No prose outside the JSON.',
  ].join('\n');
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.abs(ms) / 86400_000;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

/** Insert a generated insight into dashboard_insights. */
export async function persistInsight(
  supabase: SupabaseClient,
  orgId: string,
  insight: GeneratedInsight,
  period: 'daily' | 'weekly',
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('dashboard_insights')
    .insert({
      organization_id: orgId,
      period,
      headline: insight.headline,
      narrative_md: insight.narrative_md,
      supporting_metrics: insight.supporting_metrics,
      confidence: insight.confidence,
      model: insight.model,
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}
