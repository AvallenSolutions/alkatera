import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyUnleashedWebhook, REPLAY_WINDOW_SECONDS } from '../webhooks'

function sign(timestamp: string, body: string, key: string): string {
  return createHmac('sha256', key).update(`${timestamp}.${body}`, 'utf-8').digest('base64')
}

describe('verifyUnleashedWebhook', () => {
  const key = 'wh-signing-key'
  const body = JSON.stringify({ EventType: 'Product.updated', ObjectId: 'abc' })
  const ts = '1700000000'

  it('accepts a valid signature within the replay window', () => {
    const sig = sign(ts, body, key)
    const result = verifyUnleashedWebhook({
      signatureHeader: sig,
      timestampHeader: ts,
      rawBody: body,
      signingKey: key,
      nowSeconds: Number(ts) + 10,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a tampered body', () => {
    const sig = sign(ts, body, key)
    const result = verifyUnleashedWebhook({
      signatureHeader: sig,
      timestampHeader: ts,
      rawBody: body + 'tampered',
      signingKey: key,
      nowSeconds: Number(ts) + 10,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('bad_signature')
  })

  it('rejects a wrong signing key', () => {
    const sig = sign(ts, body, 'other-key')
    const result = verifyUnleashedWebhook({
      signatureHeader: sig,
      timestampHeader: ts,
      rawBody: body,
      signingKey: key,
      nowSeconds: Number(ts) + 10,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('bad_signature')
  })

  it('rejects events outside the replay window', () => {
    const sig = sign(ts, body, key)
    const result = verifyUnleashedWebhook({
      signatureHeader: sig,
      timestampHeader: ts,
      rawBody: body,
      signingKey: key,
      nowSeconds: Number(ts) + REPLAY_WINDOW_SECONDS + 1,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('replay_window')
  })

  it('rejects missing headers', () => {
    const result = verifyUnleashedWebhook({
      signatureHeader: null,
      timestampHeader: ts,
      rawBody: body,
      signingKey: key,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_headers')
  })
})
