import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { signUnleashedQuery } from '../client'

// Reference: https://apidocs.unleashedsoftware.com/Authentication
// The signature is base64(HMAC-SHA256(queryString, apiKey)).
// The query string is everything after `?` in the request URL, with no
// leading `?` and no URL fragment. For an unparameterised endpoint, the
// signed value is the empty string.

describe('signUnleashedQuery', () => {
  it('matches a hand-computed HMAC for a non-empty query string', () => {
    const apiKey = 'super-secret-key'
    const qs = 'pageSize=200&startDate=2025-01-01'
    const expected = createHmac('sha256', apiKey).update(qs, 'utf-8').digest('base64')
    expect(signUnleashedQuery(qs, apiKey)).toBe(expected)
  })

  it('signs the empty string for endpoints with no query parameters', () => {
    const apiKey = 'super-secret-key'
    const expected = createHmac('sha256', apiKey).update('', 'utf-8').digest('base64')
    expect(signUnleashedQuery('', apiKey)).toBe(expected)
  })

  it('produces deterministic output for the same inputs', () => {
    const a = signUnleashedQuery('pageSize=200', 'k')
    const b = signUnleashedQuery('pageSize=200', 'k')
    expect(a).toBe(b)
  })

  it('changes when the API key changes', () => {
    const a = signUnleashedQuery('pageSize=200', 'key-a')
    const b = signUnleashedQuery('pageSize=200', 'key-b')
    expect(a).not.toBe(b)
  })

  it('changes when the query string changes', () => {
    const a = signUnleashedQuery('pageSize=200', 'k')
    const b = signUnleashedQuery('pageSize=100', 'k')
    expect(a).not.toBe(b)
  })

  it('returns valid base64', () => {
    const sig = signUnleashedQuery('pageSize=200', 'k')
    expect(/^[A-Za-z0-9+/]+=*$/.test(sig)).toBe(true)
    // SHA-256 → 32 bytes → base64 length 44 (with single '=' padding).
    expect(sig.length).toBe(44)
  })
})
