/**
 * Geocoding Service using Nominatim (OpenStreetMap)
 *
 * Features:
 * - Worldwide location search
 * - Automatic distance calculation using Haversine formula
 * - Intelligent caching (localStorage + memory)
 * - Rate limiting (1 req/sec for Nominatim policy)
 * - Popular destinations pre-cached
 */

export interface Location {
  place_id: string;
  displayName: string;
  lat: number;
  lon: number;
  type: 'city' | 'airport' | 'region' | 'country';
  country: string;
  importance: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  importance: number;
  addresstype?: string;
}

interface CacheEntry {
  results: Location[];
  timestamp: number;
  expiresIn: number;
}

// Cache configuration
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_KEY = 'geocoding_cache';
const RECENT_SEARCHES_KEY = 'recent_location_searches';
const MAX_RECENT = 10;

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// Memory cache for current session
const memoryCache = new Map<string, Location[]>();

/**
 * Popular business destinations (pre-cached)
 */
export const popularDestinations: Location[] = [
  {
    place_id: 'pop_london',
    displayName: 'London, England, United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    type: 'city',
    country: 'United Kingdom',
    importance: 1.0,
  },
  {
    place_id: 'pop_heathrow',
    displayName: 'Heathrow Airport (LHR), London, United Kingdom',
    lat: 51.4700,
    lon: -0.4543,
    type: 'airport',
    country: 'United Kingdom',
    importance: 0.95,
  },
  {
    place_id: 'pop_edinburgh',
    displayName: 'Edinburgh, Scotland, United Kingdom',
    lat: 55.9533,
    lon: -3.1883,
    type: 'city',
    country: 'United Kingdom',
    importance: 0.9,
  },
  {
    place_id: 'pop_manchester',
    displayName: 'Manchester, England, United Kingdom',
    lat: 53.4808,
    lon: -2.2426,
    type: 'city',
    country: 'United Kingdom',
    importance: 0.85,
  },
  {
    place_id: 'pop_paris',
    displayName: 'Paris, France',
    lat: 48.8566,
    lon: 2.3522,
    type: 'city',
    country: 'France',
    importance: 0.95,
  },
  {
    place_id: 'pop_amsterdam',
    displayName: 'Amsterdam, Netherlands',
    lat: 52.3676,
    lon: 4.9041,
    type: 'city',
    country: 'Netherlands',
    importance: 0.9,
  },
  {
    place_id: 'pop_newyork',
    displayName: 'New York City, United States',
    lat: 40.7128,
    lon: -74.0060,
    type: 'city',
    country: 'United States',
    importance: 0.95,
  },
  {
    place_id: 'pop_dubai',
    displayName: 'Dubai, United Arab Emirates',
    lat: 25.2048,
    lon: 55.2708,
    type: 'city',
    country: 'United Arab Emirates',
    importance: 0.9,
  },
  {
    place_id: 'pop_singapore',
    displayName: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    type: 'city',
    country: 'Singapore',
    importance: 0.95,
  },
  {
    place_id: 'pop_tokyo',
    displayName: 'Tokyo, Japan',
    lat: 35.6762,
    lon: 139.6503,
    type: 'city',
    country: 'Japan',
    importance: 0.95,
  },
  {
    place_id: 'pop_sydney',
    displayName: 'Sydney, New South Wales, Australia',
    lat: -33.8688,
    lon: 151.2093,
    type: 'city',
    country: 'Australia',
    importance: 0.95,
  },
  {
    place_id: 'pop_sydney_airport',
    displayName: 'Sydney Kingsford Smith Airport (SYD), Sydney, Australia',
    lat: -33.9461,
    lon: 151.1772,
    type: 'airport',
    country: 'Australia',
    importance: 0.93,
  },
  {
    place_id: 'pop_melbourne',
    displayName: 'Melbourne, Victoria, Australia',
    lat: -37.8136,
    lon: 144.9631,
    type: 'city',
    country: 'Australia',
    importance: 0.9,
  },
  {
    place_id: 'pop_hongkong',
    displayName: 'Hong Kong',
    lat: 22.3193,
    lon: 114.1694,
    type: 'city',
    country: 'Hong Kong',
    importance: 0.92,
  },
  {
    place_id: 'pop_frankfurt',
    displayName: 'Frankfurt, Germany',
    lat: 50.1109,
    lon: 8.6821,
    type: 'city',
    country: 'Germany',
    importance: 0.88,
  },
];

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometres
 */
export function calculateDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const R = 6371; // Earth's radius in kilometres

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get cached results from localStorage
 */
function getCachedResults(query: string): Location[] | null {
  if (typeof window === 'undefined') return null;

  // Check memory cache first
  if (memoryCache.has(query)) {
    return memoryCache.get(query)!;
  }

  try {
    const cacheStr = localStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr) as Record<string, CacheEntry>;
    const entry = cache[query.toLowerCase()];

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      delete cache[query.toLowerCase()];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    // Update memory cache
    memoryCache.set(query, entry.results);
    return entry.results;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

/**
 * Save results to localStorage cache
 */
function setCachedResults(query: string, results: Location[]): void {
  if (typeof window === 'undefined') return;

  // Update memory cache
  memoryCache.set(query, results);

  try {
    const cacheStr = localStorage.getItem(CACHE_KEY) || '{}';
    const cache = JSON.parse(cacheStr) as Record<string, CacheEntry>;

    cache[query.toLowerCase()] = {
      results,
      timestamp: Date.now(),
      expiresIn: CACHE_DURATION,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

/**
 * Rate limit requests to respect Nominatim usage policy (1 req/sec)
 */
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

/**
 * Search for locations using Nominatim API
 */
export async function searchLocations(query: string): Promise<Location[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const trimmedQuery = query.trim();

  // Check cache first
  const cached = getCachedResults(trimmedQuery);
  if (cached) {
    return cached;
  }

  // Check if query matches popular destinations
  const popularMatches = popularDestinations.filter(dest =>
    dest.displayName.toLowerCase().includes(trimmedQuery.toLowerCase())
  );
  if (popularMatches.length > 0 && trimmedQuery.length < 4) {
    return popularMatches;
  }

  try {
    // Search Nominatim with larger limit to filter later
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', trimmedQuery);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '50'); // Increased to filter intelligently
    url.searchParams.set('addressdetails', '1');

    const response = await rateLimitedFetch(url.toString());

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = (await response.json()) as NominatimResult[];

    // Transform results
    let locations: Location[] = data.map(result => ({
      place_id: result.place_id.toString(),
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      type: classifyLocationType(result),
      country: extractCountry(result.display_name),
      importance: result.importance,
    }));

    // Filter and prioritize major cities and airports
    locations = filterAndRankLocations(locations, trimmedQuery);

    // Limit to top 10 results
    locations = locations.slice(0, 10);

    // Cache results
    setCachedResults(trimmedQuery, locations);

    return locations;
  } catch (error) {
    console.error('Error searching locations:', error);
    throw error;
  }
}

/**
 * Filter out irrelevant results and rank by relevance for business travel
 */
function filterAndRankLocations(locations: Location[], query: string): Location[] {
  const queryLower = query.toLowerCase();

  // Calculate relevance score for each location
  const scoredLocations = locations.map(loc => {
    let score = loc.importance * 100; // Base score from importance

    // Boost airports significantly
    if (loc.type === 'airport') {
      score += 200;

      // Extra boost for major international airports
      if (
        loc.displayName.toLowerCase().includes('international') ||
        /\b[A-Z]{3}\b/.test(loc.displayName) // Has airport code
      ) {
        score += 100;
      }
    }

    // Boost major cities
    if (loc.type === 'city') {
      score += 100;

      // Extra boost if it's a capital or major metropolitan area
      const majorCityKeywords = ['capital', 'metropolitan', 'city', 'municipality'];
      if (majorCityKeywords.some(keyword => loc.displayName.toLowerCase().includes(keyword))) {
        score += 50;
      }
    }

    // Penalize non-city/airport results heavily
    if (loc.type !== 'city' && loc.type !== 'airport') {
      score -= 500;
    }

    // Boost exact matches at word boundaries
    const displayLower = loc.displayName.toLowerCase();
    const firstWord = displayLower.split(',')[0].trim();
    if (firstWord === queryLower || firstWord.startsWith(queryLower + ' ')) {
      score += 300;
    }

    // Boost if query matches the start of the display name
    if (displayLower.startsWith(queryLower)) {
      score += 150;
    }

    // Penalize results with too many commas (overly specific addresses)
    const commaCount = (loc.displayName.match(/,/g) || []).length;
    if (commaCount > 5) {
      score -= 100;
    }

    // Penalize results that are suburbs or districts unless query is specific
    const suburbanKeywords = ['suburb', 'district', 'neighbourhood', 'quarter', 'ward'];
    if (suburbanKeywords.some(keyword => displayLower.includes(keyword))) {
      score -= 200;
    }

    // Boost if this looks like a major hub (has high importance and is city/airport)
    if ((loc.type === 'city' || loc.type === 'airport') && loc.importance > 0.5) {
      score += 100;
    }

    return { ...loc, score };
  });

  // Filter out very low scores (likely irrelevant)
  const filtered = scoredLocations.filter(loc => loc.score > -100);

  // Sort by score descending
  filtered.sort((a, b) => b.score - a.score);

  // Remove the score property before returning
  return filtered.map(({ score, ...loc }) => loc);
}

/**
 * Classify location type based on Nominatim result
 */
function classifyLocationType(result: NominatimResult): Location['type'] {
  const type = result.type?.toLowerCase() || '';
  const addresstype = result.addresstype?.toLowerCase() || '';
  const displayName = result.display_name.toLowerCase();

  if (
    type === 'aerodrome' ||
    type === 'airport' ||
    displayName.includes('airport') ||
    displayName.includes('lhr') ||
    displayName.includes('jfk')
  ) {
    return 'airport';
  }

  if (
    type === 'city' ||
    addresstype === 'city' ||
    result.class === 'place'
  ) {
    return 'city';
  }

  if (type === 'country' || addresstype === 'country') {
    return 'country';
  }

  return 'region';
}

/**
 * Extract country from display name
 */
function extractCountry(displayName: string): string {
  const parts = displayName.split(',');
  return parts[parts.length - 1]?.trim() || 'Unknown';
}

/**
 * Get recent search history
 */
export function getRecentSearches(): Location[] {
  if (typeof window === 'undefined') return [];

  try {
    const recentStr = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!recentStr) return [];

    return JSON.parse(recentStr) as Location[];
  } catch (error) {
    console.error('Error reading recent searches:', error);
    return [];
  }
}

/**
 * Add location to recent searches
 */
export function addToRecentSearches(location: Location): void {
  if (typeof window === 'undefined') return;

  try {
    let recent = getRecentSearches();

    // Remove duplicates
    recent = recent.filter(loc => loc.place_id !== location.place_id);

    // Add to front
    recent.unshift(location);

    // Limit to MAX_RECENT
    recent = recent.slice(0, MAX_RECENT);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch (error) {
    console.error('Error saving recent search:', error);
  }
}

/**
 * Format location for display with icon
 */
export function getLocationIcon(location: Location): string {
  switch (location.type) {
    case 'airport':
      return '✈️';
    case 'city':
      return '📍';
    case 'country':
      return '🌍';
    case 'region':
      return '📌';
    default:
      return '📍';
  }
}

/**
 * Extract city name from display name
 */
export function extractCityName(displayName: string): string {
  const parts = displayName.split(',');
  return parts[0]?.trim() || displayName;
}

/**
 * Extract airport code if present (e.g., "LHR", "JFK")
 */
export function extractAirportCode(displayName: string): string | null {
  const match = displayName.match(/\(([A-Z]{3})\)/);
  return match ? match[1] : null;
}
