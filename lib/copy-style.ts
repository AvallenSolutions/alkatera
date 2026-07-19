/**
 * House copy style for generated prose.
 *
 * Static copy in the codebase is written by hand and reviewed, but anything an
 * LLM writes reaches users unreviewed. That makes every prose-generating prompt
 * a place the house style can leak, and em dashes are the rule that leaks most:
 * models reach for them constantly.
 *
 * Before this module the rule was hand-copied into individual prompts in five
 * different wordings, present in some prose prompts and absent from others
 * (including Rosa's main persona). Import from here instead of writing it out,
 * so there is one wording to change and one place to check.
 */

/**
 * The em-dash rule, worded for an LLM system prompt.
 *
 * Drop this into the voice/style section of any prompt whose output is prose a
 * user will read. It is deliberately one line so it composes with whatever
 * surrounding style guidance a prompt already has.
 */
export const NO_EM_DASH_RULE =
  'Never use em dashes (—) or en dashes (–) in prose. Use a comma, a colon or a full stop instead.';

/**
 * The full house voice for user-facing prose, for prompts that have no style
 * section of their own to slot NO_EM_DASH_RULE into.
 *
 * Rosa's "never call yourself an AI" rule is deliberately NOT here: it is
 * specific to Rosa's persona and would be wrong in, say, a report narrative.
 */
export const HOUSE_STYLE = [
  'Write in British English.',
  NO_EM_DASH_RULE,
  'Plain, direct language. No corporate jargon, no sustainability jargon. Assume the reader is not a sustainability expert.',
  'Always write the brand name "alkatera" in lowercase.',
].join('\n');

/**
 * Rosa's identity and preamble used to live here. They moved to
 * `lib/rosa/persona.ts`, which owns everything Rosa is; this module keeps only
 * the copy rules that also govern prose Rosa has nothing to do with, such as
 * LCA report narratives. persona.ts imports from here, never the reverse.
 */

/**
 * Strip em and en dashes out of generated copy.
 *
 * Belt and braces behind the prompt rule, for copy that goes straight to the UI
 * without a human in the loop. The prompt is the primary mechanism; this is the
 * net underneath it.
 *
 * A dash standing alone is left untouched: that is the empty-state marker used
 * throughout the UI ("—" in a table cell meaning "no value"), not prose.
 */
export function scrubEmDashes(value: string): string {
  if (!value) return value;

  // A field that is nothing but dashes and whitespace is a placeholder, not a
  // sentence. Rewriting it to ", " would turn "no value" into visible junk.
  if (/^[\s—–-]+$/.test(value)) return value;

  return value
    .replace(/\s*[—–]\s*/g, ', ')
    // The dash may have stood where punctuation already was ("foo, — bar"),
    // or ended the string; collapse what that leaves behind.
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?;:])/g, '$1')
    .replace(/,\s*$/, '')
    .replace(/\s{2,}/g, ' ');
}
