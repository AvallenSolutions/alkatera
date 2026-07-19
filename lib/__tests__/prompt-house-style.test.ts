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
