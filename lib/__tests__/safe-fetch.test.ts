/**
 * SSRF hardening tests for lib/utils/safe-fetch.ts.
 *
 * The critical property: a redirect from a clean public URL to an internal
 * address (cloud metadata, loopback, RFC1918) must be blocked, because
 * redirect: 'follow' on user-supplied URLs was the original SSRF vector
 * (SECURITY_REVIEW.md HIGH-2, CODE_REVIEW_2026-06-10.md S2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dns/promises', () => {
  const lookup = vi.fn(async (hostname: string) => {
    // Simulate DNS: public hosts resolve to a public IP, evil-internal.test
    // resolves to a private address (DNS-rebinding style).
    if (hostname === 'evil-internal.test') {
      return [{ address: '10.0.0.5', family: 4 }];
    }
    return [{ address: '93.184.216.34', family: 4 }];
  });
  return { lookup, default: { lookup } };
});

import { safeFetch, isBlockedHostname, assertPublicUrl } from '../utils/safe-fetch';

const realFetch = global.fetch;

describe('isBlockedHostname', () => {
  it('blocks loopback, RFC1918, link-local and localhost', () => {
    for (const h of [
      'localhost', 'sub.localhost', '127.0.0.1', '10.1.2.3', '192.168.0.1',
      '172.16.0.1', '172.31.255.255', '169.254.169.254', '0.0.0.0', '::1',
      'fc00::1', 'fd12::1', 'fe80::1',
    ]) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });

  it('allows public hostnames and IPs', () => {
    for (const h of ['www.avallenspirits.com', '93.184.216.34', '172.32.0.1', '8.8.8.8']) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('SSRF');
    await expect(assertPublicUrl('gopher://example.com')).rejects.toThrow('SSRF');
  });

  it('rejects hostnames that resolve to private IPs (DNS rebinding)', async () => {
    await expect(assertPublicUrl('https://evil-internal.test/page')).rejects.toThrow(
      'resolves to private IP',
    );
  });

  it('accepts a public URL', async () => {
    await expect(assertPublicUrl('https://www.avallenspirits.com/')).resolves.toBeUndefined();
  });
});

describe('safeFetch redirect re-validation', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.clearAllMocks();
  });

  function redirectResponse(location: string) {
    return {
      status: 302,
      headers: new Headers({ location }),
    } as unknown as Response;
  }

  function okResponse() {
    return { status: 200, headers: new Headers() } as unknown as Response;
  }

  it('blocks a redirect to cloud metadata', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      redirectResponse('http://169.254.169.254/latest/meta-data/'),
    );
    await expect(safeFetch('https://www.avallenspirits.com/')).rejects.toThrow('SSRF');
    expect(global.fetch).toHaveBeenCalledTimes(1); // never fetched the metadata URL
  });

  it('blocks a redirect to a host resolving to a private IP', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      redirectResponse('https://evil-internal.test/'),
    );
    await expect(safeFetch('https://www.avallenspirits.com/')).rejects.toThrow('SSRF');
  });

  it('follows a legitimate public redirect chain', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(redirectResponse('https://www.avallenspirits.com/en/'))
      .mockResolvedValueOnce(okResponse());
    const res = await safeFetch('https://avallenspirits.com/');
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('always fetches with redirect: manual', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okResponse());
    await safeFetch('https://www.avallenspirits.com/');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.avallenspirits.com/',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('gives up after too many redirects', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      redirectResponse('https://www.avallenspirits.com/loop'),
    );
    await expect(safeFetch('https://www.avallenspirits.com/')).rejects.toThrow('too many redirects');
  });
});
