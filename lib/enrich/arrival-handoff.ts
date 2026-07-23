/**
 * Phase 1 · the doorstep → ritual handoff.
 *
 * The signup form (pre-auth) derives a `DomainGuess` from the work email the
 * moment it is typed, and stashes it here. The arrival ritual (post-auth, a
 * navigation later) reads it back so screen 1 can open already pre-filled
 * instead of asking for a URL the user effectively already gave us.
 *
 * sessionStorage, not a cookie or the DB: it is per-tab, throwaway, and holds
 * only a guess the user is about to confirm anyway. Every accessor is
 * SSR-safe and swallows storage errors (private mode, quota) so it can never
 * break signup or the ritual.
 */

import type { DomainGuess } from './domain'

const KEY = 'alkatera:arrival:domain-guess:v1'

export function stashDomainGuess(guess: DomainGuess): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(guess))
  } catch {
    // Private mode / quota — enrichment is best-effort, so just drop it.
  }
}

export function readDomainGuess(): DomainGuess | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.domain === 'string') return parsed as DomainGuess
    return null
  } catch {
    return null
  }
}

export function clearDomainGuess(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
