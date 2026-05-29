'use client';

import { useConsent, setConsent } from '@/lib/consent';

/**
 * Cookie-consent banner. Shows only when no choice has been made yet, and gates
 * optional analytics (GA + PostHog) behind explicit opt-in (PECR / UK GDPR).
 */
export function CookieConsent() {
  const consent = useConsent();

  // undefined = not yet mounted (avoid a hydration flash); null = no choice made.
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-neutral-950/95 px-4 py-4 text-sm text-neutral-200 shadow-2xl backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl">
          We use optional analytics cookies to understand how the platform is used and improve it.
          You can decline without affecting how alka<strong>tera</strong> works. See our{' '}
          <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent('rejected')}
            className="rounded-md border border-white/20 px-4 py-2 font-medium text-neutral-200 transition hover:bg-white/10"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent('accepted')}
            className="rounded-md bg-[#ccff00] px-4 py-2 font-semibold text-black transition hover:brightness-95"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
