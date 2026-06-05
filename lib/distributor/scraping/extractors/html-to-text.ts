/**
 * Strip an HTML document down to plain readable text suitable for
 * feeding into an LLM extraction prompt. Drops nav/script/style nodes
 * (and their contents) outright; strips all remaining tags; decodes
 * common entities; collapses whitespace; truncates to a budget so we
 * keep LLM token spend predictable.
 *
 * Implemented without `sanitize-html` ON PURPOSE: that package drags in
 * the full `postcss` CSS parser (which `require()`s `nanoid/non-secure`),
 * and Netlify's function bundler can't resolve that transitive require
 * through pnpm's symlinked node_modules — it crashed the scrape
 * background function at init. This regex pass needs none of that.
 */

// Tags whose entire subtree (tag + contents) should be removed, not
// just unwrapped. Matches the previous `nonTextTags` behaviour.
const DROP_WITH_CONTENT = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'footer',
  'header',
  'iframe',
  'form',
];

const NAMED_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  // Numeric entities: decimal (&#123;) and hex (&#x1F;).
  out = out.replace(/&#(\d+);/g, (_, dec) => {
    const code = Number(dec);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
  return out;
}

export function htmlToText(html: string, maxChars = 8000): string {
  let text = html;

  // Drop comments.
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  // Drop tags-with-content (script/style/nav/etc.). Non-greedy so we
  // stop at the first matching close tag; tolerant of attributes.
  for (const tag of DROP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    text = text.replace(re, ' ');
    // Self-closing or unclosed variants (e.g. a lone <svg/> or a
    // truncated document): strip the opening tag so it doesn't survive.
    text = text.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), ' ');
  }

  // Strip every remaining tag, keeping its inner text.
  text = text.replace(/<[^>]+>/g, ' ');

  const collapsed = decodeEntities(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (collapsed.length <= maxChars) return collapsed;
  return collapsed.slice(0, maxChars) + '…';
}
