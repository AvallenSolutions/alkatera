/**
 * Pulse -- Share an insight via email or PDF.
 *
 * POST /api/pulse/insights/:id/share
 * Body:
 *   { channel: 'email', recipients: string[], message?: string }
 *   { channel: 'pdf' }            (returns the PDF binary)
 *
 * Auth: caller must be a member of the insight's organisation.
 *
 * Email is sent through Resend reusing the same sender as the marketing
 * forms. PDF generation goes through PDFShift via the existing client at
 * lib/pdf/pdfshift-client.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { renderInsightShareHtml } from '@/lib/pulse/insight-share';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EMAIL_FROM = 'alkatera Pulse <pulse@mail.alkatera.com>';
const MAX_RECIPIENTS = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Auth.
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const insightId = params.id;
    if (!insightId) return NextResponse.json({ error: 'Missing insight id' }, { status: 400 });

    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const channel = body?.channel;
    if (channel !== 'email' && channel !== 'pdf') {
      return NextResponse.json({ error: 'channel must be "email" or "pdf"' }, { status: 400 });
    }

    // Load insight + verify caller belongs to the org.
    const svc = serviceClient();
    const { data: insight, error: insightErr } = await svc
      .from('dashboard_insights')
      .select('id, organization_id, headline, narrative_md, generated_at, period, model, supporting_metrics')
      .eq('id', insightId)
      .maybeSingle();
    if (insightErr || !insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    const { data: membership } = await userSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', insight.organization_id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    const { data: org } = await svc
      .from('organizations')
      .select('name')
      .eq('id', insight.organization_id)
      .maybeSingle();

    const html = renderInsightShareHtml({
      organisation_name: org?.name ?? 'Your organisation',
      headline: insight.headline,
      narrative_md: insight.narrative_md,
      generated_at: insight.generated_at,
      period: (insight.period as 'daily' | 'weekly') ?? 'daily',
      model: insight.model,
      supporting_metrics: insight.supporting_metrics as any,
      app_url: `${request.nextUrl.origin}/pulse`,
      message: typeof body?.message === 'string' ? body.message : null,
    });

    if (channel === 'pdf') {
      const { buffer } = await convertHtmlToPdf(html, {
        format: 'A4',
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      const filename = `pulse-insight-${insight.generated_at.slice(0, 10)}.pdf`;
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // channel === 'email'
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
    }
    const recipients: string[] = Array.isArray(body?.recipients) ? body.recipients : [];
    const cleaned = Array.from(new Set(recipients.map((r: string) => r.trim()).filter(Boolean)));
    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'recipients required' }, { status: 400 });
    }
    if (cleaned.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Max ${MAX_RECIPIENTS} recipients per send` }, { status: 400 });
    }
    for (const r of cleaned) {
      if (!EMAIL_RE.test(r)) {
        return NextResponse.json({ error: `Invalid email: ${r}` }, { status: 400 });
      }
    }

    const resend = new Resend(apiKey);
    const sendRes = await resend.emails.send({
      from: EMAIL_FROM,
      to: cleaned,
      replyTo: user.email ?? undefined,
      subject: `Pulse: ${insight.headline}`,
      html,
    });

    if ((sendRes as any).error) {
      return NextResponse.json({ error: (sendRes as any).error.message ?? 'Send failed' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      delivered_to: cleaned,
      message_id: (sendRes as any).data?.id ?? null,
    });
  } catch (err: any) {
    console.error('[pulse share]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
