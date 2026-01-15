import { createBrowserClient } from '@supabase/ssr';

/**
 * Utility to make authenticated API calls from client components
 * Automatically includes the Authorization header with the user's access token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if session exists
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  // Make the request
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * Utility to make authenticated POST requests with JSON body
 */
export async function authenticatedPost<T = any>(
  url: string,
  body: T
): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Utility to make authenticated PUT requests with JSON body
 */
export async function authenticatedPut<T = any>(
  url: string,
  body: T
): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Utility to make authenticated DELETE requests
 */
export async function authenticatedDelete(url: string): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'DELETE',
  });
}

/**
 * Utility to make authenticated GET requests
 */
export async function authenticatedGet(url: string): Promise<Response> {
  return authenticatedFetch(url, {
    method: 'GET',
  });
}
