/**
 * Auth cookie name for the distributor + procurement portals.
 *
 * The portals run on the same domain as the main alka**tera** app (path-prefix
 * routing), so they would otherwise share the default `sb-<ref>-auth-token`
 * cookie and a single session — logging into a portal would replace the main
 * app session. Giving the portals their own cookie name lets the two sessions
 * coexist: a user can be signed into the main app and a portal at once.
 *
 * Distributor and procurement deliberately SHARE this one portal cookie (two
 * channels total: main vs portals), per product decision.
 */
export const PORTAL_AUTH_COOKIE = 'sb-alkatera-portal-auth'
