import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
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
          console.error(`Error fetching subpage ${link}:`, error);
        }
      }
    }

    return NextResponse.json({
      content: allContent,
      pagesAnalyzed: visitedUrls.size,
      url: normalizedUrl,
    });
  } catch (error: any) {
    console.error('Error fetching URL content:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch URL content' },
      { status: 500 }
    );
  }
}

async function fetchPageContent(url: string): Promise<{ text: string; links: string[] } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GreenwashGuardian/1.0; +https://alkatera.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
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
    console.error(`Error fetching page ${url}:`, error);
    return null;
  }
}
