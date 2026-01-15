import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type { Database } from '@/types/db_types'
import { getSupabaseServerClient } from './server-client'

/**
 * Get a Supabase client for API routes that handles both cookie and token authentication
 * This is specifically designed for API routes that may receive Authorization headers from client components
 */
export async function getSupabaseAPIClient() {
  const headersList = headers()
  const authHeader = headersList.get('authorization')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // If Authorization header is present, create a client that uses it
  if (authHeader?.startsWith('Bearer ')) {
    console.log('[API Client] Using Authorization header authentication');

    // Create a client with the anon key
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Get the token from the header
    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      console.error('[API Client] Token verification failed:', error);
      return { client, user: null, error };
    }

    console.log('[API Client] Token verified for user:', user.id);

    // Return a client that will use this token for all requests
    // We set the session manually so the client knows about the user
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
  console.log('[API Client] Using cookie-based authentication');
  const client = getSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();

  return { client, user, error };
}
