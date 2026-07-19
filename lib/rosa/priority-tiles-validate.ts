/**
 * Rosa — priority-tile output validator.
 *
 * Defends the renderer from any LLM output that's malformed, hallucinated,
 * or out of bounds. Anything that fails validation is dropped; if too
 * much is dropped, the API route falls back to deterministic tiles.
 */

import { scrubEmDashes } from '@/lib/copy-style'
import {
  TILE_HREF_PREFIXES,
  TILE_ICON_VOCAB,
  TILE_TONES,
  type TileIcon,
  type TileTone,
} from './priority-tiles-prompt'

export interface CuratedTile {
  id: string
  kind: string
  value: string
  unit: string | null
  title: string
  hint: string
  recommendation: string
  icon: TileIcon
  href: string | null
  tone: TileTone
  signal_basis: string[]
}

export interface ValidationResult {
  tiles: CuratedTile[]
  drops: Array<{ index: number; reason: string }>
}

const MAX_VALUE_LEN = 24
const MAX_UNIT_LEN = 16
const MAX_TITLE_LEN = 80
const MAX_HINT_LEN = 140
const MAX_RECOMMENDATION_LEN = 160

const ICON_SET: Set<string> = new Set(TILE_ICON_VOCAB)
const TONE_SET: Set<string> = new Set(TILE_TONES)
const HREF_PREFIX_LIST: string[] = [...TILE_HREF_PREFIXES]

function clamp(str: unknown, max: number): string {
  return String(str ?? '').trim().slice(0, max)
}

function isAllowedHref(href: string): boolean {
  if (!href.startsWith('/')) return false
  // Strip query/hash for the prefix check.
  const path = href.split(/[?#]/)[0]
  return HREF_PREFIX_LIST.some(p => path === p || path.startsWith(p + (p.endsWith('/') ? '' : '/')) || path.startsWith(p))
}

/**
 * Pull every numeric scalar out of the signal pack so we can sanity-check
 * that any number Rosa quotes in `value` actually exists somewhere in
 * the pack (within a small fuzz allowance). Prevents her inventing a "5
 * facilities" when there are 12.
 */
function collectPackNumbers(pack: unknown, into: Set<number>): void {
  if (pack === null || pack === undefined) return
  if (typeof pack === 'number' && Number.isFinite(pack)) {
    into.add(Math.round(pack))
    return
  }
  if (typeof pack === 'string') {
    // Don't pull numbers out of strings — too noisy.
    return
  }
  if (Array.isArray(pack)) {
    for (const item of pack) collectPackNumbers(item, into)
    return
  }
  if (typeof pack === 'object') {
    for (const v of Object.values(pack as Record<string, unknown>)) collectPackNumbers(v, into)
  }
}

function looksLikeNumberPlausibly(value: string, packNumbers: Set<number>): boolean {
  // Accept anything non-numeric (e.g. "overdue", "✓", "3 days", "1 next step").
  // The check only fires when the value reads as a bare number.
  const m = value.trim().match(/^-?\d+(\.\d+)?$/)
  if (!m) return true
  const n = Math.round(Number(m[0]))
  if (packNumbers.has(n)) return true
  // Allow obviously safe small numbers (0, 1) which often appear as literals
  // (e.g. "1" for "next step") even when they aren't in the pack.
  if (n === 0 || n === 1) return true
  return false
}

/**
 * Build a stable-ish id for a tile: prefer the curator's `kind` and the
 * first signal basis to keep snooze keys stable across regenerations.
 */
function tileId(orgId: string, userId: string, raw: { kind?: unknown; signal_basis?: unknown }): string {
  const kind = clamp(raw.kind ?? 'tile', 32) || 'tile'
  const basis = Array.isArray(raw.signal_basis) ? raw.signal_basis.join(',') : ''
  // No PII; we use a short stable string.
  return `${orgId.slice(0, 8)}:${userId.slice(0, 8)}:${kind}:${basis.slice(0, 64)}`
}

export interface ValidateOptions {
  organizationId: string
  userId: string
  /** The signal pack as fed to the curator — used for number sanity. */
  signalPack: unknown
}

export function validateCuratedTiles(
  raw: unknown,
  opts: ValidateOptions,
): ValidationResult {
  const drops: ValidationResult['drops'] = []
  const out: CuratedTile[] = []

  const packNumbers = new Set<number>()
  collectPackNumbers(opts.signalPack, packNumbers)

  const list = Array.isArray((raw as any)?.tiles) ? (raw as any).tiles : []
  for (let i = 0; i < list.length; i += 1) {
    if (out.length >= 3) {
      drops.push({ index: i, reason: 'over-3-tiles' })
      continue
    }
    const t = list[i] as Record<string, unknown> | null | undefined
    if (!t || typeof t !== 'object') {
      drops.push({ index: i, reason: 'not-an-object' })
      continue
    }

    const value = clamp(t.value, MAX_VALUE_LEN)
    if (!value) {
      drops.push({ index: i, reason: 'missing-value' })
      continue
    }
    if (!looksLikeNumberPlausibly(value, packNumbers)) {
      drops.push({ index: i, reason: `value '${value}' not in signal pack` })
      continue
    }

    const title = clamp(t.title, MAX_TITLE_LEN)
    const hint = clamp(t.hint, MAX_HINT_LEN)
    const recommendation = clamp(t.recommendation, MAX_RECOMMENDATION_LEN)
    if (!title || !hint) {
      drops.push({ index: i, reason: 'missing-title-or-hint' })
      continue
    }

    const iconRaw = typeof t.icon === 'string' ? t.icon : 'Sparkles'
    const icon: TileIcon = (ICON_SET.has(iconRaw) ? iconRaw : 'Sparkles') as TileIcon

    const toneRaw = typeof t.tone === 'string' ? t.tone : 'info'
    const tone: TileTone = (TONE_SET.has(toneRaw) ? toneRaw : 'info') as TileTone

    let href: string | null = null
    if (typeof t.href === 'string' && t.href.length > 0) {
      href = isAllowedHref(t.href) ? t.href : null
      if (!href) {
        // We don't drop the tile for a bad href — just strip it.
        drops.push({ index: i, reason: `href '${t.href}' rejected; tile kept without click target` })
      }
    }

    const unitRaw = typeof t.unit === 'string' ? clamp(t.unit, MAX_UNIT_LEN) : null
    const unit = unitRaw && unitRaw.length > 0 ? unitRaw : null

    const signalBasis = Array.isArray(t.signal_basis)
      ? t.signal_basis
          .filter((s): s is string => typeof s === 'string')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 6)
      : []

    out.push({
      id: tileId(opts.organizationId, opts.userId, t),
      kind: clamp(t.kind ?? 'tile', 32) || 'tile',
      value: scrubEmDashes(value),
      unit,
      title: scrubEmDashes(title),
      hint: scrubEmDashes(hint),
      recommendation: scrubEmDashes(recommendation),
      icon,
      href,
      tone,
      signal_basis: signalBasis,
    })
  }

  return { tiles: out, drops }
}
