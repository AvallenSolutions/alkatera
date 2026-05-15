'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

/**
 * Translate the technical error codes the integration callbacks emit into
 * a sentence the user can act on. Falls back to the raw `detail` string if
 * we don't recognise the code, so we never hide useful debugging info.
 */
function friendlyError(code: string | null, detail: string | null, provider: string): string {
  const fallback = detail || 'Connection did not complete'
  if (!code) return fallback
  switch (code) {
    case 'breww_token_unusable':
      return "We connected to Breww but your account didn't return any sites. Check that the Breww account you signed in with has an active workspace, then try again."
    case 'breww_token_exchange_failed':
      return "Breww accepted your sign-in but the token exchange failed. This usually clears up on retry; if not, the Breww OAuth app may need re-approval on Breww's side."
    case 'breww_access_denied':
      return "You're signed in to alkatera as a different user than the one who owns this organisation. Sign out and back in, then try again."
    case 'breww_state_mismatch':
    case 'breww_oauth_state':
      return 'The connect session expired or was tampered with. Close this window and start the connection again from the wizard.'
    case 'breww_invalid_callback':
      return 'Breww returned without the expected authorisation code. Try the connection again.'
    case 'breww_denied':
      return `You declined ${provider} access on the consent screen. Click the tile again to retry.`
    case 'breww_save_failed':
      return "We got a working Breww token but couldn't save the connection. Try again — if this keeps happening, check the dev server logs."
    default:
      return fallback
  }
}

/**
 * /onboarding/oauth-complete
 *
 * Bridge page rendered inside the OAuth popup window. Its only job is to
 * tell the parent wizard tab "Breww/Xero just connected" via postMessage,
 * then close itself. The parent stays mounted on the onboarding flow the
 * whole time — the user never sees the wizard unmount.
 *
 * Query params:
 *   provider:  'breww' | 'xero'   (which integration completed)
 *   connected: 'breww' | 'xero'   (set by the integration callbacks on success)
 *   error:     string             (set on failure)
 *   xero:      'connected' | 'error' | 'select-tenant'   (Xero-specific)
 *
 * We treat any of: ?connected=<provider>, ?xero=connected as success.
 */
export default function OAuthCompletePage() {
  const params = useSearchParams()

  useEffect(() => {
    const provider = params.get('provider') || 'unknown'
    const connectedParam = params.get('connected')
    const xeroParam = params.get('xero')
    const errorParam = params.get('error') || params.get('message')
    const detailParam = params.get('detail')

    const success =
      connectedParam === provider ||
      (provider === 'xero' && xeroParam === 'connected')

    const message = {
      type: 'alkatera-oauth' as const,
      provider,
      status: success ? ('connected' as const) : ('error' as const),
      error: success ? null : friendlyError(errorParam, detailParam, provider),
    }

    // Notify the parent wizard. Use the parent's origin if reachable so we
    // never leak the message cross-origin. Falls back to '*' when opener
    // isn't accessible (e.g. opener navigated away) — the message just
    // becomes a no-op in that case.
    try {
      const targetOrigin = window.opener?.location?.origin || window.location.origin
      window.opener?.postMessage(message, targetOrigin)
    } catch {
      window.opener?.postMessage(message, '*')
    }

    // Give the parent a tick to receive + process the message before closing.
    const closeTimer = setTimeout(() => {
      try { window.close() } catch { /* popup blocker, etc. */ }
    }, 600)
    return () => clearTimeout(closeTimer)
  }, [params])

  const provider = params.get('provider') || 'integration'
  const connectedParam = params.get('connected')
  const xeroParam = params.get('xero')
  const success =
    connectedParam === provider ||
    (provider === 'xero' && xeroParam === 'connected')
  const errorParam = params.get('error') || params.get('message')
  const detailParam = params.get('detail')
  const errorMessage = errorParam ? friendlyError(errorParam, detailParam, provider) : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white">
        {success ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-lg font-medium capitalize">{provider} connected</h1>
            <p className="mt-2 text-sm text-white/60">
              You can close this window. Returning you to onboarding…
            </p>
          </>
        ) : errorMessage ? (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-lg font-medium capitalize">{provider} connection failed</h1>
            <p className="mt-2 text-sm text-white/60 break-words">{errorMessage}</p>
            <p className="mt-4 text-xs text-white/40">You can close this window and try again.</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-12 w-12 text-white/40 animate-spin" />
            <p className="mt-4 text-sm text-white/60">Finishing up…</p>
          </>
        )}
      </div>
    </div>
  )
}
