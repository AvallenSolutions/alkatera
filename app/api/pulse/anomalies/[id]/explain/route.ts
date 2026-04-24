/**
 * Pulse -- Anomaly explanation endpoint.
 *
 * POST /api/pulse/anomalies/:id/explain
 *
 * Asks Rosa (with the full tool catalogue) to investigate the anomaly
 * and produce a 3-bullet root-cause hypothesis. Result is cached on
 * the anomaly row so a second open is instant.
 *
 * Body:
 *   { force?: boolean }  // when true, regenerate even if cached
 *
 * Response:
 *   {
 *     ok: true,
 *     cached: boolean,
 *     explanation: { headline, bullets, tools_called, model, generated_at }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { runToolLoop } from '@/lib/rosa/run-tool-loop';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Rosa, the alkatera sustainability AI, investigating an anomaly that the platform has flagged.

Voice: British English, plain, candid. Short sentences. Never use em dashes.

Your job:
1. Use the tools to gather evidence about the anomaly: when did the metric move, which facility or product is responsible, what else changed in the same window.
2. Form the most likely root-cause hypothesis. Be honest about uncertainty.
3. Reply with a JSON object ONLY, in this exact shape (no extra prose, no markdown fences):
   {
     "headline": "One sentence stating the most likely cause.",
     "bullets": [
       "Evidence point 1, with a number from a tool result.",
       "Evidence point 2.",
       "Evidence point 3 (optional)."
     ]
   }
4. Maximum 3 bullets. Each cites a number you actually pulled. If you genuinely cannot find a cause, say so in the headline and use bullets to list what you checked.`;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const anomalyId = params.id;
    const { data: anomaly } = await svc
      .from('dashboard_anomalies')
      .select('id, organization_id, metric_key, detected_at, severity, observed, expected, z_score, explanation, explanation_generated_at')
      .eq('id', anomalyId)
      .maybeSingle();

    if (!anomaly) {
      return NextResponse.json({ error: 'Anomaly not found' }, { status: 404 });
    }

    // Verify caller is a member of the anomaly's org.
    const { data: membership } = await userSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', anomaly.organization_id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    let body: { force?: boolean } = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }

    // Serve cached explanation if present and not forced.
    if (!body.force && anomaly.explanation) {
      return NextResponse.json({
        ok: true,
        cached: true,
        explanation: {
          ...(anomaly.explanation as Record<string, unknown>),
          generated_at: anomaly.explanation_generated_at,
        },
      });
    }

    // Build the investigative prompt.
    const def = METRIC_DEFINITIONS[anomaly.metric_key as MetricKey];
    const metricLabel = def?.label ?? anomaly.metric_key;
    const unit = def?.unit ?? '';
    const direction = anomaly.observed > anomaly.expected ? 'higher' : 'lower';
    const deltaPct =
      anomaly.expected !== 0
        ? Math.round(((anomaly.observed - anomaly.expected) / Math.abs(anomaly.expected)) * 100)
        : 0;

    const userMessage = `Investigate this anomaly:

- Metric: ${metricLabel}
- Detected: ${anomaly.detected_at}
- Severity: ${anomaly.severity}
- Observed: ${anomaly.observed} ${unit}
- Expected (rolling baseline): ${anomaly.expected} ${unit}
- Delta: ${deltaPct > 0 ? '+' : ''}${deltaPct}% (${direction} than baseline)
- Z-score: ${anomaly.z_score}

Use the tools to find what caused this. Look at the metric history around the date, the facility-level breakdown, and recent product / supplier changes. Reply with the JSON object only.`;

    const result = await runToolLoop({
      apiKey,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      toolContext: {
        supabase: svc,
        organizationId: anomaly.organization_id,
        userId: user.id,
      },
      model: MODEL,
      maxRounds: 4,
    });

    // Parse the model's JSON response. Be tolerant of stray prose / fences.
    const parsed = parseJsonResponse(result.text);
    const explanation = {
      headline: parsed.headline ?? 'Could not parse explanation.',
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 3) : [],
      tools_called: result.tools.map(t => ({ name: t.name, input: t.input, is_error: t.is_error })),
      model: MODEL,
      raw: parsed.headline ? undefined : result.text.slice(0, 1000),
    };

    // Cache on the row.
    await svc
      .from('dashboard_anomalies')
      .update({
        explanation,
        explanation_generated_at: new Date().toISOString(),
      })
      .eq('id', anomalyId);

    return NextResponse.json({
      ok: true,
      cached: false,
      explanation: { ...explanation, generated_at: new Date().toISOString() },
    });
  } catch (err: any) {
    console.error('[pulse anomaly explain]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}

/** Pull a JSON object out of the model response, tolerating ```json fences. */
function parseJsonResponse(text: string): { headline?: string; bullets?: string[] } {
  if (!text) return {};
  // Strip markdown fences.
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Find the first { ... } block.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return {};
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}
