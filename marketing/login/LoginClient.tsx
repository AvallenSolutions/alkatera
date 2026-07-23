'use client';

/**
 * The login page: "Welcome back.", ported faithfully from the Claude
 * Design source (Login.dc.html in project fc7cf965) and wired to the
 * real Supabase sign-in the old AuthForm used. The design's mocked
 * success state becomes the moment the studio actually opens: the
 * green card shows while the router carries the user in.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { MarketingButton } from '../shared/MarketingButton';
import { spaceGrotesk } from '../shared/fonts';
import { F_BODY, F_MONO, F_STATEMENT, LeafMark, Wordmark } from '../shared/chrome';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LABEL: React.CSSProperties = {
  fontFamily: F_MONO,
  fontWeight: 700,
  fontSize: 9.5,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#6F6F68',
};

const INPUT: React.CSSProperties = {
  fontFamily: F_BODY,
  fontSize: 14,
  color: '#1A1B1D',
  background: '#ECEAE3',
  border: '1px solid #D9D6CB',
  borderRadius: 999,
  padding: '12px 18px',
  width: '100%',
  boxSizing: 'border-box',
};

export function LoginClient({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // The date line and greeting are the visitor's clock, set after mount
  // so the server render never disagrees with it.
  useEffect(() => setNow(new Date()), []);

  const dayLine = now
    ? `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`.toUpperCase()
    : '';
  const hours = now ? now.getHours() : 12;
  const greeting = hours < 12 ? 'Good morning.' : hours < 18 ? 'Good afternoon.' : 'Good evening.';

  const submit = useCallback(async () => {
    if (loading || done) return;
    setError(null);

    if (!/.+@.+\..+/.test(email.trim())) {
      setError('That address does not look right.');
      return;
    }
    if (!password) {
      setError('A password is required.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === 'Failed to fetch'
            ? 'Cannot reach the sign-in service. Check your connection.'
            : 'Those details do not match. Try again?',
        );
        return;
      }

      if (data.user && data.session) {
        setDone(true);
        router.push(redirectTo || '/dashboard');
      } else {
        setError('Sign-in failed. Check your details and try again.');
      }
    } catch {
      setError('Sign-in failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, done, redirectTo, router]);

  return (
    <div
      className={`mkt-home ${spaceGrotesk.variable}`}
      style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex',
        flexDirection: 'column', boxSizing: 'border-box', background: '#ECEAE3', color: '#1A1B1D',
      }}
    >
      <div style={{ position: 'absolute', right: -140, bottom: -140, width: 560, height: 560, opacity: 0.08, pointerEvents: 'none' }}>
        <LeafMark size={560} stroke="#1A1B1D" />
      </div>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', boxSizing: 'border-box' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <LeafMark size={22} stroke="#205E40" />
          <Wordmark fontSize={18} />
        </a>
        <a
          className="mkt-navlink"
          href="/"
          style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}
        >
          ← Back to the site
        </a>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 80px', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!done && (
            <>
              <div style={{ background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6, padding: '40px 36px 36px', boxSizing: 'border-box' }}>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#205E40', margin: '0 0 20px' }}>
                  alkatera·OS <span style={{ color: '#B3AC9C' }}>·</span>{' '}
                  <span style={{ color: '#6F6F68' }} suppressHydrationWarning>{dayLine}</span>
                </p>
                <h1 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 40, lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 10px' }}>
                  Welcome back.
                </h1>
                <p style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: '#6F6F68', margin: '0 0 30px' }}>
                  Sign in to open the studio.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <label htmlFor="login-email" style={LABEL}>Email</label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@yourbrand.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      style={INPUT}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label htmlFor="login-password" style={LABEL}>Password</label>
                      <a
                        href="/password-reset"
                        className="mkt-scanlink"
                        style={{
                          fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.16em',
                          textTransform: 'uppercase', color: '#6F6F68', textDecoration: 'none',
                          borderBottom: '1px solid transparent',
                        }}
                      >
                        Forgotten?
                      </a>
                    </div>
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      style={INPUT}
                    />
                  </div>

                  {error && (
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#BE123C', margin: 0 }}>
                      {error}
                    </p>
                  )}

                  <div style={{ marginTop: 6 }}>
                    <MarketingButton size="lg" onClick={() => void submit()} style={{ width: '100%', opacity: loading ? 0.6 : 1 }}>
                      {loading ? 'Signing in…' : 'Sign in'}
                    </MarketingButton>
                  </div>
                </form>
              </div>

              <p style={{ fontFamily: F_BODY, fontSize: 13, color: '#6F6F68', textAlign: 'center', margin: '22px 0 0' }}>
                No account yet?{' '}
                <a href="/pricing" style={{ color: '#205E40', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid #205E40' }}>
                  Start your free trial
                </a>
              </p>
            </>
          )}

          {done && (
            <div style={{ background: '#205E40', color: '#F2F1EA', borderRadius: 6, padding: '44px 36px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -60, bottom: -60, width: 220, height: 220, opacity: 0.2 }}>
                <LeafMark size={220} stroke="#F2F1EA" />
              </div>
              <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(242,241,234,0.65)', margin: '0 0 18px' }}>
                alkatera·OS
              </p>
              <h1 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 38, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 10px' }} suppressHydrationWarning>
                {greeting}
              </h1>
              <p style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, color: 'rgba(242,241,234,0.82)', margin: '0 0 6px' }}>
                The studio is opening.
              </p>
              <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(242,241,234,0.65)', margin: 0 }}>
                Signed in · {email.trim().toLowerCase()}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer style={{ padding: '0 28px 22px', boxSizing: 'border-box' }}>
        <p style={{ fontFamily: F_MONO, fontSize: 9.5, letterSpacing: '0.08em', color: '#6F6F68', margin: 0 }}>
          © 2026 ALKATERA LTD · AVALLEN SOLUTIONS LTD T/A ALKATERA
        </p>
      </footer>
    </div>
  );
}
