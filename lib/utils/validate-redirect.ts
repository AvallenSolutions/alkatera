/**
 * Sanitise a redirect path from a query parameter.
 * Prevents open redirect attacks by ensuring the path is a relative URL.
 */
export function sanitizeRedirectPath(next: string | null): string {
  const fallback = '/dashboard';
  if (!next) return fallback;
  // Must start with / and must not start with // (protocol-relative URL)
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
