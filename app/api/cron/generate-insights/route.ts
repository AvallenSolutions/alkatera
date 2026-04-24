import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import {
  gatherInsightContext,
  generateInsight,
  persistInsight,
} from '@/lib/pulse/insights';

/**
 * Cron: Pulse — generate daily AI insights
 *
 * POST /api/cron/generate-insights
 *
 * Iterates every organisation, builds a structured prompt from their latest
 * snapshots / anomalies / targets, asks Claude for a fresh narrative, and
 * writes it to dashboard_insights. Schedule daily ~06:00.
 *
 * Falls back gracefully if ANTHROPIC_API_KEY is missing — logs and skips.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    // Distinguish "API key not configured" from "Claude call failed for org X".
    // Claude Code injects an empty ANTHROPIC_API_KEY into child processes for
    // security, so we trim and treat empty as missing.
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!anthropicKey) {
      return NextResponse.json(
        {
          error: 'ANTHROPIC_API_KEY missing or empty',
          hint:
            'Set ANTHROPIC_API_KEY in your environment. For local dev, ensure your ' +
            'shell does not export an empty ANTHROPIC_API_KEY (Claude Code does this ' +
            'by default — start the dev server in a terminal where the var is unset).',
        },
        { status: 503 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let written = 0;
    const failures: { organization_id: string; reason: string }[] = [];

    for (const org of orgs ?? []) {
      try {
        const context = await gatherInsightContext(supabase, org.id);
        // Skip orgs with no data at all — nothing meaningful to brief.
        if (context.snapshots.length === 0) {
          failures.push({ organization_id: org.id, reason: 'no_snapshots' });
          continue;
        }
        const insight = await generateInsight(context, { period: 'daily' });
        if (!insight) {
          failures.push({ organization_id: org.id, reason: 'generation_failed' });
          continue;
        }
        const { error: writeError } = await persistInsight(supabase, org.id, insight, 'daily');
        if (writeError) {
          failures.push({ organization_id: org.id, reason: writeError });
        } else {
          written += 1;
        }
      } catch (err: any) {
        const reason = err?.status
          ? `${err.status} ${err.name ?? ''} ${err.message ?? ''}`.trim()
          : err?.message ?? 'unknown';
        console.error(`[generate-insights cron] org ${org.id} failed:`, err);
        failures.push({ organization_id: org.id, reason });
      }
    }

    return NextResponse.json({
      synced: written,
      failed: failures.length,
      total: orgs?.length ?? 0,
      failures,
    });
  } catch (err: any) {
    console.error('[generate-insights cron]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
