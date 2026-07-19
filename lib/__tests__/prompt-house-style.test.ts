/**
 * Regression guard: prompts that generate user-facing prose must carry the
 * em-dash rule.
 *
 * The rule kept decaying because it was hand-copied into individual prompts in
 * several different wordings. Someone adding a prose prompt had no way to know
 * the rule existed, so new prompts shipped without it and the model emitted em
 * dashes straight into the UI. lib/copy-style.ts is now the one wording; this
 * test fails if the most user-visible prompt loses it.
 *
 * Adding a new prose prompt? Import NO_EM_DASH_RULE (or HOUSE_STYLE) from
 * lib/copy-style rather than writing the rule out by hand.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { NO_EM_DASH_RULE, HOUSE_STYLE } from '../copy-style';
import { ROSA_SYSTEM_PROMPT } from '@/lib/gaia/system-prompt';

describe('Rosa system prompt', () => {
  it('carries the em-dash rule', () => {
    expect(ROSA_SYSTEM_PROMPT).toContain(NO_EM_DASH_RULE);
  });

  it('gets it from the shared house style, not a hand-copied line', () => {
    expect(ROSA_SYSTEM_PROMPT).toContain(HOUSE_STYLE);
  });

  it('still forbids describing herself as an AI', () => {
    // The house-style block deliberately omits this Rosa-specific rule, so
    // check the persona did not lose it when the block was introduced.
    expect(ROSA_SYSTEM_PROMPT).toContain('NEVER describe yourself as an "AI"');
  });
});

describe('no prompt tells Rosa she is an AI', () => {
  // Three live Pulse prompts opened with "You are Rosa, alkatera's
  // sustainability AI", which trains the exact self-description the identity
  // rule bans, in the very first sentence. Grepping the tree is the only way
  // to catch this: the prompts are inline consts inside route files that
  // cannot be imported here without pulling in server-only dependencies.
  const PROMPT_DIRS = ['lib', 'app/api'];
  const BANNED = /(?:sustainability|alkatera'?s?)\s+AI\b|You are an AI/i;

  function walk(dir: string, out: string[] = []): string[] {
    const root = join(process.cwd(), dir);
    if (!existsSync(root)) return out;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(rel, out);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(rel);
      }
    }
    return out;
  }

  it('has no "sustainability AI" phrasing in any prompt source', () => {
    const offenders: string[] = [];
    for (const file of walk(PROMPT_DIRS[0]).concat(walk(PROMPT_DIRS[1]))) {
      // copy-style.ts documents the anti-pattern in a comment, by design.
      if (file.endsWith('copy-style.ts')) continue;
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      if (BANNED.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the rule text itself', () => {
  it('does not contradict itself with a stray prose dash', () => {
    // It names the two characters it forbids, in brackets. Any occurrence
    // beyond those two would be the prompt modelling the behaviour it bans.
    const dashes = NO_EM_DASH_RULE.match(/[—–]/g) || [];
    expect(dashes).toHaveLength(2);
  });

  it('is a single line, so it composes into any prompt style section', () => {
    expect(NO_EM_DASH_RULE).not.toContain('\n');
  });
});
