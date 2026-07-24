/**
 * The walk of a product's page, in Rosa's voice.
 *
 * Replaces `lib/product-guide.ts`, whose seven steps narrated a five-tab page
 * that no longer exists ("these tabs hold everything about your product").
 * Four steps now, one per section of the story, plus a hand over to Rosa.
 *
 * Rosa is "Rosa" or "your sustainability partner", never "AI". British English,
 * plain language, statements end with a full stop, and never an em dash.
 */

export interface ProductWalkStep {
  /** Matches the `data-guide` attribute the hub renders. */
  anchor: string;
  title: string;
  body: string;
}

export const PRODUCT_WALK_STEPS: ProductWalkStep[] = [
  {
    anchor: 'product-statement',
    title: 'The product',
    body: 'Everything about this product lives on one page. The number at the top is its footprint per unit, and the word beside it says how much of that is confirmed.',
  },
  {
    anchor: 'product-footprint-cta',
    title: 'The footprint',
    body: 'This opens the full record: every figure, where it came from, and what still needs your eye. You correct things there rather than filling in forms.',
  },
  {
    anchor: 'product-recipe',
    title: 'What it is made of',
    body: 'The recipe is the heart of it. Change an ingredient or the packaging here and the footprint follows on its own.',
  },
  {
    anchor: 'product-story',
    title: 'What you can show',
    body: 'The report and the public passport live here. They open up once enough of the footprint is confirmed, so nothing unchecked goes out with your name on it.',
  },
];

/** The prompt the walk hands to Rosa at the end. */
export function walkRosaPrompt(productName: string): string {
  return `What should I do next for ${productName}?`;
}
