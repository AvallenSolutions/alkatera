/**
 * Strip characters that have structural meaning inside a PostgREST
 * `.or()` / `.filter()` expression, so a user-supplied search term cannot alter
 * the query structure.
 *
 * In `.or('col.ilike.%term%,other.ilike.%term%')` a `,` separates OR
 * conditions, `()` group them, `*` is the wildcard and `\` escapes. Leaving
 * these in raw user input lets a crafted term add/avoid predicates (a
 * data-scoping / DoS-grade injection, bounded by RLS). We replace them with
 * spaces so the term still matches sensibly. `%`/`_` are left intact: they are
 * the intended LIKE wildcards in the surrounding template.
 *
 * (security review 2026-05-29, MED-3)
 */
export function sanitizePostgrestSearch(input: string): string {
  return input.replace(/[,()*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}
