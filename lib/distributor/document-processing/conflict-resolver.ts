import { FIELD_DEFINITIONS, type FieldKey } from '../scraping/field-definitions';

export type Resolution = 'keep_existing' | 'use_new' | 'flagged_for_review';

export interface ConflictDecisionInput {
  fieldKey: FieldKey;
  existingValueText: string | null;
  existingValueNumeric: number | null;
  existingConfidence: number;
  existingSource: string | null;
  newValueText: string;
  newValueNumeric: number | null;
  newConfidence: number;
  newSource: string;
}

export interface ConflictDecision {
  /** True if the new value materially differs from the existing one. */
  differs: boolean;
  /** Auto-resolution outcome. Only set when differs=true. */
  resolution?: Resolution;
}

const RELATIVE_THRESHOLD = 0.10; // 10 %
const ABSOLUTE_THRESHOLD = 0.01; // floor for tiny values

/**
 * Decide whether a new value differs enough from an existing value to
 * warrant a conflict row, and if so, whether we can auto-resolve.
 *
 * Diff heuristic per field type:
 *   - boolean / year / string: differ iff the canonical values are not equal
 *   - number: differ iff relative gap > 10% AND absolute gap > 0.01
 *
 * Auto-resolution rules:
 *   - if `new_source === 'brand_upload'` and newConfidence >= 0.7 and
 *     newConfidence > existingConfidence → use_new
 *   - else if newConfidence < existingConfidence - 0.2 → keep_existing
 *   - else → flagged_for_review (distributor decides)
 */
export function decideConflict(input: ConflictDecisionInput): ConflictDecision {
  const def = FIELD_DEFINITIONS.find((f) => f.key === input.fieldKey);
  const type = def?.type ?? 'string';

  const differs = valuesDiffer(
    type,
    input.existingValueText,
    input.existingValueNumeric,
    input.newValueText,
    input.newValueNumeric,
  );
  if (!differs) return { differs: false };

  const resolution = autoResolve(
    input.existingConfidence,
    input.newConfidence,
    input.newSource,
  );
  return { differs: true, resolution };
}

export function autoResolve(
  existingConfidence: number,
  newConfidence: number,
  newSource: string,
): Resolution {
  if (newSource === 'brand_upload' && newConfidence >= 0.7 && newConfidence > existingConfidence) {
    return 'use_new';
  }
  if (newConfidence < existingConfidence - 0.2) {
    return 'keep_existing';
  }
  return 'flagged_for_review';
}

function valuesDiffer(
  type: 'boolean' | 'number' | 'year' | 'string' | 'longtext',
  existingText: string | null,
  existingNumeric: number | null,
  newText: string,
  newNumeric: number | null,
): boolean {
  if (existingText === null) return true;

  if (type === 'number') {
    if (existingNumeric === null || newNumeric === null) {
      return existingText.trim().toLowerCase() !== newText.trim().toLowerCase();
    }
    if (existingNumeric === newNumeric) return false;
    const abs = Math.abs(newNumeric - existingNumeric);
    if (abs < ABSOLUTE_THRESHOLD) return false;
    const denom = Math.max(Math.abs(existingNumeric), Math.abs(newNumeric), 1e-9);
    return abs / denom > RELATIVE_THRESHOLD;
  }
  if (type === 'year') {
    return existingNumeric !== newNumeric;
  }
  if (type === 'boolean') {
    return Boolean(existingNumeric) !== Boolean(newNumeric);
  }
  if (type === 'longtext') {
    // Long-form prose (e.g. AI-generated company descriptions) is
    // never treated as "in conflict" — there's no canonical truth to
    // compare and we don't want minor re-phrasings to clog the
    // distributor's conflict-review queue. The newer row simply
    // supersedes the older one via the existing supersede chain.
    return false;
  }
  return existingText.trim().toLowerCase() !== newText.trim().toLowerCase();
}
