/**
 * Generic CSV-header → field-key suggester. Used by the distributor SKU
 * upload and the admin brand/product directory uploads to pre-fill the
 * column mapper with likely matches so the user only has to confirm.
 */
export function suggestHeaderMapping<Key extends string>(
  headers: string[],
  aliases: Record<Key, string[]>,
): Partial<Record<Key, string>> {
  const out: Partial<Record<Key, string>> = {};
  const normalised = headers.map((h) => ({ original: h, normal: normaliseHeader(h) }));
  for (const key of Object.keys(aliases) as Key[]) {
    const want = aliases[key];
    const match = normalised.find((h) => want.includes(h.normal));
    if (match) out[key] = match.original;
  }
  return out;
}

export function normaliseHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}
