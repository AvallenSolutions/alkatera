'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

/**
 * Client flow for /r/[token]/claim. Two states:
 *  - signed out → a "claim {brand}" card that sends the prospect to /login
 *    (login + signup tabs) with a returnUrl back to this page.
 *  - signed in  → automatically POSTs the claim, which creates + seeds + trials
 *    a new org and makes it active, then full-reloads into /dashboard.
 *
 * Inline styles keep the page a self-contained branded artefact (matches the
 * report page), independent of the app shell.
 */

const LIME = '#ccff00';
const BG = '#0a0a0a';
const TEXT = '#fafafa';
const MUTED = '#9ca3af';

type Phase = 'checking' | 'needs-auth' | 'claiming' | 'error';

export interface ClaimFlowProps {
  token: string;
  brandName: string;
  category?: string | null;
  kgPerBottle?: number | null;
}

function Wordmark() {
  return (
    <span style={{ fontWeight: 400 }}>
      alka<strong style={{ fontWeight: 800 }}>tera</strong>
    </span>
  );
}

export default function ClaimFlow({ token, brandName, category, kgPerBottle }: ClaimFlowProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async () => {
    setPhase('claiming');
    setError(null);
    try {
      const res = await fetch('/api/outreach/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Could not claim (${res.status})`);
        setPhase('error');
        return;
      }
      // Refresh the session so the new active org lands in the JWT, then do a
      // full reload so org + subscription context rebuild cleanly.
      await getSupabaseBrowserClient().auth.refreshSession();
      window.location.href = (body as { redirect?: string }).redirect ?? '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setPhase('error');
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!active) return;
      if (data.session) {
        void claim();
      } else {
        setPhase('needs-auth');
      }
    })();
    return () => {
      active = false;
    };
  }, [claim]);

  const goToAuth = () => {
    const returnUrl = encodeURIComponent(`/r/${token}/claim`);
    window.location.href = `/login?returnUrl=${returnUrl}`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          border: '1px solid #262626',
          borderRadius: 16,
          padding: '32px 28px',
          background: '#141414',
        }}
      >
        <p style={{ margin: 0, color: LIME, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Claim your profile
        </p>
        <h1 style={{ margin: '10px 0 6px', fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>{brandName}</h1>
        <p style={{ margin: 0, color: MUTED, fontSize: 14 }}>
          {[category, kgPerBottle != null ? `${kgPerBottle} kg CO₂e per bottle (estimated)` : null]
            .filter(Boolean)
            .join(' · ') || 'Take ownership of your footprint estimate.'}
        </p>

        <div style={{ marginTop: 24 }}>
          {phase === 'checking' && <p style={{ color: MUTED, fontSize: 14 }}>Checking your session…</p>}

          {phase === 'claiming' && (
            <p style={{ color: TEXT, fontSize: 15 }}>Setting up your workspace…</p>
          )}

          {phase === 'needs-auth' && (
            <>
              <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
                Create your account (or sign in) to claim {brandName} and refine this estimate with
                your own data. It is free to start, with no card required.
              </p>
              <button
                onClick={goToAuth}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 16,
                  padding: '14px 20px',
                  background: LIME,
                  color: '#0a0a0a',
                  fontWeight: 800,
                  fontSize: 16,
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <p style={{ color: '#fca5a5', fontSize: 14 }}>{error}</p>
              <button
                onClick={() => void claim()}
                style={{
                  marginTop: 12,
                  padding: '10px 16px',
                  background: 'transparent',
                  color: LIME,
                  border: `1px solid ${LIME}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Try again
              </button>
            </>
          )}
        </div>

        <p style={{ marginTop: 28, color: MUTED, fontSize: 12 }}>
          Powered by <Wordmark />
        </p>
      </div>
    </div>
  );
}
