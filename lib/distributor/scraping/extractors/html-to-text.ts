import sanitizeHtml from 'sanitize-html';

/**
 * Strip an HTML document down to plain readable text suitable for
 * feeding into an LLM extraction prompt. Drops nav/script/style nodes
 * outright; collapses whitespace; truncates to a budget so we keep
 * Anthropic token spend predictable.
 */
export function htmlToText(html: string, maxChars = 8000): string {
  const sanitised = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'iframe', 'form'],
  });

  const collapsed = sanitised
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (collapsed.length <= maxChars) return collapsed;
  return collapsed.slice(0, maxChars) + '…';
}
