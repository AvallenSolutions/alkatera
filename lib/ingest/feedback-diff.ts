/**
 * Pure field-level diff between what the Smart Upload classifier extracted
 * and what the user actually saved after review. Powers the ingest_feedback
 * learning loop. Zero I/O, zero imports — must stay bundle-safe for the
 * Netlify background function graph (relative imports only in lib/ingest).
 */

export interface FieldDiff {
  path: string;
  from: unknown;
  to: unknown;
  change: 'edited' | 'added' | 'removed';
}

export interface DiffSummary {
  edited: number;
  added: number;
  removed: number;
  fields: FieldDiff[];
}

// Keys that never count as user corrections: plumbing fields, plus save-flow
// bindings the classifier could not have known (those travel in the separate
// `context` object on the feedback row instead).
const IGNORE_KEYS = new Set([
  'stashId',
  'stash_id',
  'type',
  'facility_id',
  'facilityId',
  'organizationId',
  'organization_id',
  'userId',
  'user_id',
  'report_id',
  'land_unit_id',
  'land_unit_type',
  'framework_id',
  'supplier_product_id',
  'product_id',
  'asset_id',
  'asset_kind',
  'resolution',
  'verification_status',
  'notes',
  'billName',
  'saved_count',
]);

// Saved-side → classifier-side key renames so renamed form fields diff
// against the right source. Applied via applyFieldAliases before diffing.
export const FIELD_ALIASES: Record<string, Record<string, string>> = {
  supplier_invoice: { category: 'suggested_category' },
  supplier_coa: { document_name: 'product_name' },
  certification: {
    certification_number: 'certificate_number',
    certification_date: 'issue_date',
  },
};

/** Rename saved-payload keys to their classifier-side names for one type. */
export function applyFieldAliases(
  resultType: string,
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const aliases = FIELD_ALIASES[resultType];
  if (!aliases) return saved;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(saved)) {
    out[aliases[key] ?? key] = value;
  }
  return out;
}

const MAX_FIELDS = 200;
const MAX_VALUE_CHARS = 500;

// Identity keys used to align array-of-object items (line items, samples,
// packaging components) so reordering does not read as an edit.
const IDENTITY_KEYS = ['description', 'name', 'component_name', 'location_label'];

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** True when the two leaves are equivalent after normalisation. */
function leavesEqual(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) !== isEmpty(b)) return false;
  const na = asNumber(a);
  const nb = asNumber(b);
  // Panels keep numbers as strings ('450' vs 450) — compare numerically when
  // both sides parse cleanly.
  if (na !== null && nb !== null) return Math.abs(na - nb) < 1e-9;
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  return String(a) === String(b);
}

function capValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > MAX_VALUE_CHARS ? v.slice(0, MAX_VALUE_CHARS) : v;
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_VALUE_CHARS ? s.slice(0, MAX_VALUE_CHARS) : s;
  } catch {
    return String(v).slice(0, MAX_VALUE_CHARS);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function identityOf(item: unknown): string | null {
  if (!isPlainObject(item)) return null;
  for (const key of IDENTITY_KEYS) {
    const v = item[key];
    if (typeof v === 'string' && v.trim() !== '') {
      return v.trim().toLowerCase();
    }
  }
  return null;
}

function pushDiff(out: FieldDiff[], diff: FieldDiff): void {
  if (out.length >= MAX_FIELDS) return;
  out.push(diff);
}

function diffArrays(path: string, from: unknown[], to: unknown[], out: FieldDiff[]): void {
  const fromKeyed = new Map<string, unknown>();
  const toKeyed = new Map<string, unknown>();
  for (const item of from) {
    const key = identityOf(item);
    if (key !== null && !fromKeyed.has(key)) fromKeyed.set(key, item);
  }
  for (const item of to) {
    const key = identityOf(item);
    if (key !== null && !toKeyed.has(key)) toKeyed.set(key, item);
  }

  // Identity-keyed alignment only when both sides are keyable; otherwise fall
  // back to index-wise comparison.
  const useKeys =
    from.length > 0 && to.length > 0 && fromKeyed.size === from.length && toKeyed.size === to.length;

  if (useKeys) {
    fromKeyed.forEach((fromItem, key) => {
      const toItem = toKeyed.get(key);
      if (toItem === undefined) {
        pushDiff(out, { path: `${path}[${key}]`, from: capValue(fromItem), to: null, change: 'removed' });
      } else {
        diffValue(`${path}[${key}]`, fromItem, toItem, out);
      }
    });
    toKeyed.forEach((toItem, key) => {
      if (!fromKeyed.has(key)) {
        pushDiff(out, { path: `${path}[${key}]`, from: null, to: capValue(toItem), change: 'added' });
      }
    });
    return;
  }

  const max = Math.max(from.length, to.length);
  for (let i = 0; i < max; i++) {
    if (i >= from.length) {
      pushDiff(out, { path: `${path}[${i}]`, from: null, to: capValue(to[i]), change: 'added' });
    } else if (i >= to.length) {
      pushDiff(out, { path: `${path}[${i}]`, from: capValue(from[i]), to: null, change: 'removed' });
    } else {
      diffValue(`${path}[${i}]`, from[i], to[i], out);
    }
  }
}

function diffValue(path: string, from: unknown, to: unknown, out: FieldDiff[]): void {
  if (out.length >= MAX_FIELDS) return;

  if (Array.isArray(from) || Array.isArray(to)) {
    diffArrays(path, Array.isArray(from) ? from : [], Array.isArray(to) ? to : [], out);
    return;
  }

  if (isPlainObject(from) || isPlainObject(to)) {
    const fromObj = isPlainObject(from) ? from : {};
    const toObj = isPlainObject(to) ? to : {};
    const keys = new Set([...Object.keys(fromObj), ...Object.keys(toObj)]);
    keys.forEach((key) => {
      if (IGNORE_KEYS.has(key)) return;
      diffValue(path ? `${path}.${key}` : key, fromObj[key], toObj[key], out);
    });
    return;
  }

  if (leavesEqual(from, to)) return;
  const change: FieldDiff['change'] = isEmpty(from) ? 'added' : isEmpty(to) ? 'removed' : 'edited';
  pushDiff(out, { path, from: capValue(from), to: capValue(to), change });
}

/**
 * Diff the classifier payload against the user-saved payload. Only fields the
 * user could plausibly have corrected are counted: plumbing/binding keys are
 * ignored, numeric-ish strings compare as numbers, and arrays of objects are
 * aligned by identity key so reordering is not an edit.
 */
export function computeFieldDiff(
  classifier: Record<string, unknown>,
  saved: Record<string, unknown>,
): DiffSummary {
  const fields: FieldDiff[] = [];
  diffValue('', classifier ?? {}, saved ?? {}, fields);
  let edited = 0;
  let added = 0;
  let removed = 0;
  for (const f of fields) {
    if (f.change === 'edited') edited++;
    else if (f.change === 'added') added++;
    else removed++;
  }
  return { edited, added, removed, fields };
}
