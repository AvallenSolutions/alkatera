import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { Database } from '@/types/db_types'
import { getSupabaseServerClient } from './server-client'
import { getSupabasePortalServerClient } from './portal-server-client'

// Next.js patches global fetch and, on the getSupabaseAdminClient() code path
// (no next/headers call to auto-trigger dynamic mode), would otherwise cache
// these outbound Supabase requests across invocations — a GET with an
// identical URL every time would keep returning the first response it ever
// saw. no-store on every call is what makes the service-role client live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

/**
 * Create a Supabase admin client using the service role key.
 * This bypasses RLS and the PostgREST schema cache restrictions,
 * which is needed for tables that may not be in the anon role's schema cache.
 */
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.startsWith('your_')) {
    return null
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: noStoreFetch },
  })
}

/**
 * Get a Supabase admin client using the service role key.
 * This bypasses RLS entirely — use ONLY for:
 *   - Admin panel routes (after verifying is_alkatera_admin)
 *   - Cron jobs (after verifying CRON_SECRET)
 *   - Operations that legitimately need cross-org access
 *
 * For normal user-facing API routes, use getSupabaseAPIClient() instead.
 */
export function getSupabaseAdminClient() {
  const client = getServiceRoleClient()
  if (!client) {
    throw new Error('Service role key not configured — cannot create admin client')
  }
  return client
}

/**
 * Get a Supabase client for API routes that handles both cookie and token authentication.
 * Uses the service role key for DB operations when available (bypasses schema cache issues).
 * Falls back to the anon key if no service role key is configured.
 *
 * NOTE: This still returns the service role client for DB queries (to avoid PostgREST
 * schema cache issues). All routes MUST enforce organisation scoping at the application
 * level using resolveUserOrganization(). The service role client is never returned
 * without a verified user.
 */
export async function getSupabaseAPIClient(opts?: { portalCookie?: boolean }) {
  const headersList = headers()
  const authHeader = headersList.get('authorization')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Try to get a service role client for DB operations
  const serviceClient = getServiceRoleClient()

  // If Authorization header is present, create a client that uses it
  if (authHeader?.startsWith('Bearer ')) {
    // Create a client with the anon key for auth verification
    const authClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: noStoreFetch },
    });

    // Get the token from the header
    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      // Never return a service role client on auth failure
      return { client: authClient, user: null, error };
    }

    // Return service role client if available (bypasses schema cache),
    // otherwise fall back to token-authenticated anon client
    if (serviceClient) {
      return { client: serviceClient, user, error: null };
    }

    return {
      client: createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader,
          },
          fetch: noStoreFetch,
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
      user,
      error: null,
    };
  }

  // Otherwise, use cookie-based authentication. Portal routes
  // (distributor / procurement) read the separate portal auth cookie so
  // their session is independent of the main app session.
  const cookieClient = opts?.portalCookie
    ? getSupabasePortalServerClient()
    : getSupabaseServerClient();
  const { data: { user }, error } = await cookieClient.auth.getUser();

  // Return service role client for DB operations if available
  if (serviceClient && user) {
    return { client: serviceClient, user, error: null };
  }

  return { client: cookieClient, user, error };
}
