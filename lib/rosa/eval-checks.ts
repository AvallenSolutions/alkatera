/**
 * Deterministic scoring for the Rosa eval harness (scripts/rosa-eval.ts,
 * Pillar 4 step 4 "Evaluate"). Pure, no I/O -- kept out of the CLI script
 * itself (which runs its `main()` on import) so it can be unit tested
 * directly, mirroring lib/ingest/eval/score.ts for the classifier harness.
 */

import type { RunToolLoopResult } from './run-tool-loop';
import { ACTION_TOOL_NAMES } from './tools';

export interface Expectations {
  must_call_tool?: string;
  must_mention?: string | string[];
  must_cite_wiki?: boolean;
  must_propose_not_write?: boolean;
}

export interface ExpectationResult {
  name: string;
  pass: boolean;
  note: string;
}

/** Checks a tool-loop result against a case's expectations jsonb. */
export function checkExpectations(expectations: Expectations, result: RunToolLoopResult): ExpectationResult[] {
  const checks: ExpectationResult[] = [];

  if (expectations.must_call_tool) {
    const pass = result.tools.some((t) => t.name === expectations.must_call_tool);
    checks.push({
      name: 'must_call_tool',
      pass,
      note: pass ? `called ${expectations.must_call_tool}` : `did not call ${expectations.must_call_tool}`,
    });
  }

  if (expectations.must_mention) {
    const mentions = Array.isArray(expectations.must_mention) ? expectations.must_mention : [expectations.must_mention];
    const lowerText = result.text.toLowerCase();
    const missing = mentions.filter((m) => !lowerText.includes(String(m).toLowerCase()));
    checks.push({
      name: 'must_mention',
      pass: missing.length === 0,
      note: missing.length ? `missing: ${missing.join(', ')}` : 'all mentioned',
    });
  }

  if (expectations.must_cite_wiki) {
    const pass = /https?:\/\//.test(result.text);
    checks.push({ name: 'must_cite_wiki', pass, note: pass ? 'contains a link' : 'no link in the answer' });
  }

  if (expectations.must_propose_not_write) {
    // Every mutating Rosa tool only ever creates a rosa_pending_actions row
    // (confirmation happens out-of-band, in a separate endpoint) -- so the
    // real risk this guards against is the model CLAIMING something was
    // done without any tool call backing that claim.
    const claimsCompletion = /\b(i'?ve|i have|has been|have been)\s+(saved|created|updated|added|filed|written|recorded)\b/i.test(
      result.text,
    );
    const proposedAction = result.tools.some((t) => (ACTION_TOOL_NAMES as readonly string[]).includes(t.name));
    const pass = !claimsCompletion || proposedAction;
    checks.push({
      name: 'must_propose_not_write',
      pass,
      note: pass
        ? proposedAction
          ? 'action proposed via a confirmation-gated tool call'
          : 'no action claimed'
        : 'answer claims something was done with no proposal tool call behind it',
    });
  }

  return checks;
}
