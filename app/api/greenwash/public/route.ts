import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// SSRF protection: block private/internal IP ranges
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]$/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80/i,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GreenwashGuardian/1.0; +https://alkatera.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('nav').remove();
    $('footer').remove();
    $('[role="navigation"]').remove();
    $('[role="banner"]').remove();
    $('[role="contentinfo"]').remove();

    const textContent: string[] = [];

    const title = $('title').text().trim();
    if (title) {
      textContent.push(`Title: ${title}`);
    }

    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription) {
      textContent.push(`Description: ${metaDescription}`);
    }

    const mainSelectors = [
      'main', 'article', '[role="main"]', '.content',
      '.main-content', '#content', '#main', '.post-content', '.entry-content',
    ];

    let foundMain = false;
    for (const selector of mainSelectors) {
      const mainElement = $(selector);
      if (mainElement.length > 0) {
        textContent.push(mainElement.text().trim());
        foundMain = true;
        break;
      }
    }

    if (!foundMain) {
      textContent.push($('body').text().trim());
    }

    return textContent
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  } catch {
    return null;
  }
}

async function addToSender(email: string, name?: string, company?: string) {
  const senderToken = process.env.SENDER_API_TOKEN;
  if (!senderToken) {
    console.error('SENDER_API_TOKEN is not configured');
    return;
  }

  const payload: Record<string, unknown> = {
    email,
    tags: ['greenwash-guardian'],
  };

  if (name) {
    const nameParts = name.trim().split(' ');
    payload.firstname = nameParts[0];
    if (nameParts.length > 1) {
      payload.lastname = nameParts.slice(1).join(' ');
    }
  }

  if (company) {
    payload.company = company;
  }

  try {
    const response = await fetch('https://api.sender.net/v2/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sender API error:', response.status, errorText);
    }
  } catch (error) {
    console.error('Sender API call failed:', error);
  }
}

// GET: Poll for scan status
export async function GET(request: NextRequest) {
  const scanId = request.nextUrl.searchParams.get('scanId');
  if (!scanId) {
    return NextResponse.json({ error: 'scanId is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: scan, error } = await supabase
      .from('public_greenwash_scans')
      .select('status, url, overall_risk_level, overall_risk_score, summary, recommendations, legislation_applied, claims, error_message')
      .eq('id', scanId)
      .single();

    if (error || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    if (scan.status === 'completed') {
      return NextResponse.json({
        success: true,
        url: scan.url,
        overall_risk_level: scan.overall_risk_level,
        overall_risk_score: scan.overall_risk_score,
        summary: scan.summary,
        recommendations: scan.recommendations,
        legislation_applied: scan.legislation_applied,
        claims: scan.claims,
      });
    }

    if (scan.status === 'failed') {
      return NextResponse.json(
        { error: scan.error_message || 'Analysis failed' },
        { status: 500 }
      );
    }

    // Still processing
    return NextResponse.json({ status: scan.status }, { status: 202 });
  } catch (err) {
    console.error('Poll error:', err);
    return NextResponse.json({ error: 'Failed to check scan status' }, { status: 500 });
  }
}

// POST: Start a scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, email, name, company } = body;

    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Rate limit: check if this email has already scanned
    const emailKey = email.toLowerCase().trim();
    const { count } = await supabase
      .from('public_greenwash_scans')
      .select('*', { count: 'exact', head: true })
      .eq('email', emailKey);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'You have already used your free scan. Sign up to unlock unlimited scans.', rateLimited: true },
        { status: 429 }
      );
    }

    // Normalise URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { error: 'Please enter a valid URL' },
        { status: 400 }
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    if (isBlockedHost(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Access to internal addresses is not allowed' },
        { status: 400 }
      );
    }

    // Fetch page content
    const content = await fetchPageContent(normalizedUrl);

    if (!content) {
      return NextResponse.json(
        { error: 'Could not fetch content from that URL. Please check the address and try again.' },
        { status: 422 }
      );
    }

    // Add to Sender (fire-and-forget)
    addToSender(email, name, company);

    // Insert scan row into DB
    const { data: scan, error: insertError } = await supabase
      .from('public_greenwash_scans')
      .insert({
        url: normalizedUrl,
        email: emailKey,
        status: 'processing',
        input_content: content.substring(0, 50000),
      })
      .select('id')
      .single();

    if (insertError || !scan) {
      console.error('Failed to create scan:', insertError);
      return NextResponse.json(
        { error: 'Failed to start analysis. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scanId: scan.id });
  } catch (error) {
    console.error('Public greenwash scan error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
