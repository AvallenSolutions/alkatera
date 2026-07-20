// Global detection of an expired / invalid auth session.
//
// When a user's session dies (refresh token expired or revoked) the browser
// keeps rendering the cached app shell, so the user can still *attempt*
// authenticated actions — uploading a document, saving a form. Every one of
// those hits an `/api/*` route whose first line is an auth gate that returns
// `401 Unauthorized`. Historically each of the ~dozens of `fetch` call sites
// just surfaced that as a generic "Upload failed" / "Unauthorized" toast, so a
// dead session looked like a broken feature (this is exactly what a real
// customer reported: "uploads fail" was actually "your session expired").
//
// Rather than edit every call site, we install ONE fetch interceptor that spots
// an auth-expiry 401 from our own API and hands off to a single handler
// (friendly toast + sign-out + redirect to login). The interceptor is
// deliberately NON-INVASIVE: it only reads `res.status` and never touches the
// response body, so it cannot corrupt any caller's parsing. Callers still get
// their original Response back and behave exactly as before.

let installed = false
let onExpire: (() => void) | null = null
// Whether we currently believe the user is signed in. A 401 only means
// "session expired" if we thought we had a session; on a genuinely
// logged-out/public page a 401 is expected and must NOT trigger a redirect.
let hasSession = false
// Ensures the handler fires once even when many requests 401 simultaneously.
let handling = false

export function setSessionPresence(present: boolean): void {
  hasSession = present
  // A fresh sign-in re-arms the guard so a later expiry can trigger again.
  if (present) handling = false
}

export function setExpiryHandler(handler: () => void): void {
  onExpire = handler
}

/** Test/escape hatch: re-arm the guard without a full sign-in cycle. */
export function rearmSessionExpiryGuard(): void {
  handling = false
}

function isAuthExpiry401(input: RequestInfo | URL, res: Response): boolean {
  if (res.status !== 401) return false

  let url: URL
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
    url = new URL(raw, window.location.origin)
  } catch {
    return false
  }

  // Only our own same-origin API. Cross-origin 401s (Supabase, third parties)
  // are not our session to manage.
  if (url.origin !== window.location.origin) return false
  if (!url.pathname.startsWith('/api/')) return false
  // Auth endpoints (password reset, etc.) own their 401 semantics; a 401 there
  // is not an "your session expired mid-use" signal.
  if (url.pathname.startsWith('/api/auth/')) return false

  return true
}

export function installSessionExpiryInterceptor(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: any, init?: any): Promise<Response> => {
    const res = await originalFetch(input, init)
    try {
      if (!handling && hasSession && onExpire && isAuthExpiry401(input, res)) {
        handling = true
        onExpire()
      }
    } catch {
      // Interceptor bookkeeping must never break the underlying request.
    }
    // Return the untouched response — the body was never read here.
    return res
  }
}
