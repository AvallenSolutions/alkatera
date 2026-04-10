import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function buildCallbackUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured');
  const secret = process.env.SLIDESPEAK_WEBHOOK_SECRET;
  if (!secret) throw new Error('SLIDESPEAK_WEBHOOK_SECRET is not configured');
  return `${appUrl}/api/webhooks/slidespeak?secret=${encodeURIComponent(secret)}`;
}

async function requireAdmin(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) return null;

  const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
  if (!isAdmin) return null;

  return userData.user;
}

/**
 * POST /api/admin/slidespeak-webhook
 * Registers our webhook callback URL with SlideSpeak.
 * Only needs to be called once — the subscription persists.
 */
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const apiKey = process.env.SLIDESPEAK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'SLIDESPEAK_API_KEY is not configured' }, { status: 500 });
  }

  let callbackUrl: string;
  try {
    callbackUrl = buildCallbackUrl();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const response = await fetch('https://api.slidespeak.co/api/v1/webhook/subscribe', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint: callbackUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[SlideSpeak] Webhook subscribe failed:', response.status, text);
    return NextResponse.json(
      { error: `SlideSpeak API error: ${response.status} ${text}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  console.log('[SlideSpeak] Webhook subscribed:', callbackUrl);

  return NextResponse.json({ success: true, callbackUrl, response: data });
}

/**
 * DELETE /api/admin/slidespeak-webhook
 * Unregisters our webhook callback URL from SlideSpeak.
 */
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const apiKey = process.env.SLIDESPEAK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'SLIDESPEAK_API_KEY is not configured' }, { status: 500 });
  }

  let callbackUrl: string;
  try {
    callbackUrl = buildCallbackUrl();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const response = await fetch('https://api.slidespeak.co/api/v1/webhook/unsubscribe', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint: callbackUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[SlideSpeak] Webhook unsubscribe failed:', response.status, text);
    return NextResponse.json(
      { error: `SlideSpeak API error: ${response.status} ${text}` },
      { status: 502 }
    );
  }

  const data = await response.json();
  console.log('[SlideSpeak] Webhook unsubscribed:', callbackUrl);

  return NextResponse.json({ success: true, callbackUrl, response: data });
}
