/**
 * Pure helpers for Rosa's implicit learning signals (Pillar 4 step 1
 * "Capture" -- data-revolution-plan.md). No I/O here; callers own the
 * telemetry write (lib/rosa/budget.ts's logRosaTelemetry) and the DB reads
 * that supply these inputs.
 */

/**
 * Normalises text into a set of lowercase word tokens for a simple Jaccard
 * overlap check. Strips punctuation, collapses whitespace. Deliberately
 * crude -- this is a cheap heuristic, not an NLP pipeline.
 */
export function normalizeWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return new Set(words)
}

/**
 * Jaccard similarity (intersection / union) between the normalised word
 * sets of two strings. 0 when either side has no words; 1 for identical
 * word sets regardless of order or repetition.
 */
export function jaccardWordOverlap(a: string, b: string): number {
  const setA = normalizeWords(a)
  const setB = normalizeWords(b)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  Array.from(setA).forEach(word => {
    if (setB.has(word)) intersection += 1
  })
  const unionSize = setA.size + setB.size - intersection
  return unionSize === 0 ? 0 : intersection / unionSize
}

export interface RephraseCheckInput {
  /** The user's previous message in this conversation, if any. */
  previousUserMessage: string | null | undefined
  /** ISO timestamp the previous user message was created. */
  previousUserMessageAt: string | null | undefined
  /** The user's new message. */
  newUserMessage: string
  /** Clock to compare against; defaults to now. Injectable for tests. */
  now?: Date
}

/** How old the previous user message can be and still count as a rephrase. */
export const REPHRASE_WINDOW_MS = 5 * 60 * 1000
/** Minimum normalised word-set overlap to count as "the same question again". */
export const REPHRASE_OVERLAP_THRESHOLD = 0.6

/**
 * A cheap heuristic for "the user just asked this again in different
 * words" -- logged as `learning.rephrase` telemetry so the curation sweep
 * can spot questions Rosa answered unsatisfyingly the first time. True
 * when the previous user turn is under REPHRASE_WINDOW_MS old AND the two
 * messages' normalised word sets overlap by at least
 * REPHRASE_OVERLAP_THRESHOLD (Jaccard).
 */
export function isLikelyRephrase(input: RephraseCheckInput): boolean {
  const { previousUserMessage, previousUserMessageAt, newUserMessage } = input
  if (!previousUserMessage || !previousUserMessageAt) return false
  if (!newUserMessage || !newUserMessage.trim()) return false

  const now = input.now ?? new Date()
  const previousAt = new Date(previousUserMessageAt)
  if (Number.isNaN(previousAt.getTime())) return false

  const ageMs = now.getTime() - previousAt.getTime()
  if (ageMs < 0 || ageMs > REPHRASE_WINDOW_MS) return false

  return jaccardWordOverlap(previousUserMessage, newUserMessage) >= REPHRASE_OVERLAP_THRESHOLD
}
