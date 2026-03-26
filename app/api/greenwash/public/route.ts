import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// In-memory rate limiting: one scan per email (resets on server restart)
const usedEmails = new Map<string, number>();

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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a legal compliance expert specializing in environmental marketing claims and anti-greenwashing legislation. You analyze content for potential greenwashing risks.

## LEGISLATION FRAMEWORK

### UK Legislation
**Green Claims Code (CMA, 2021)** - 6 Principles:
1. Claims must be truthful and accurate
2. Claims must be clear and unambiguous
3. Claims must not omit or hide important information
4. Comparisons must be fair and meaningful
5. Claims must consider the full life cycle
6. Claims must be substantiated

**Digital Markets, Competition and Consumers Act 2024**: Enables direct enforcement with penalties up to 10% of global turnover.

### EU Legislation
**Directive on Empowering Consumers for the Green Transition (2024/825)**:
- Bans generic environmental claims ('eco-friendly', 'green', 'climate neutral') unless backed by recognized certification
- Sustainability labels require third-party certification
- Carbon offsetting claims are restricted - cannot claim 'climate neutral' based only on offsets

**Green Claims Directive (Proposed)**:
- All environmental claims must be substantiated based on scientific evidence
- Must clearly communicate scope, limitations, and supporting evidence
- Comparative claims must use equivalent methods and data

## COMMON GREENWASHING ISSUES
- vague_claim: Generic environmental terms without specifics
- unsubstantiated: Claims without evidence
- misleading_comparison: Unfair comparisons
- hidden_tradeoff: Highlighting benefits while hiding impacts
- false_label: Using labels without proper certification
- carbon_offset_claim: Climate neutrality based only on offsets
- absolute_claim: Blanket claims like "100% sustainable"
- future_promise: Unverifiable future commitments

## RESPONSE REQUIREMENTS

Analyze the content thoroughly and respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):

{
  "overall_risk_level": "low" | "medium" | "high",
  "overall_risk_score": 0-100,
  "summary": "2-3 sentence summary of findings",
  "recommendations": ["Array of 3-5 top recommendations"],
  "legislation_applied": [
    {"name": "Legislation name", "jurisdiction": "uk" | "eu" | "both", "key_requirement": "Brief description"}
  ],
  "claims": [
    {
      "claim_text": "Exact text of the problematic claim",
      "claim_context": "Surrounding context if helpful",
      "risk_level": "low" | "medium" | "high",
      "risk_score": 0-100,
      "issue_type": "One of the common issue types",
      "issue_description": "Clear explanation of why this is problematic",
      "legislation_name": "Specific law being potentially violated",
      "legislation_article": "Specific article/principle if applicable",
      "legislation_jurisdiction": "uk" | "eu" | "both",
      "suggestion": "Actionable advice to fix this issue",
      "suggested_revision": "Optional: How to reword the claim"
    }
  ]
}

IMPORTANT:
- Be thorough but fair - not every environmental statement is greenwashing
- Focus on claims that could genuinely mislead consumers
- Provide constructive, actionable feedback
- If content has no environmental claims, return overall_risk_level "low" with empty claims array
- Risk scores: high (70-100), medium (40-69), low (0-39)
- Return ONLY the JSON object, no other text`;

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

    // Remove unwanted elements
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, email, name, company } = body;

    // Validate required fields
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

    // Rate limit: one scan per email
    const emailKey = email.toLowerCase().trim();
    if (usedEmails.has(emailKey)) {
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

    // Validate URL
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

    // Fetch page content (single page, no crawling)
    const content = await fetchPageContent(normalizedUrl);

    if (!content) {
      return NextResponse.json(
        { error: 'Could not fetch content from that URL. Please check the address and try again.' },
        { status: 422 }
      );
    }

    // Content fetched successfully - now mark email as used and add to Sender
    usedEmails.set(emailKey, Date.now());
    addToSender(email, name, company);

    // Call Anthropic API
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'Analysis service is temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 8192,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analyse the following content for greenwashing risks:\n\n${content.substring(0, 30000)}`,
            },
          ],
        }),
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Analysis timed out. The page content may be too large.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`Anthropic API error ${aiResponse.status}:`, errorText);
      return NextResponse.json(
        { error: 'Analysis failed. Please try again later.' },
        { status: 502 }
      );
    }

    const data = await aiResponse.json();

    if (!data.content?.[0]?.text) {
      return NextResponse.json(
        { error: 'Unexpected response from analysis service.' },
        { status: 502 }
      );
    }

    const responseText = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse analysis results.' },
        { status: 502 }
      );
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      url: normalizedUrl,
      ...analysisResult,
    });
  } catch (error) {
    console.error('Public greenwash scan error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
