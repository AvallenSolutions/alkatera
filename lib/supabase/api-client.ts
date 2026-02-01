import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { Database } from '@/types/db_types'
import { getSupabaseServerClient } from './server-client'

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
  })
}

/**
 * Get a Supabase client for API routes that handles both cookie and token authentication.
 * Uses the service role key for DB operations when available (bypasses schema cache issues).
 * Falls back to the anon key if no service role key is configured.
 */
export async function getSupabaseAPIClient() {
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
    });

    // Get the token from the header
    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      console.error('[API Client] Token verification failed:', error);
      return { client: serviceClient || authClient, user: null, error };
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

  // Otherwise, use cookie-based authentication
  const cookieClient = getSupabaseServerClient();
  const { data: { user }, error } = await cookieClient.auth.getUser();

  // Return service role client for DB operations if available
  if (serviceClient && user) {
    return { client: serviceClient, user, error: null };
  }

  return { client: cookieClient, user, error };
}
