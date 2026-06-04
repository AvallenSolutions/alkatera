import { createClient } from '@supabase/supabase-js';

/**
 * Read a runtime secret from Supabase Vault.
 *
 * Why: AWS Lambda caps a function's total env at 4 KB. Long secrets
 * (e.g. the ~1 KB Sender.net JWT) blow that budget when forwarded to
 * every Netlify Function. Keeping them in Vault and reading them on
 * cold start with the service-role key takes them off the Lambda env
 * entirely. See docs/env-vars.md (option 3).
 *
 * Resolution order:
 *   1. process.env[name] — keeps local dev + any still-env-scoped secret
 *      working with zero Vault setup.
 *   2. Supabase Vault via the security-definer `get_secret` RPC, using
 *      the service-role client. Cached in-process so we hit the DB once
 *      per cold start, not per request.
 *
 * Returns null when the secret can't be resolved; callers already guard
 * against a missing token.
 */

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { value: string | null; at: number }>();

export async function getVaultSecret(name: string): Promise<string | null> {
  // 1. Env wins — local dev and any secret still scoped to Functions.
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;

  // 2. Vault, cached per cold start.
  const cached = cache.get(name);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  let value: string | null = null;
  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc('get_secret', { p_name: name });
    if (!error && typeof data === 'string' && data.length > 0) value = data;
  } catch {
    value = null;
  }

  cache.set(name, { value, at: Date.now() });
  return value;
}
