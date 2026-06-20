/**
 * Per-org hospitality function selection. A venue picks which functions it needs
 * (food, drinks, rooms) so the nav only shows the relevant sections.
 */

export interface HospitalitySettings {
  meals: boolean
  drinks: boolean
  rooms: boolean
  /** True once the org has made a choice. Until then the UI shows the chooser. */
  configured: boolean
}

export const DEFAULT_HOSPITALITY_SETTINGS: HospitalitySettings = {
  meals: true,
  drinks: true,
  rooms: true,
  configured: false,
}

export type HospitalitySection = 'dashboard' | 'venues' | 'meals' | 'drinks' | 'menus' | 'rooms' | 'sales'

/** Map a /hospitality/* href to its section (for nav filtering). */
export function hospitalitySectionFromHref(href: string): HospitalitySection | null {
  const m = href.match(/^\/hospitality\/([a-z]+)\/?$/)
  if (!m) return href.replace(/\/+$/, '') === '/hospitality' ? 'dashboard' : null
  const seg = m[1]
  if (['venues', 'meals', 'drinks', 'menus', 'rooms', 'sales'].includes(seg)) return seg as HospitalitySection
  return null
}

/**
 * Whether a hospitality section should be shown given the org's chosen functions.
 * When unconfigured (or settings unknown), everything is shown.
 */
export function isHospitalitySectionEnabled(
  section: HospitalitySection,
  s: HospitalitySettings | null | undefined,
): boolean {
  if (!s || !s.configured) return true
  switch (section) {
    case 'meals':
      return s.meals
    case 'drinks':
      return s.drinks
    case 'menus':
      return s.meals || s.drinks
    case 'rooms':
      return s.rooms
    // dashboard, venues, sales are always available
    default:
      return true
  }
}
