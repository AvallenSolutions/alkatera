/**
 * Phase 1 · doorstep enrichment: the Companies House client.
 *
 * For UK companies the free Companies House API gives us the registered legal
 * entity for nothing: legal name, company number, incorporation year and the
 * registered office address. In the arrival ritual these become "From Companies
 * House." provenance chips the user only has to confirm, and the registered
 * address pre-fills the facility step.
 *
 * Shape: pure mappers (`mapSearchItem`, `mapCompanyProfile`) are separated from
 * the two network calls so they can be unit-tested without a key or a network.
 * The fetchers no-op (return null / []) when `COMPANIES_HOUSE_API_KEY` is unset,
 * exactly like the geo and inngest modules degrade gracefully off-config.
 *
 * Auth: HTTP Basic with the API key as the username and an empty password.
 * Docs: https://developer.company-information.service.gov.uk/
 */

const CH_BASE = 'https://api.company-information.service.gov.uk'

export interface CompaniesHouseMatch {
  companyNumber: string
  name: string
  /** Four-digit incorporation year, if present. */
  incorporationYear: number | null
  status: string | null
  addressSnippet: string | null
}

export interface CompaniesHouseProfile {
  companyNumber: string
  name: string
  incorporationYear: number | null
  status: string | null
  registeredAddress: {
    line1: string | null
    city: string | null
    postalCode: string | null
    country: string | null
  }
}

function getApiKey(): string | null {
  return process.env.COMPANIES_HOUSE_API_KEY || null
}

function authHeader(key: string): string {
  // Basic auth, key as username, blank password.
  const token = Buffer.from(`${key}:`).toString('base64')
  return `Basic ${token}`
}

/** Year from a Companies House "date_of_creation" ("2018-05-14" → 2018). */
export function yearFromDate(date: unknown): number | null {
  if (typeof date !== 'string') return null
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(date)
  if (!m) return null
  const y = Number(m[1])
  return Number.isFinite(y) ? y : null
}

/** Map one raw search result item to a match. Returns null for an item that
 * lacks the fields we need (a number and a title). */
export function mapSearchItem(item: any): CompaniesHouseMatch | null {
  if (!item || typeof item !== 'object') return null
  const companyNumber = typeof item.company_number === 'string' ? item.company_number : null
  const name = typeof item.title === 'string' ? item.title : null
  if (!companyNumber || !name) return null
  return {
    companyNumber,
    name,
    incorporationYear: yearFromDate(item.date_of_creation),
    status: typeof item.company_status === 'string' ? item.company_status : null,
    addressSnippet: typeof item.address_snippet === 'string' ? item.address_snippet : null,
  }
}

/** Map a raw company profile payload to our typed profile. Null when the
 * essential identity (number + name) is missing. */
export function mapCompanyProfile(raw: any): CompaniesHouseProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const companyNumber = typeof raw.company_number === 'string' ? raw.company_number : null
  const name = typeof raw.company_name === 'string' ? raw.company_name : null
  if (!companyNumber || !name) return null
  const addr = raw.registered_office_address && typeof raw.registered_office_address === 'object'
    ? raw.registered_office_address
    : {}
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    companyNumber,
    name,
    incorporationYear: yearFromDate(raw.date_of_creation),
    status: str(raw.company_status),
    registeredAddress: {
      line1: str(addr.address_line_1),
      city: str(addr.locality),
      postalCode: str(addr.postal_code),
      country: str(addr.country),
    },
  }
}

/** Prefer an active company when several match a name; otherwise the first. */
export function pickBestMatch(matches: CompaniesHouseMatch[]): CompaniesHouseMatch | null {
  if (matches.length === 0) return null
  return matches.find((m) => m.status === 'active') ?? matches[0]
}

/** Search Companies House by (company) name. Returns [] with no key or on any
 * error — enrichment is best-effort and must never break signup. */
export async function searchCompaniesByName(
  query: string,
  opts: { signal?: AbortSignal; limit?: number } = {},
): Promise<CompaniesHouseMatch[]> {
  const key = getApiKey()
  if (!key || !query.trim()) return []
  try {
    const url = new URL(`${CH_BASE}/search/companies`)
    url.searchParams.set('q', query.trim())
    url.searchParams.set('items_per_page', String(opts.limit ?? 5))
    const res = await fetch(url, {
      headers: { Authorization: authHeader(key) },
      signal: opts.signal,
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    const items = Array.isArray(json?.items) ? json.items : []
    return items.map(mapSearchItem).filter((m: CompaniesHouseMatch | null): m is CompaniesHouseMatch => m !== null)
  } catch {
    return []
  }
}

/** Fetch a full company profile by number. Null with no key or on any error. */
export async function getCompanyProfile(
  companyNumber: string,
  opts: { signal?: AbortSignal } = {},
): Promise<CompaniesHouseProfile | null> {
  const key = getApiKey()
  if (!key || !companyNumber.trim()) return null
  try {
    const res = await fetch(`${CH_BASE}/company/${encodeURIComponent(companyNumber.trim())}`, {
      headers: { Authorization: authHeader(key) },
      signal: opts.signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return mapCompanyProfile(await res.json())
  } catch {
    return null
  }
}

/**
 * Best-effort: from a company name, find the most likely registered entity and
 * return its full profile in one call. Null when nothing usable is found (or no
 * key). This is what the arrival ritual calls alongside the website scrape.
 */
export async function lookupRegisteredEntity(
  companyName: string,
  opts: { signal?: AbortSignal } = {},
): Promise<CompaniesHouseProfile | null> {
  const matches = await searchCompaniesByName(companyName, { signal: opts.signal })
  const best = pickBestMatch(matches)
  if (!best) return null
  return getCompanyProfile(best.companyNumber, { signal: opts.signal })
}
