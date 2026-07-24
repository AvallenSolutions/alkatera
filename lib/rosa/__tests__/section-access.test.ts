import { describe, expect, it } from 'vitest';
import { ROSA_TOOLS, rosaToolsFor, executeTool, type ToolContext } from '../tools';
import { SAFE_SQL_ALLOWED_TABLES } from '../safe-sql';
import { RESTRICTABLE_SECTIONS } from '@/lib/access/sections';

/**
 * Rosa is the back door to every gate in the app: she runs on a service-role
 * client, so RLS does not touch her, and she will happily read a number out
 * loud that the page refuses to render.
 */

const ctx = (sectionAccess: ToolContext['sectionAccess']): ToolContext => ({
  supabase: {} as never, // never reached — the withheld check comes first
  organizationId: 'org-1',
  userId: 'user-1',
  sectionAccess,
});

describe('rosaToolsFor', () => {
  it('offers everything when nothing is restricted', () => {
    expect(rosaToolsFor(undefined)).toHaveLength(ROSA_TOOLS.length);
    expect(rosaToolsFor({})).toHaveLength(ROSA_TOOLS.length);
  });

  it('withholds the pulse tools when pulse is denied', () => {
    const names = rosaToolsFor({ pulse: false }).map((t) => t.name);
    for (const withheld of RESTRICTABLE_SECTIONS.pulse.rosaTools) {
      expect(names).not.toContain(withheld);
    }
    // ...and leaves the rest of her alone.
    expect(names).toContain('list_products');
    expect(names).toContain('get_org_context');
  });

  it('leaves the tool list intact for a section with no tools of its own', () => {
    expect(rosaToolsFor({ compensation: false })).toHaveLength(ROSA_TOOLS.length);
  });
});

describe('executeTool', () => {
  it('refuses a withheld tool even when it is named directly', async () => {
    // The offered list is already filtered, but a replayed conversation or an
    // invented name can still reach here.
    const result = await executeTool(ctx({ pulse: false }), 'query_pulse_metrics', {});
    expect(result.is_error).toBe(true);
    expect(result.audit).toMatchObject({ withheld: true });
    expect(result.content).not.toMatch(/\d/); // no data, not even a hint
  });
});

describe('compensation is out of reach entirely', () => {
  it('has no tool of its own', () => {
    const names = ROSA_TOOLS.map((t) => t.name).join(' ');
    expect(names).not.toMatch(/compensation|salary|salaries/i);
  });

  it('cannot be reached through run_safe_sql', () => {
    // If anyone adds this table to the whitelist, Rosa becomes a salary
    // lookup for every member of the org and this feature is undone.
    expect(SAFE_SQL_ALLOWED_TABLES).not.toContain('people_employee_compensation');
  });
});
