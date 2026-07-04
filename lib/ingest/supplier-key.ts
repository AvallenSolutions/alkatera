/**
 * Supplier-key derivation for the Smart Upload learning loop. The key is the
 * per-org identity of a recurring document source ("british gas", "biffa"),
 * used to file confirmed uploads into ingest_document_profiles. Zero I/O,
 * zero imports — bundle-safe for the Netlify background function graph.
 */

// Which payload field names the document source, per result type. Types with
// no recurring named source (packaging specs, historical reports) learn no
// profile and return null.
const SUPPLIER_FIELD_BY_TYPE: Record<string, string> = {
  utility_bill: 'supplier_name',
  water_bill: 'supplier_name',
  waste_bill: 'supplier_name',
  supplier_invoice: 'supplier_name',
  supplier_coa: 'supplier_name',
  bom: 'supplier_name',
  freight_invoice: 'carrier_name',
  refrigerant_service: 'engineer',
  certification: 'issuer',
  soil_carbon_lab: 'lab_name',
};

// Trailing legal-form tokens stripped from company names so "British Gas Ltd"
// and "British Gas Limited" collapse to the same key.
const LEGAL_SUFFIXES = new Set([
  'ltd',
  'limited',
  'plc',
  'inc',
  'incorporated',
  'llc',
  'llp',
  'gmbh',
  'co',
  'company',
  'uk',
  'ag',
  'sa',
  'srl',
  'bv',
  'pty',
]);

const MAX_KEY_LENGTH = 120;

/** Normalise a raw supplier/carrier/lab name into a stable lookup key. */
export function normaliseSupplierKey(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const words = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }
  const key = words.join(' ').slice(0, MAX_KEY_LENGTH).trim();
  return key === '' ? null : key;
}

/**
 * Derive the supplier key for a confirmed upload. Prefers the user-saved
 * value (it may have been corrected) and falls back to the classifier's.
 */
export function supplierKeyForResult(
  resultType: string,
  saved: Record<string, unknown>,
  classifier: Record<string, unknown>,
): string | null {
  const field = SUPPLIER_FIELD_BY_TYPE[resultType];
  if (!field) return null;
  const savedValue = saved?.[field];
  const classifierValue = classifier?.[field];
  const raw =
    typeof savedValue === 'string' && savedValue.trim() !== ''
      ? savedValue
      : typeof classifierValue === 'string'
        ? classifierValue
        : null;
  return raw === null ? null : normaliseSupplierKey(raw);
}
