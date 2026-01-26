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
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query.trim());
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '15');
    url.searchParams.set('addressdetails', '1');
    // Request results in English to ensure consistent display for all users
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'AlkaTera-Sustainability-Platform/1.0 (https://alkatera.com)',
        'Accept': 'application/json',
        // Also set Accept-Language header as fallback
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      console.error('Nominatim API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to search locations' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log for debugging
    console.log(`[Geocode] Search for "${query}" returned ${data.length} results`);

    // Filter and transform results
    const results = data.map((result: any) => ({
      place_id: result.place_id,
      display_name: result.display_name,
      lat: result.lat,
      lon: result.lon,
      type: result.type,
      class: result.class,
      importance: result.importance,
      address: result.address,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching locations:', error);
    return NextResponse.json(
      { error: 'Failed to search locations. Please try again.' },
      { status: 500 }
    );
  }
}
