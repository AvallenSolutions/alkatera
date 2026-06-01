import { NextResponse } from 'next/server'

/**
 * Standard server-error response.
 *
 * Logs the real error (including stack) server-side, but returns ONLY a
 * generic message to the client. Use this instead of returning
 * `error.message` / `error.stack` / Supabase `error.details` in API routes,
 * which leak schema, constraint and RLS internals (security review 2026-05-29,
 * MED-6).
 */
export function serverErrorResponse(
  context: string,
  error: unknown,
  clientMessage = 'Internal server error',
  status = 500,
) {
  // console.error of an Error logs its stack; next.config keeps error logs in prod.
  console.error(`[${context}]`, error)
  return NextResponse.json({ error: clientMessage }, { status })
}
