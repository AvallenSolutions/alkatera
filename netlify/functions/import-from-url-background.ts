import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Background Netlify Function for "Import products from website".
 *
 * Netlify's -background suffix gives this function up to 15 minutes of runtime,
 * which is what lets us run the Claude Sonnet extraction (30-60s on big sites
 * like warnersdistillery.com) without hitting the 26s synchronous cap that
 * was producing 504s from app/api/products/import-from-url.
 *
 * The Next.js POST route at /api/products/import-from-url enqueues a job row
 * in product_import_jobs and fires a request here with an HMAC-signed payload.
 * We do the scrape + Claude call and write the result back to the job row.
 * The client polls /api/products/import-from-url/[jobId] for completion.
 */

interface ImageCandidate {
  url: string;
  alt: string;
  context: string;
}

interface PageData {
  text: string;
  images: ImageCandidate[];
  links: string[];
}

async function fetchPageData(url: string): Promise<PageData | null> {
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

    const images: ImageCandidate[] = [];
    const SKIP_PATTERNS = /icon|logo|avatar|banner|badge|flag|sprite|pixel|tracking|1x1|blank|placeholder/i;
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || '';
      if (!src || !src.startsWith('http')) return;
      if (SKIP_PATTERNS.test(src)) return;

      const alt = ($(el).attr('alt') || '').trim();
      const parent = $(el).parent();
      const nearbyText = (parent.text() || parent.parent().text() || '').trim().slice(0, 120);

      const isProductLike =
        /product|shop|item|bottle|can|pack|range|collection|variant|sku/i.test(src) ||
        alt.length > 3;

      if (isProductLike) {
        images.push({ url: src, alt, context: nearbyText });
      }
    });

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        links.push(href);
      }
    });

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

function verifyHmac(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const handler = async (event: { body?: string | null; headers: Record<string, string | undefined> }) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!secret || !supabaseUrl || !serviceKey || !anthropicKey) {
    console.error('[import-from-url-background] Missing required env vars');
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sigHeader = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sigHeader, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { jobId?: string; url?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { jobId, url } = payload;
  if (!jobId || !url) return { statusCode: 400, body: 'missing fields' };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updateJob = async (patch: Record<string, any>) => {
    await supabase
      .from('product_import_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    await updateJob({ status: 'scraping', phase_message: 'Scanning the homepage…' });

    const parsedUrl = new URL(url);
    const mainPage = await fetchPageData(url);
    if (!mainPage) {
      await updateJob({
        status: 'failed',
        error: 'Could not fetch content from that URL. Please check it is accessible.',
      });
      return { statusCode: 200, body: 'ok' };
    }

    let allText = mainPage.text;
    let allImages: ImageCandidate[] = [...mainPage.images];
    const visitedUrls = new Set<string>([url]);
    const baseHost = parsedUrl.host;

    const productKeywords = /product|shop|store|range|collection|catalog|beer|wine|spirit|cider|whisky|whiskey|gin|vodka|rum|ale|lager|slijterij|boutique|tienda|negozio/i;
    const skipKeywords = /account|login|signin|signup|register|winkelwagen|cart|checkout|basket|wishlist|privacy|terms|contact/i;
    const seenPaths = new Set<string>();
    const resolvedLinks: string[] = [];
    for (const link of mainPage.links) {
      try {
        const u = new URL(link, url);
        if (u.host !== baseHost) continue;
        if (visitedUrls.has(u.href)) continue;
        if (seenPaths.has(u.pathname)) continue;
        seenPaths.add(u.pathname);
        resolvedLinks.push(u.href);
      } catch { /* ignore */ }
    }
    const subpageLinks = resolvedLinks
      .map(href => {
        const path = (() => { try { return new URL(href).pathname + new URL(href).search; } catch { return href; } })();
        const score =
          skipKeywords.test(path) ? -1 :
          productKeywords.test(path) ? 1 :
          0;
        return { href, score };
      })
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map(x => x.href);

    await updateJob({
      phase_message: `Scanning ${subpageLinks.length + 1} pages for products…`,
    });

    const subPages = await Promise.all(
      subpageLinks.map(async (absoluteUrl) => {
        visitedUrls.add(absoluteUrl);
        try {
          return { url: absoluteUrl, data: await fetchPageData(absoluteUrl) };
        } catch {
          return { url: absoluteUrl, data: null };
        }
      }),
    );

    for (const { url: absoluteUrl, data: subPage } of subPages) {
      if (subPage) {
        allText += `\n\n--- Page: ${absoluteUrl} ---\n\n${subPage.text}`;
        allImages = [...allImages, ...subPage.images];
      }
    }

    const seenImageUrls = new Set<string>();
    allImages = allImages.filter(img => {
      if (seenImageUrls.has(img.url)) return false;
      seenImageUrls.add(img.url);
      return true;
    }).slice(0, 80);

    const contentForClaude = allText.slice(0, 80000);
    const imagesForClaude = allImages.slice(0, 60);

    await updateJob({
      status: 'extracting',
      phase_message: 'Extracting products with AI (this can take up to a minute)…',
      pages_analyzed: visitedUrls.size,
    });

    const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new AnthropicSDK({ apiKey: anthropicKey });

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
                    name: { type: 'string', description: 'Full product name including variant/size if specified' },
                    description: { type: 'string', description: 'Short product description (1-2 sentences max)' },
                    abv: { type: ['number', 'null'], description: 'Alcohol by volume as a percentage number (e.g. 40 for 40%), or null if not found or non-alcoholic' },
                    unit_size_value: { type: ['number', 'null'], description: 'Numeric volume/size value (e.g. 330, 500, 70, 75), or null if not specified' },
                    unit_size_unit: { type: ['string', 'null'], enum: ['ml', 'cl', 'l', null], description: 'Unit of volume: ml, cl, or l. Null if not specified.' },
                    product_category: { type: 'string', enum: ['Spirits', 'Beer & Cider', 'Wine', 'Ready-to-Drink & Cocktails', 'Non-Alcoholic'], description: 'Best matching product category' },
                    product_image_url: { type: ['string', 'null'], description: 'URL of the product image from the provided image list, or null if no suitable image found' },
                    packaging_type: { type: ['string', 'null'], enum: ['glass_bottle', 'aluminium_can', 'keg_cask', 'pet_bag', null], description: 'Primary packaging format for this product, or null if not identifiable from the page' },
                    ingredients: { type: 'array', items: { type: 'string' }, description: 'Key ingredients listed anywhere on the page for this product. Empty array if none found.' },
                    certifications: { type: 'array', items: { type: 'string' }, description: 'Certifications specific to this product. Empty array if none found.' },
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

IMAGE SELECTION RULES - this is critical:
- Each image below includes its URL, alt text, and nearby page text
- For each product, pick the image whose alt text or nearby context most closely matches that specific product's name
- Prefer images where the alt text contains the product name (e.g. alt="Avallen Calvados Glass Bottle" for a glass bottle product)
- If no image clearly matches a product by name, set product_image_url to null - do NOT guess
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

    const toolUse = response.content.find((block: any) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      await updateJob({
        status: 'completed',
        phase_message: null,
        pages_analyzed: visitedUrls.size,
        products: [],
        org_certifications: [],
        org_description: null,
      });
      return { statusCode: 200, body: 'ok' };
    }

    const toolInput = toolUse.input as {
      products: unknown[];
      org_certifications?: string[];
      org_description?: string | null;
    };

    await updateJob({
      status: 'completed',
      phase_message: null,
      pages_analyzed: visitedUrls.size,
      products: toolInput.products ?? [],
      org_certifications: toolInput.org_certifications ?? [],
      org_description: toolInput.org_description ?? null,
    });

    return { statusCode: 200, body: 'ok' };
  } catch (error: any) {
    console.error('[import-from-url-background] Error:', error);
    await updateJob({
      status: 'failed',
      error: error?.message?.slice(0, 500) || 'Failed to import products from URL',
    });
    return { statusCode: 200, body: 'ok' };
  }
};
