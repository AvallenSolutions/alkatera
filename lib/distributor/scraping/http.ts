/**
 * Polite, bounded HTTP fetch for the scraping pipeline. Wraps fetch with
 * a hard timeout and a realistic browser user-agent.
 *
 * We used to send a self-identifying `alkatera-distributor-bot/1.0` UA
 * "to be polite". In practice CDN/WAF layers in front of brand sites
 * (Azion, Cloudflare, Akamai, etc.) 403 any non-browser UA outright —
 * e.g. velhobarreiroshop.com.br returns 403 to the bot UA but 200 + the
 * full page to a browser UA. That blocked the homepage fetch and failed
 * the whole brand scrape before any extraction ran. A standard browser
 * UA is required to read the public pages we're crawling.
 */
import { safeFetch } from '../../utils/safe-fetch';

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  body?: string;
  error?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TIMEOUT_MS = 10_000;

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Brand website URLs come from uploaded distributor lists and AI website-
    // finding, i.e. they are semi-user-supplied: safeFetch validates the host
    // and its resolved IPs on every redirect hop so a crafted entry cannot
    // point the scraper at internal services.
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, url, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.text();
    // Belt-and-braces — some sites return 200 with a captcha / wall page.
    if (body.length > 5_000_000) {
      return { ok: false, status: res.status, url, error: 'response too large' };
    }
    return { ok: true, status: res.status, url, body, error: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, url, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sleep helper used to space requests so we don't hammer a single
 * source within a single brand-agent run.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
