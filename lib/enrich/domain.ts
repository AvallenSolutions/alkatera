/**
 * Phase 1 · doorstep enrichment: the pure email/domain helpers.
 *
 * The moment a work email is typed we want to guess the company's website and a
 * provisional name, so the arrival ritual's first screen can open pre-filled
 * ("Is this you?"). All of that turns on the email domain. These functions are
 * pure and network-free so they are trivially testable and safe to run on every
 * keystroke/blur. The actual fetching (website reachability, Companies House)
 * lives in the route and `companies-house.ts`.
 */

/** Consumer / free mailbox providers. A personal address tells us nothing about
 * a company, so enrichment skips silently for these (no wrong guesses). */
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'gmx.com', 'gmx.co.uk', 'mail.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'yandex.com', 'zoho.com', 'fastmail.com', 'hey.com',
])

/** Lowercased registrable domain from an email address, or null if it isn't a
 * plausible address. No validation beyond "has a single @ and a dotted domain". */
export function domainFromEmail(email: string): string | null {
  const at = email.trim().toLowerCase()
  const parts = at.split('@')
  if (parts.length !== 2) return null
  const domain = parts[1]
  if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null
  return domain
}

/** True when the domain is a consumer mailbox we should not enrich from. */
export function isConsumerDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase())
}

/** Candidate website URL for a company domain (https, no path). Null for
 * consumer domains. We never guess a site for a personal mailbox. */
export function candidateWebsite(domain: string): string | null {
  if (isConsumerDomain(domain)) return null
  return `https://${domain}`
}

/**
 * A provisional, human-looking company name derived from the domain, used only
 * as a placeholder until the scrape or Companies House returns the real one.
 * "avallenspirits.com" → "Avallenspirits"; "orchard-bay.co.uk" → "Orchard Bay".
 * Deliberately conservative: it just tidies the second-level label.
 */
export function provisionalNameFromDomain(domain: string): string | null {
  if (isConsumerDomain(domain)) return null
  const label = domain.toLowerCase().split('.')[0]
  if (!label) return null
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim() || null
}

/** What the doorstep hands the arrival ritual. Every field is a guess to be
 * confirmed, never a fact. */
export interface DomainGuess {
  domain: string
  website: string | null
  provisionalName: string | null
  isConsumer: boolean
}

/** One-call convenience wrapper over the helpers above. Returns null when the
 * input is not a usable email address. */
export function guessFromEmail(email: string): DomainGuess | null {
  const domain = domainFromEmail(email)
  if (!domain) return null
  const isConsumer = isConsumerDomain(domain)
  return {
    domain,
    website: isConsumer ? null : candidateWebsite(domain),
    provisionalName: isConsumer ? null : provisionalNameFromDomain(domain),
    isConsumer,
  }
}
