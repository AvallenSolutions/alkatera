/**
 * Legacy redirect -- Impact Valuation moved into the Pulse Financial surface.
 *
 * Preserves bookmarks and existing dashboard links that target this URL.
 * Query params (e.g. ?year=2025) are forwarded so deep links keep working.
 */

import { redirect } from 'next/navigation';

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function ImpactValuationLegacyRedirect({ searchParams }: PageProps) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else if (typeof value === 'string') {
        params.set(key, value);
      }
    }
  }
  const query = params.toString();
  const target = query
    ? `/pulse/financial/impact-valuation?${query}`
    : '/pulse/financial/impact-valuation';
  redirect(target);
}
