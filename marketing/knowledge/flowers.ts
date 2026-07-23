/**
 * Every article in the library is pressed with a species from the
 * growth field's meadow. The pick is a stable hash of the slug so a
 * given article always carries the same flower, on its card and on
 * its own page.
 */
const SPECIES = [
  '/assets/species/flower-cow-parsley.svg',
  '/assets/species/understory-fern.svg',
  '/assets/species/flower-cornflower.svg',
  '/assets/species/flower-thistle.svg',
  '/assets/species/flower-campion.svg',
  '/assets/species/flower-clover.svg',
  '/assets/species/flower-oxeye-daisy.svg',
  '/assets/species/flower-buttercup.svg',
  '/assets/species/flower-knapweed.svg',
  '/assets/species/flower-foxglove.svg',
  '/assets/species/flower-poppy.svg',
  '/assets/species/grass-seed-head.svg',
];

export function flowerForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return SPECIES[hash % SPECIES.length];
}
