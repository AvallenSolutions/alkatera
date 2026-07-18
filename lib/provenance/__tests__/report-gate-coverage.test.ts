import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseProvenanceRefusal } from '@/hooks/useProvenanceGate';

/**
 * The confirmed-data gate is only meaningful if it sits on EVERY route that
 * puts a report in front of someone outside the company. It used to sit on
 * the PDF route alone, so a blocked user could ship the same numbers as an
 * interactive document or a public share link. This test pins the policy:
 * outbound routes gate, internal ones deliberately do not.
 */

const ROUTES = join(process.cwd(), 'app/api/reports/[id]');
const read = (route: string) => readFileSync(join(ROUTES, route, 'route.ts'), 'utf8');

const OUTBOUND = [
  'generate-pdf',
  'generate-html',
  'share',
  'investor-summary',
  'regulatory-index',
  'iso14064-worksheet',
];

/** Internal: drafting and previewing are the user looking at their own work. */
const INTERNAL = ['narratives'];

describe('confirmed-data gate coverage', () => {
  it.each(OUTBOUND)('gates %s (it leaves the building)', route => {
    const source = read(route);
    expect(source).toContain('enforceProvenanceGate');
    // Whole-footprint scope: a report is not just its products.
    expect(source).toMatch(/enforceProvenanceGate\([^)]*'overall'\)/);
  });

  it.each(INTERNAL)('leaves %s ungated (internal work)', route => {
    expect(read(route)).not.toContain('enforceProvenanceGate');
  });

  it('leaves the preview ungated and free of AI', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/reports/preview/route.ts'), 'utf8');
    expect(source).not.toContain('enforceProvenanceGate');
    expect(source).not.toContain('generateAllSectionNarratives');
  });

  it('gates share creation but never share serving', () => {
    // Links already handed out keep working; revocation is the kill switch.
    const share = read('share');
    const postBody = share.slice(share.indexOf('export async function POST'), share.indexOf('export async function DELETE'));
    const deleteBody = share.slice(share.indexOf('export async function DELETE'));
    expect(postBody).toContain('enforceProvenanceGate');
    expect(deleteBody).not.toContain('enforceProvenanceGate');

    const publicRoute = readFileSync(join(process.cwd(), 'app/(public)/report/[token]/route.ts'), 'utf8');
    expect(publicRoute).not.toContain('enforceProvenanceGate');
  });
});

describe('parseProvenanceRefusal', () => {
  it('recognises a provenance 403 and returns its blockers', () => {
    expect(
      parseProvenanceRefusal({ reason: 'provenance_gate', blockers: [{ area: 'products' }] })
    ).toEqual([{ area: 'products' }]);
    expect(parseProvenanceRefusal({ reason: 'provenance_gate' })).toEqual([]);
  });

  it('ignores every other failure so real errors still surface', () => {
    expect(parseProvenanceRefusal({ error: 'Share failed' })).toBeNull();
    expect(parseProvenanceRefusal(null)).toBeNull();
    expect(parseProvenanceRefusal({ reason: 'subscription' })).toBeNull();
  });
});
