/**
 * The retry decision must read the HTTP status, not the error prose.
 *
 * The guard used to be `error.message.includes('40')`, matched against a string
 * that ends in the server's own response body. Any 5xx whose body happened to
 * contain "40" (a process count, an id, a timestamp) was therefore treated as a
 * client error and never retried, which defeated the backoff during exactly the
 * transient outages it exists for.
 *
 * These tests pin the decision itself. `shouldRetry` mirrors the condition in
 * `fetchWithRetry`; if that condition changes, this file must change with it.
 */

import { describe, it, expect } from 'vitest';

/** The guard as it now stands in lib/openlca/client.ts. */
function shouldRetry(error: Error & { status?: number }): boolean {
  const status = error.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
    return false;
  }
  return true;
}

function httpError(status: number, body: string): Error & { status?: number } {
  const err = new Error(`OpenLCA server error: ${status} Error - ${body}`) as Error & {
    status?: number;
  };
  err.status = status;
  return err;
}

describe('OpenLCA retry decision', () => {
  it('does not retry a genuine 404', () => {
    expect(shouldRetry(httpError(404, 'process not found'))).toBe(false);
  });

  it('does not retry a 400', () => {
    expect(shouldRetry(httpError(400, 'bad request'))).toBe(false);
  });

  it('retries a 429, because rate limiting passes', () => {
    expect(shouldRetry(httpError(429, 'slow down'))).toBe(true);
  });

  it('retries a 500 whose body contains "40" — the bug this replaced', () => {
    // Under the old substring guard this returned false and the request was
    // abandoned on the first attempt.
    expect(shouldRetry(httpError(500, 'failed after loading 23407 processes'))).toBe(true);
  });

  it('retries a 503, which is what a restarting gdt-server returns', () => {
    expect(shouldRetry(httpError(503, 'service unavailable'))).toBe(true);
  });

  it('retries a network error that carries no status at all', () => {
    expect(shouldRetry(new Error('fetch failed'))).toBe(true);
  });
});
