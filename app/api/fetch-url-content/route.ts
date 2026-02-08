import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

async function authenticateRequest(): Promise<{ authenticated: boolean }> {
  try {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    return { authenticated: !error && !!user };
  } catch {
    return { authenticated: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const { authenticated } = await authenticateRequest();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, platform, crawlSubpages = true, maxPages = 10 } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Normalize URL - add https:// if no protocol is provided
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
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    // SSRF protection: block internal/private IP ranges
    if (isBlockedHost(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Access to internal addresses is not allowed' },
        { status: 400 }
      );
    }

    // Fetch main page
    const mainContent = await fetchPageContent(normalizedUrl);

    if (!mainContent) {
      return NextResponse.json(
        { error: 'Failed to fetch content from URL' },
        { status: 500 }
      );
    }

    let allContent = mainContent.text;
    const visitedUrls = new Set<string>([normalizedUrl]);

    // Crawl subpages if enabled
    if (crawlSubpages && mainContent.links.length > 0) {
      const baseHost = parsedUrl.host;
      const subpageLinks = mainContent.links
        .filter((link) => {
          try {
            const linkUrl = new URL(link, normalizedUrl);
            // Only crawl same-domain links
            return linkUrl.host === baseHost && !visitedUrls.has(linkUrl.href);
          } catch {
            return false;
          }
        })
        .slice(0, maxPages - 1); // Limit subpages

      for (const link of subpageLinks) {
        try {
          const absoluteUrl = new URL(link, normalizedUrl).href;
          if (visitedUrls.has(absoluteUrl)) continue;

          visitedUrls.add(absoluteUrl);
          const subContent = await fetchPageContent(absoluteUrl);

          if (subContent) {
            allContent += `\n\n--- Page: ${absoluteUrl} ---\n\n${subContent.text}`;
          }
        } catch (error) {
          // Skip failed subpages silently
        }
      }
    }

    return NextResponse.json({
      content: allContent,
      pagesAnalyzed: visitedUrls.size,
      url: normalizedUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch URL content' },
      { status: 500 }
    );
  }
}

async function fetchPageContent(url: string): Promise<{ text: string; links: string[] } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

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

    // Extract text content
    const textContent: string[] = [];

    // Get page title
    const title = $('title').text().trim();
    if (title) {
      textContent.push(`Title: ${title}`);
    }

    // Get meta description
    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription) {
      textContent.push(`Description: ${metaDescription}`);
    }

    // Get main content areas
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '#main',
      '.post-content',
      '.entry-content',
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

    // If no main content area found, get body text
    if (!foundMain) {
      textContent.push($('body').text().trim());
    }

    // Clean up text
    const cleanText = textContent
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Extract links for subpage crawling
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        links.push(href);
      }
    });

    return {
      text: cleanText,
      links: Array.from(new Set(links)), // Deduplicate
    };
  } catch (error) {
    return null;
  }
}
