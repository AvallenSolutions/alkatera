import React, { Fragment } from 'react'

/**
 * Brand-name rendering primitives.
 *
 * The company name is always written as `alka**tera**` — all lowercase,
 * "tera" in bold. This module centralises that rule so callers never have to
 * embed `**` markdown (which leaks through in plain-text contexts) or
 * remember the casing.
 *
 *   <Brand />                  → "alka<strong>tera</strong>"
 *   <RichText>{aiOutput}</RichText> → auto-bolds every "alkatera" + parses **bold**
 *
 * Plain-text-only surfaces (sonner toasts, page <title>, image alt) should
 * use the literal string `"alkatera"` (lowercase). Bold can't render there;
 * lowercase still satisfies the casing rule.
 */

const BRAND_REGEX = /alkatera/gi
const BOLD_REGEX = /\*\*([^*]+?)\*\*/g
const ITALIC_REGEX = /(^|[^*])\*([^*\s][^*]*?)\*/g

interface Span {
  start: number
  end: number
  node: React.ReactNode
}

/**
 * Take a plain string and return a ReactNode array where every case-insensitive
 * occurrence of "alkatera" is replaced with `alka<strong>tera</strong>`, and
 * `**bold**` / `*italic*` markdown is parsed inline. Non-matching text is
 * returned verbatim.
 *
 * The returned casing of "alka" matches the casing of the input ("Alka",
 * "ALKA", "alka") so the original text isn't visibly mangled — only the bold
 * is added. (Tim's rule asks for all-lowercase; that's enforced at the
 * content layer, but we don't silently rewrite arbitrary input here. The
 * brand-style preference is encoded in the bold marker, not in casing
 * normalisation.)
 *
 * Note: pure utility, no DOM, no React state — safe to call from any render
 * path or test.
 */
export function applyBrandStyling(text: string): React.ReactNode {
  if (!text) return text

  const spans: Span[] = []
  let key = 0

  const collect = (re: RegExp, makeNode: (m: RegExpMatchArray) => { node: React.ReactNode; start: number; end: number }) => {
    re.lastIndex = 0
    let m: RegExpMatchArray | null
    while ((m = re.exec(text)) !== null) {
      const { node, start, end } = makeNode(m)
      // First-match-wins: drop any span that overlaps one we already have.
      if (spans.some((s) => start < s.end && end > s.start)) continue
      spans.push({ start, end, node })
    }
  }

  // Bold first (highest precedence), then italic, then brand. That way a
  // string like "**alkatera**" is rendered as bold containing the styled
  // brand, not as two adjacent styled spans.
  collect(BOLD_REGEX, (m) => {
    const start = m.index ?? 0
    return {
      start,
      end: start + m[0].length,
      node: <strong key={key++}>{applyBrandStyling(m[1])}</strong>,
    }
  })

  collect(ITALIC_REGEX, (m) => {
    const start = (m.index ?? 0) + m[1].length
    return {
      start,
      end: start + m[2].length + 2,
      node: <em key={key++}>{applyBrandStyling(m[2])}</em>,
    }
  })

  collect(BRAND_REGEX, (m) => {
    const start = m.index ?? 0
    const matched = m[0] // e.g. "Alkatera", "alkatera", "ALKATERA"
    const head = matched.slice(0, 4) // preserve input casing of "alka"
    const tail = matched.slice(4) // preserve input casing of "tera"
    return {
      start,
      end: start + matched.length,
      node: (
        <Fragment key={key++}>
          {head}
          <strong>{tail}</strong>
        </Fragment>
      ),
    }
  })

  if (spans.length === 0) return text

  spans.sort((a, b) => a.start - b.start)

  const out: React.ReactNode[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) out.push(text.slice(cursor, span.start))
    out.push(span.node)
    cursor = span.end
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

/**
 * Inline brand-name component. Renders the canonical "alka<strong>tera</strong>".
 *
 *   Welcome to <Brand />.   →   Welcome to alka<strong>tera</strong>.
 *
 * For inline use in JSX where copy is hand-written. For AI output or other
 * dynamic strings, prefer `<RichText>{string}</RichText>` so brand styling is
 * applied wherever the string mentions it.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <>
      alka<strong className={className}>tera</strong>
    </>
  )
}

interface RichTextProps {
  children: string | null | undefined
  /** Optional wrapping element. Defaults to a Fragment (no extra DOM). */
  as?: keyof React.JSX.IntrinsicElements
  className?: string
}

/**
 * Render a string with brand auto-styling and inline `**bold**` / `*italic*`
 * markdown. Use this around AI output and other dynamic copy so the brand
 * never visibly breaks.
 */
export function RichText({ children, as, className }: RichTextProps) {
  if (!children) return null
  const nodes = applyBrandStyling(String(children))
  if (as) {
    const Tag = as as any
    return <Tag className={className}>{nodes}</Tag>
  }
  if (className) {
    return <span className={className}>{nodes}</span>
  }
  return <>{nodes}</>
}
