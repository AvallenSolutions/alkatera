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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    return { authenticated: !error && !!user };
  } catch {
    return { authenticated: false };
  }
}

interface ImageCandidate {
  url: string;
  alt: string;
  context: string; // nearby text (parent/sibling)
}

interface PageData {
  text: string;
  images: ImageCandidate[];
  links: string[];
}

async function fetchPageData(url: string, baseUrl: string): Promise<PageData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; alkatera/1.0; +https://alkatera.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract images with alt text and nearby context before removing elements
    const images: ImageCandidate[] = [];
    const SKIP_PATTERNS = /icon|logo|avatar|banner|badge|flag|sprite|pixel|tracking|1x1|blank|placeholder/i;
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || '';
      if (!src || !src.startsWith('http')) return;
      if (SKIP_PATTERNS.test(src)) return;

      const alt = ($(el).attr('alt') || '').trim();
      // Grab nearby text: try parent, then grandparent
      const parent = $(el).parent();
      const nearbyText = (parent.text() || parent.parent().text() || '').trim().slice(0, 120);

      // Score: product images usually have descriptive alt text or live in product-related URL paths
      const isProductLike =
        /product|shop|item|bottle|can|pack|range|collection|variant|sku/i.test(src) ||
        alt.length > 3;

      if (isProductLike) {
        images.push({ url: src, alt, context: nearbyText });
      }
    });

    // Extract links before stripping elements
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        links.push(href);
      }
    });

    // Remove unwanted elements for text extraction
    $('script, style, noscript, iframe, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

    const textContent: string[] = [];
    const title = $('title').text().trim();
    if (title) textContent.push(`Title: ${title}`);

    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) textContent.push(`Description: ${metaDesc}`);

    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content', '#main'];
    let foundMain = false;
    for (const selector of mainSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        textContent.push(el.text().trim());
        foundMain = true;
        break;
      }
    }
    if (!foundMain) textContent.push($('body').text().trim());

    const cleanText = textContent
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueImages = images.filter(img => {
      if (seenUrls.has(img.url)) return false;
      seenUrls.add(img.url);
      return true;
    }).slice(0, 60);

    return {
      text: cleanText,
      images: uniqueImages,
      links: Array.from(new Set(links)),
    };
  } catch {
    return null;
  }
}

export interface ExtractedProduct {
  name: string;
  description: string;
  abv: number | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  product_category: string;
  product_image_url: string | null;
  packaging_type: 'glass_bottle' | 'aluminium_can' | 'keg_cask' | 'pet_bag' | null;
  ingredients: string[];
  certifications: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { authenticated } = await authenticateRequest();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 });
    }

    if (isBlockedHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Access to internal addresses is not allowed' }, { status: 400 });
    }

    // Scrape main page
    const mainPage = await fetchPageData(normalizedUrl, normalizedUrl);
    if (!mainPage) {
      return NextResponse.json({ error: 'Could not fetch content from that URL. Please check it is accessible.' }, { status: 422 });
    }

    let allText = mainPage.text;
    let allImages: ImageCandidate[] = [...mainPage.images];
    const visitedUrls = new Set<string>([normalizedUrl]);
    const baseHost = parsedUrl.host;

    // Crawl subpages — prioritise pages likely to contain products
    const productKeywords = /product|shop|range|beer|wine|spirit|drink|cider|whisky|gin|vodka|rum|ale|lager|blend|vintage|collection|store/i;
    const subpageLinks = mainPage.links
      .filter(link => {
        try {
          const linkUrl = new URL(link, normalizedUrl);
          return linkUrl.host === baseHost && !visitedUrls.has(linkUrl.href);
        } catch { return false; }
      })
      .sort((a, b) => {
        // Prioritise product-related links
        const aScore = productKeywords.test(a) ? 1 : 0;
        const bScore = productKeywords.test(b) ? 1 : 0;
        return bScore - aScore;
      })
      .slice(0, 9); // Up to 9 subpages + main = 10 total

    for (const link of subpageLinks) {
      try {
        const absoluteUrl = new URL(link, normalizedUrl).href;
        if (visitedUrls.has(absoluteUrl)) continue;
        visitedUrls.add(absoluteUrl);

        const subPage = await fetchPageData(absoluteUrl, normalizedUrl);
        if (subPage) {
          allText += `\n\n--- Page: ${absoluteUrl} ---\n\n${subPage.text}`;
          allImages = [...allImages, ...subPage.images];
        }
      } catch {
        // Skip failed subpages
      }
    }

    // Deduplicate images by URL
    const seenImageUrls = new Set<string>();
    allImages = allImages.filter(img => {
      if (seenImageUrls.has(img.url)) return false;
      seenImageUrls.add(img.url);
      return true;
    }).slice(0, 80);

    // Truncate content to avoid token limits (~80k chars)
    const contentForClaude = allText.slice(0, 80000);
    const imagesForClaude = allImages.slice(0, 60);

    // Extract products via Claude
    let AnthropicSDK: any;
    try {
      AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
    } catch {
      return NextResponse.json({ error: 'AI extraction unavailable' }, { status: 503 });
    }

    const anthropic = new AnthropicSDK({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'extract_products',
          description: 'Extract all drink products found on the website',
          input_schema: {
            type: 'object',
            properties: {
              org_certifications: {
                type: 'array',
                items: { type: 'string' },
                description: 'Organisation-level certifications found anywhere on the site (e.g. "B Corp", "SIBA Member", "Certified Organic", "Soil Association"). Empty array if none found.',
              },
              org_description: {
                type: ['string', 'null'],
                description: 'A concise description of the company from its About page, homepage, or meta description. Null if not found.',
              },
              products: {
                type: 'array',
                description: 'Array of drink products found on the website',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Full product name including variant/size if specified',
                    },
                    description: {
                      type: 'string',
                      description: 'Short product description (1-2 sentences max)',
                    },
                    abv: {
                      type: ['number', 'null'],
                      description: 'Alcohol by volume as a percentage number (e.g. 40 for 40%), or null if not found or non-alcoholic',
                    },
                    unit_size_value: {
                      type: ['number', 'null'],
                      description: 'Numeric volume/size value (e.g. 330, 500, 70, 75), or null if not specified',
                    },
                    unit_size_unit: {
                      type: ['string', 'null'],
                      enum: ['ml', 'cl', 'l', null],
                      description: 'Unit of volume: ml, cl, or l. Null if not specified.',
                    },
                    product_category: {
                      type: 'string',
                      enum: ['Spirits', 'Beer & Cider', 'Wine', 'Ready-to-Drink & Cocktails', 'Non-Alcoholic'],
                      description: 'Best matching product category',
                    },
                    product_image_url: {
                      type: ['string', 'null'],
                      description: 'URL of the product image from the provided image list, or null if no suitable image found',
                    },
                    packaging_type: {
                      type: ['string', 'null'],
                      enum: ['glass_bottle', 'aluminium_can', 'keg_cask', 'pet_bag', null],
                      description: 'Primary packaging format for this product, or null if not identifiable from the page',
                    },
                    ingredients: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Key ingredients listed anywhere on the page for this product (e.g. "juniper", "coriander", "malted barley", "apples"). Empty array if none found.',
                    },
                    certifications: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Certifications specific to this product (e.g. "Organic", "Vegan", "Gluten-Free"). Empty array if none found.',
                    },
                  },
                  required: ['name', 'description', 'abv', 'unit_size_value', 'unit_size_unit', 'product_category', 'product_image_url', 'packaging_type', 'ingredients', 'certifications'],
                },
              },
            },
            required: ['org_certifications', 'org_description', 'products'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_products' },
      messages: [
        {
          role: 'user',
          content: `You are extracting product and company information from a drinks brand website to pre-populate a sustainability platform.

Extract all individual drink products from the website content below. Focus on actual sellable products (not merchandise, accessories, or services).

Also extract:
- org_certifications: any certifications held by the company itself (B Corp, Soil Association Organic, SIBA Member, Rainforest Alliance, etc.) visible anywhere on the site
- org_description: a concise description of the company (from About page, homepage, or meta description)

IMAGE SELECTION RULES — this is critical:
- Each image below includes its URL, alt text, and nearby page text
- For each product, pick the image whose alt text or nearby context most closely matches that specific product's name
- Prefer images where the alt text contains the product name (e.g. alt="Avallen Calvados Glass Bottle" for a glass bottle product)
- If no image clearly matches a product by name, set product_image_url to null — do NOT guess
- Never use an image for a product if the alt text or context clearly refers to a different product

Available images (format: URL | alt: "..." | context: "..."):
${imagesForClaude.length > 0
  ? imagesForClaude.map(img => `${img.url} | alt: "${img.alt}" | context: "${img.context.replace(/\n/g, ' ').slice(0, 80)}"`).join('\n')
  : 'No images found'}

Website content:
${contentForClaude}

Important:
- Only extract actual drink products (beers, wines, spirits, RTDs, soft drinks, etc.)
- Do not include gift sets, merchandise, or non-drink items
- If the same product appears in multiple sizes, create a separate entry for each
- Keep descriptions concise (1-2 sentences)
- If ABV or size is not mentioned, set to null
- For packaging_type: glass_bottle (wine, spirits, premium beer), aluminium_can (canned beer/RTD), keg_cask (draught/cask), pet_bag (bag-in-box wine). Set null if unclear.
- For ingredients: only extract if explicitly listed (e.g. botanicals for gin, grape varieties for wine, grain bill for beer). Do not infer.
- For certifications: product-level only (e.g. "Organic" on a specific wine). Company certifications go in org_certifications.`,
        },
      ],
    });

    // Extract tool use result
    const toolUse = response.content.find((block: any) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ products: [], pagesAnalyzed: visitedUrls.size });
    }

    const toolInput = toolUse.input as {
      products: ExtractedProduct[];
      org_certifications?: string[];
      org_description?: string | null;
    };

    return NextResponse.json({
      products: toolInput.products,
      pagesAnalyzed: visitedUrls.size,
      orgCertifications: toolInput.org_certifications ?? [],
      orgDescription: toolInput.org_description ?? null,
    });
  } catch (error: any) {
    console.error('[import-from-url] Error:', error);
    return NextResponse.json({ error: 'Failed to import products from URL' }, { status: 500 });
  }
}
