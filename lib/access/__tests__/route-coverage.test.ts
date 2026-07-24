import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globSync } from 'glob';
import { sectionForApi } from '../sections';

/**
 * Coverage guard: every RLS-BYPASSING route that serves a restrictable section
 * must carry the section guard.
 *
 * This is the test that keeps the feature honest over time. Someone adding
 * `app/api/pulse/new-widget/route.ts` next month will not remember this file
 * exists — so the check enumerates the routes rather than trusting diligence,
 * and fails until the guard is added.
 *
 * Only service-role routes are required to carry it. A route using the
 * cookie-bound client is already covered by RLS (`can_access_section()` in
 * migration 20260724140000), so demanding the app guard there would be noise.
 */

const APP_ROOT = join(__dirname, '..', '..', '..');

/** app/api/pulse/waterfall/route.ts -> /api/pulse/waterfall */
function apiPathFor(file: string): string {
  return (
    '/' +
    relative(APP_ROOT, file)
      .split(sep)
      .slice(1) // drop the leading "app"
      .filter((seg) => seg !== 'route.ts' && !seg.startsWith('('))
      .join('/')
  );
}

const SERVICE_ROLE_MARKERS = ['SUPABASE_SERVICE_ROLE_KEY', 'getSupabaseAPIClient'];

const routeFiles = globSync('api/**/route.ts', { cwd: join(APP_ROOT, 'app'), absolute: true });

describe('section guard coverage', () => {
  it('finds the API routes to check', () => {
    expect(routeFiles.length).toBeGreaterThan(50);
  });

  it('guards every service-role route that serves a restrictable section', () => {
    const ungated: string[] = [];

    for (const file of routeFiles) {
      const section = sectionForApi(apiPathFor(file));
      if (!section) continue;

      const src = readFileSync(file, 'utf8');
      const bypassesRls = SERVICE_ROLE_MARKERS.some((marker) => src.includes(marker));
      if (!bypassesRls) continue;

      if (!src.includes('@/lib/auth/section-access')) {
        ungated.push(`${apiPathFor(file)} (section: ${section})`);
      }
    }

    expect(
      ungated,
      `These service-role routes serve a restricted section but do not import the ` +
        `section guard. Add denySection() / canAccessSection() from ` +
        `@/lib/auth/section-access after the org is resolved:\n  ${ungated.join('\n  ')}`,
    ).toEqual([]);
  });
});
