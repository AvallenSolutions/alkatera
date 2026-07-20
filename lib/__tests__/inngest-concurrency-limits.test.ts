import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * The Inngest plan caps per-function concurrency at 5.
 *
 * Exceeding it does not degrade that one function: Inngest rejects the whole
 * app at registration, so EVERY function stops syncing. The failure surfaces
 * far from its cause, as a sync error in a dashboard rather than anything in
 * the codebase, which is why it has now been introduced twice.
 *
 * scraping-brand-run carries a comment about this. Two product-import
 * functions were added afterwards at 6 and 8 and broke the sync again. This
 * test is the version of that comment that fails a build.
 *
 * If the plan is upgraded, raise MAX_CONCURRENCY here and the ceiling moves
 * in one place.
 */
const MAX_CONCURRENCY = 5;

const FUNCTIONS_DIR = join(process.cwd(), 'lib/inngest/functions');

describe('Inngest per-function concurrency', () => {
  const files = readdirSync(FUNCTIONS_DIR).filter(
    (f) => f.endsWith('.ts') && f !== 'index.ts',
  );

  it('finds the function files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    it(`${file} stays within the plan limit`, () => {
      const source = readFileSync(join(FUNCTIONS_DIR, file), 'utf8');
      // Matches both `concurrency: { limit: N }` and the array form's
      // `{ key: ..., limit: N }` entries.
      const limits = [...source.matchAll(/limit:\s*(\d+)/g)].map((m) => parseInt(m[1], 10));
      for (const limit of limits) {
        expect(
          limit,
          `${file} declares concurrency limit ${limit}; anything above ` +
            `${MAX_CONCURRENCY} makes the entire Inngest app fail to sync`,
        ).toBeLessThanOrEqual(MAX_CONCURRENCY);
      }
    });
  }
});
