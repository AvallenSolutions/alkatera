import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyResendWebhook,
  invitationStatusForEvent,
  shouldOverwriteStatus,
} from '../email/resend-webhook';

// A webhook secret in the shape Resend hands out: `whsec_` + base64 bytes.
const SECRET_BYTES = Buffer.from('a-test-signing-key-of-decent-length!!');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

const BODY = JSON.stringify({
  type: 'email.bounced',
  data: { email_id: 'abc-123', to: ['supplier@example.com'] },
});

const NOW = 1_780_000_000;

function sign(body: string, id: string, timestamp: number, key: Buffer = SECRET_BYTES): string {
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

function headers(overrides: Partial<{ id: string; timestamp: string; signature: string }> = {}) {
  const id = overrides.id ?? 'msg_1';
  const timestamp = overrides.timestamp ?? String(NOW);
  return {
    id,
    timestamp,
    signature: overrides.signature ?? `v1,${sign(BODY, id, Number(timestamp))}`,
  };
}

describe('verifyResendWebhook', () => {
  it('accepts a correctly signed payload', () => {
    expect(verifyResendWebhook(BODY, headers(), SECRET, NOW)).toEqual({ valid: true });
  });

  it('accepts the secret without its whsec_ prefix', () => {
    const bare = SECRET_BYTES.toString('base64');
    expect(verifyResendWebhook(BODY, headers(), bare, NOW)).toEqual({ valid: true });
  });

  it('rejects a tampered body', () => {
    const tampered = BODY.replace('supplier@example.com', 'attacker@example.com');
    const result = verifyResendWebhook(tampered, headers(), SECRET, NOW);
    expect(result.valid).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const wrongKey = Buffer.from('some-other-key-entirely-different!!!!');
    const id = 'msg_1';
    const result = verifyResendWebhook(
      BODY,
      headers({ signature: `v1,${sign(BODY, id, NOW, wrongKey)}` }),
      SECRET,
      NOW,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a replayed payload outside the tolerance window', () => {
    const old = NOW - 6 * 60;
    const result = verifyResendWebhook(
      BODY,
      headers({ timestamp: String(old), signature: `v1,${sign(BODY, 'msg_1', old)}` }),
      SECRET,
      NOW,
    );
    expect(result).toEqual({ valid: false, reason: 'Timestamp outside tolerance window' });
  });

  it('accepts when one of several signatures matches, as during a secret rotation', () => {
    const id = 'msg_1';
    const stale = sign(BODY, id, NOW, Buffer.from('previous-key-being-rotated-out!!!!!!'));
    const current = sign(BODY, id, NOW);
    const result = verifyResendWebhook(
      BODY,
      headers({ signature: `v1,${stale} v1,${current}` }),
      SECRET,
      NOW,
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects when headers are missing', () => {
    const result = verifyResendWebhook(
      BODY,
      { id: null, timestamp: null, signature: null },
      SECRET,
      NOW,
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a signature of an unknown version', () => {
    const result = verifyResendWebhook(
      BODY,
      headers({ signature: `v2,${sign(BODY, 'msg_1', NOW)}` }),
      SECRET,
      NOW,
    );
    expect(result).toEqual({ valid: false, reason: 'No v1 signature present' });
  });

  it('does not throw when the signature length differs from the expected one', () => {
    const result = verifyResendWebhook(BODY, headers({ signature: 'v1,short' }), SECRET, NOW);
    expect(result.valid).toBe(false);
  });
});

describe('invitationStatusForEvent', () => {
  it('maps delivery outcomes', () => {
    expect(invitationStatusForEvent('email.bounced')).toBe('bounced');
    expect(invitationStatusForEvent('email.delivered')).toBe('delivered');
    expect(invitationStatusForEvent('email.complained')).toBe('complained');
  });

  it('ignores engagement events so they cannot clobber a delivery state', () => {
    expect(invitationStatusForEvent('email.opened')).toBeNull();
    expect(invitationStatusForEvent('email.clicked')).toBeNull();
    expect(invitationStatusForEvent('contact.created')).toBeNull();
  });
});

describe('shouldOverwriteStatus', () => {
  it('fills in an unknown status', () => {
    expect(shouldOverwriteStatus(null, 'sent')).toBe(true);
  });

  it('promotes sent to delivered', () => {
    expect(shouldOverwriteStatus('sent', 'delivered')).toBe(true);
  });

  it('never downgrades a bounce when events arrive out of order', () => {
    expect(shouldOverwriteStatus('bounced', 'sent')).toBe(false);
    expect(shouldOverwriteStatus('bounced', 'delivered')).toBe(false);
  });

  it('lets a bounce overwrite an earlier delivered', () => {
    // SES can report a delivery and then an asynchronous bounce for the same
    // message; the bounce is the outcome that matters to the brand.
    expect(shouldOverwriteStatus('delivered', 'bounced')).toBe(true);
  });
});
