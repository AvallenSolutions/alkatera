import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * /api/email/unsubscribe?token=<invitation_token>
 *
 * Backs the List-Unsubscribe and List-Unsubscribe-Post headers on supplier
 * invitations. Since February 2024 Yahoo and Gmail expect one-click
 * unsubscribe on anything that looks bulk and treat its absence as a negative
 * reputation signal, which is part of why these invitations were landing in
 * junk.
 *
 * POST is the RFC 8058 one-click path: mail clients post
 * `List-Unsubscribe=One-Click` with no user interaction, so it must be
 * side-effecting on its own and must not require a confirmation step.
 * GET is the human path and renders a confirmation page.
 *
 * The invitation token is the credential: it only ever existed in the message
 * delivered to this recipient, so possession is proof enough to opt out. No
 * separate token infrastructure needed.
 */

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } },
  );
}

async function optOut(token: string): Promise<{ ok: boolean; email?: string }> {
  const supabase = serviceClient();

  const { data: invitation } = await supabase
    .from('supplier_invitations')
    .select('id, supplier_email')
    .eq('invitation_token', token)
    .maybeSingle();

  if (!invitation) return { ok: false };

  await supabase
    .from('supplier_invitations')
    .update({
      status: 'expired',
      email_status: 'unsubscribed',
      email_status_at: new Date().toISOString(),
      request_status: 'declined',
      request_decline_reason: 'Unsubscribed via email',
    })
    .eq('id', invitation.id);

  return { ok: true, email: invitation.supplier_email };
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const result = await optOut(token);
  // Always 200 for one-click: mail clients surface a failure to the reader as
  // "unsubscribe didn't work", and an unknown or already-expired token is not
  // a state the recipient can do anything about.
  if (!result.ok) {
    console.warn('[email/unsubscribe] Unknown token on one-click unsubscribe');
  }
  return NextResponse.json({ unsubscribed: true });
}

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} | alkatera</title>
</head>
<body style="margin:0;padding:48px 16px;background:#F2F1EA;color:#1A1B1D;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px;background:#ffffff;border:1px solid #D9D6CB;text-align:center;">
    <h1 style="color:#205E40;font-family:'Courier New',monospace;font-size:14px;text-transform:uppercase;letter-spacing:3px;margin:0 0 16px 0;">${title}</h1>
    <p style="color:#1A1B1D;font-size:15px;line-height:1.7;margin:0;">${body}</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return page('Unsubscribe', 'This unsubscribe link is missing its token.');
  }

  const result = await optOut(token);
  if (!result.ok) {
    return page(
      'Unsubscribe',
      'This link has already been used or has expired. You will not receive further reminders about this request.',
    );
  }

  return page(
    'Unsubscribed',
    'You will not receive any further emails about this sustainability survey. If this was a mistake, reply to the original message and the company that invited you can send it again.',
  );
}
