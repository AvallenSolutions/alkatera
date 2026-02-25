/**
 * @deprecated This Nominatim/OpenStreetMap geocoding route is deprecated.
 * Use `/api/places/autocomplete` and `/api/places/details` (Google Places API) instead.
 * Kept only for legacy compatibility with business travel `location-autocomplete.tsx`.
 */
import { NextRequest, NextResponse } from 'next/server';

// Rate limiting - track requests per IP
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 500; // 500ms between requests (was 1000ms)
const MAX_REQUESTS_PER_WINDOW = 1;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip);

  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    return true;
  }

  rateLimitMap.set(ip, now);

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW * 10;
    // Use Array.from() to avoid TS downlevelIteration requirement
    Array.from(rateLimitMap.entries()).forEach(([key, time]) => {
      if (time < cutoff) {
        rateLimitMap.delete(key);
      }
    });
  }

  return false;
}

// ============================================================================
// Address Query Cleanup
// ============================================================================

// UK postcode regex: e.g. "N17 0RE", "SW1A 1AA", "EC2R 8AH"
const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

// Common street abbreviations → full forms (helps Nominatim match)
const STREET_ABBREVIATIONS: Record<string, string> = {
  'Rd': 'Road',
  'St': 'Street',
  'Ave': 'Avenue',
  'Ln': 'Lane',
  'Dr': 'Drive',
  'Ct': 'Court',
  'Pl': 'Place',
  'Cres': 'Crescent',
  'Blvd': 'Boulevard',
  'Sq': 'Square',
  'Cl': 'Close',
  'Grn': 'Green',
  'Gdns': 'Gardens',
  'Terr': 'Terrace',
  'Pk': 'Park',
};

/**
 * Clean up a complex address query by removing noise that confuses Nominatim.
 * E.g. "Unit 2, 3 & 4, Little Line House, 41-43 West Rd, London N17 0RE"
 *   → "43 West Road, London N17 0RE"
 */
function cleanAddressQuery(query: string): string {
  let cleaned = query;

  // 1. Remove unit/suite/flat/apartment prefixes and their values
  //    "Unit 2, 3 & 4," or "Flat 3B," or "Suite 100,"
  cleaned = cleaned.replace(/\b(?:Unit|Suite|Flat|Apartment|Apt|Room)\s+[\d\w,\s&]+,\s*/gi, '');

  // 2. Remove floor references: "Ground Floor," "1st Floor,"
  cleaned = cleaned.replace(/\b(?:\d+(?:st|nd|rd|th)\s+)?(?:Ground\s+)?Floor\s*,?\s*/gi, '');

  // 3. Remove building/house names before street numbers
  //    Pattern: word(s) that end before a number followed by a street name
  //    "Little Line House, 41-43 West Rd" → "41-43 West Rd"
  //    But be careful not to remove city names!
  //    Strategy: remove comma-separated segments that don't contain digits
  //    and appear before a segment that starts with a digit
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 2) {
    // Find first part that starts with a digit (likely the street number + street)
    const streetIdx = parts.findIndex(p => /^\d/.test(p));
    if (streetIdx > 0) {
      // Keep from the street part onwards
      cleaned = parts.slice(streetIdx).join(', ');
    }
  }

  // 4. Normalise range house numbers: "41-43" → "43" (use higher number)
  cleaned = cleaned.replace(/\b(\d+)\s*[-–]\s*(\d+)\b/, (_, low, high) => high);

  // 5. Expand street abbreviations (word boundary match, case-insensitive)
  for (const [abbr, full] of Object.entries(STREET_ABBREVIATIONS)) {
    // Match abbreviation at word boundary, optionally followed by period
    const regex = new RegExp(`\\b${abbr}\\.?\\b`, 'gi');
    cleaned = cleaned.replace(regex, full);
  }

  // 6. Clean up extra whitespace and trailing/leading commas
  cleaned = cleaned.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '').trim();

  return cleaned;
}

/**
 * Extract a UK postcode from a query string, if present.
 */
function extractUKPostcode(query: string): string | null {
  const match = query.match(UK_POSTCODE_REGEX);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract the street portion from a cleaned address.
 * E.g. "43 West Road, London N17 0RE" → "43 West Road"
 */
function extractStreet(query: string): string | null {
  const parts = query.split(',').map(p => p.trim());
  // First part that starts with a digit is likely the street
  const street = parts.find(p => /^\d/.test(p));
  return street || null;
}

/**
 * Extract the postcode district prefix (e.g. "N17" from "N17 0RE").
 */
function getPostcodeDistrict(postcode: string): string {
  // UK postcode district = everything before the space (or last 3 chars)
  const spaceIdx = postcode.indexOf(' ');
  return spaceIdx > 0 ? postcode.slice(0, spaceIdx) : postcode.slice(0, -3);
}

/**
 * Remove the postcode from a query string so it can be used as street-only search.
 */
function removePostcode(query: string): string {
  return query.replace(UK_POSTCODE_REGEX, '').replace(/,\s*$/, '').trim();
}

/**
 * Filter results to only those matching a given postcode district.
 * E.g. district "N17" will match postcodes "N17 0QT", "N17 0RE" etc.
 */
function filterByPostcodeDistrict(results: any[], district: string): any[] {
  const upperDistrict = district.toUpperCase();
  return results.filter((r: any) => {
    const resultPostcode = (r.address?.postcode || '').toUpperCase();
    return resultPostcode.startsWith(upperDistrict);
  });
}

/**
 * Sort results so those matching the postcode district appear first.
 */
function sortByPostcodeRelevance(results: any[], district: string): any[] {
  const upperDistrict = district.toUpperCase();
  return [...results].sort((a: any, b: any) => {
    const aMatch = (a.address?.postcode || '').toUpperCase().startsWith(upperDistrict) ? 0 : 1;
    const bMatch = (b.address?.postcode || '').toUpperCase().startsWith(upperDistrict) ? 0 : 1;
    return aMatch - bMatch;
  });
}

// ============================================================================
// Nominatim API helpers
// ============================================================================

const NOMINATIM_HEADERS = {
  'User-Agent': 'AlkaTera-Sustainability-Platform/1.0 (https://alkatera.com)',
  'Accept': 'application/json',
  'Accept-Language': 'en',
};

/**
 * Call Nominatim free-form search.
 */
async function searchNominatim(query: string): Promise<any[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '15');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });

  if (!response.ok) {
    console.error('Nominatim API error:', response.status, response.statusText);
    return [];
  }

  return response.json();
}

/**
 * Call Nominatim structured search (street + postalcode + country).
 * This constrains results geographically much better than free-form.
 */
async function searchNominatimStructured(
  street: string,
  postalcode: string,
  country: string = 'gb'
): Promise<any[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('street', street);
  url.searchParams.set('postalcode', postalcode);
  url.searchParams.set('country', country);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '15');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });

  if (!response.ok) {
    console.error('Nominatim structured search error:', response.status, response.statusText);
    return [];
  }

  return response.json();
}

/**
 * Transform raw Nominatim results into our response format.
 */
function transformResults(data: any[]): any[] {
  return data.map((result: any) => ({
    place_id: result.place_id,
    display_name: result.display_name,
    lat: result.lat,
    lon: result.lon,
    type: result.type,
    class: result.class,
    importance: result.importance,
    address: result.address,
  }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  // Get client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';

  // Check rate limit
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Rate limited. Please wait a moment before searching again.' },
      { status: 429 }
    );
  }

  try {
    const trimmed = query.trim();
    const postcode = extractUKPostcode(trimmed);
    const district = postcode ? getPostcodeDistrict(postcode) : null;

    // 1. Try the original query first
    let data = await searchNominatim(trimmed);

    // 2. If no results, try a cleaned-up version
    if (data.length === 0) {
      const cleaned = cleanAddressQuery(trimmed);
      if (cleaned !== trimmed && cleaned.length >= 3) {
        data = await searchNominatim(cleaned);
      }
    }

    // 3. If still no results and there's a UK postcode, use structured search
    if (data.length === 0 && postcode) {
      const cleaned = cleanAddressQuery(trimmed);
      const street = extractStreet(cleaned);

      // 3a. Structured search: street + postcode pinned to country
      if (street) {
        // Try with street name only (no house number) for broader match
        const streetName = street.replace(/^\d+\s*/, '');
        if (streetName.length > 2) {
          data = await searchNominatimStructured(streetName, postcode);
        }
      }

      // 3b. Last resort: just the postcode
      if (data.length === 0) {
        data = await searchNominatim(postcode);
      }
    }

    // 4. When postcode was in the query, filter out results from wrong areas
    if (district && data.length > 1) {
      const localResults = filterByPostcodeDistrict(data, district);
      if (localResults.length > 0) {
        // Only show results in the correct postcode district
        data = localResults;
      } else {
        // No exact district matches — sort so closest are first
        data = sortByPostcodeRelevance(data, district);
      }
    }

    const results = transformResults(data);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching locations:', error);
    return NextResponse.json(
      { error: 'Failed to search locations. Please try again.' },
      { status: 500 }
    );
  }
}
