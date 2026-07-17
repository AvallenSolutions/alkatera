import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppBaseUrl, isProductionRuntime, isPreviewRuntime } from '../base-url';

const ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'VERCEL_ENV',
  'NODE_ENV',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function requestWith(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

describe('getAppBaseUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL and trims a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.alkatera.com/';
    expect(getAppBaseUrl()).toBe('https://www.alkatera.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL, adding https://', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'alkatera.vercel.app';
    expect(getAppBaseUrl()).toBe('https://alkatera.vercel.app');
  });

  it('falls back to VERCEL_URL when no production URL is set', () => {
    process.env.VERCEL_URL = 'alkatera-git-redesign-alkatera.vercel.app';
    expect(getAppBaseUrl()).toBe('https://alkatera-git-redesign-alkatera.vercel.app');
  });

  it('prefers VERCEL_PROJECT_PRODUCTION_URL over VERCEL_URL when both are set', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'prod.vercel.app';
    process.env.VERCEL_URL = 'preview.vercel.app';
    expect(getAppBaseUrl()).toBe('https://prod.vercel.app');
  });

  it('leaves an already-prefixed Vercel URL alone', () => {
    process.env.VERCEL_URL = 'https://already-prefixed.vercel.app';
    expect(getAppBaseUrl()).toBe('https://already-prefixed.vercel.app');
  });

  it('falls back to the request host header, defaulting to https', () => {
    const request = requestWith({ host: 'app.alkatera.com' });
    expect(getAppBaseUrl(request)).toBe('https://app.alkatera.com');
  });

  it('uses x-forwarded-proto when present on the request', () => {
    const request = requestWith({ host: 'localhost:8888', 'x-forwarded-proto': 'http' });
    expect(getAppBaseUrl(request)).toBe('http://localhost:8888');
  });

  it('falls back to the hardcoded production URL when nothing else resolves', () => {
    expect(getAppBaseUrl()).toBe('https://alkatera.com');
    expect(getAppBaseUrl(null)).toBe('https://alkatera.com');
  });

  it('env vars win over a request host when both are present', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.alkatera.com';
    const request = requestWith({ host: 'localhost:8888' });
    expect(getAppBaseUrl(request)).toBe('https://www.alkatera.com');
  });
});

describe('isProductionRuntime', () => {
  it('is true when VERCEL_ENV is production', () => {
    process.env.VERCEL_ENV = 'production';
    expect(isProductionRuntime()).toBe(true);
  });

  it('is false on a Vercel preview deployment even with NODE_ENV=production', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NODE_ENV = 'production';
    expect(isProductionRuntime()).toBe(false);
  });

  it('is true when NODE_ENV=production and there is no VERCEL_ENV (e.g. Netlify)', () => {
    process.env.NODE_ENV = 'production';
    expect(isProductionRuntime()).toBe(true);
  });

  it('is false in local dev', () => {
    process.env.NODE_ENV = 'development';
    expect(isProductionRuntime()).toBe(false);
  });
});

describe('isPreviewRuntime', () => {
  it('is true only when VERCEL_ENV is preview', () => {
    process.env.VERCEL_ENV = 'preview';
    expect(isPreviewRuntime()).toBe(true);
  });

  it('is false in production and in local dev', () => {
    process.env.VERCEL_ENV = 'production';
    expect(isPreviewRuntime()).toBe(false);
    delete process.env.VERCEL_ENV;
    expect(isPreviewRuntime()).toBe(false);
  });
});
