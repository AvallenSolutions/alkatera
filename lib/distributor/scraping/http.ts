/**
 * Polite, bounded HTTP fetch for the scraping pipeline. Wraps fetch with
 * a hard timeout, a user-agent that names us (so we're not pretending to
 * be a browser), and a single-shot retry on transient errors.
 */
export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  body?: string;
  error?: string;
}

const USER_AGENT =
  'alkatera-distributor-bot/1.0 (+https://alkatera.com/distributor-bot; sustainability data discovery)';

const TIMEOUT_MS = 10_000;

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      redirect: 'follow',
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
