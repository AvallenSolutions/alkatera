import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

// EU/EEA country names (as returned by Google Places predictions' terms).
// Used to bucket worldwide results into the "EU" tier after UK matches.
const EU_COUNTRY_NAMES = new Set<string>([
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia',
  'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
  'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania',
  'Luxembourg', 'Malta', 'Netherlands', 'The Netherlands', 'Poland',
  'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
  // EFTA / closely-integrated neighbours
  'Iceland', 'Liechtenstein', 'Norway', 'Switzerland',
]);

type Prediction = {
  place_id?: string;
  description?: string;
  terms?: Array<{ value?: string }>;
  [key: string]: any;
};

function extractCountry(prediction: Prediction): string | null {
  const terms = prediction.terms;
  if (Array.isArray(terms) && terms.length > 0) {
    const last = terms[terms.length - 1]?.value;
    if (last) return last.trim();
  }
  const desc = prediction.description;
  if (desc && typeof desc === 'string') {
    const parts = desc.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return null;
}

function tierFor(country: string | null): 0 | 1 | 2 {
  if (!country) return 2;
  const c = country.toLowerCase();
  if (
    c === 'uk' ||
    c === 'u.k.' ||
    c === 'united kingdom' ||
    c === 'england' ||
    c === 'scotland' ||
    c === 'wales' ||
    c === 'northern ireland' ||
    c === 'great britain'
  ) {
    return 0;
  }
  if (EU_COUNTRY_NAMES.has(country.trim())) return 1;
  return 2;
}

async function fetchAutocomplete(
  input: string,
  apiKey: string,
  types: string | null,
  countryFilter: string | null,
): Promise<Prediction[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.append('input', input);
  url.searchParams.append('key', apiKey);
  if (types) url.searchParams.append('types', types);
  if (countryFilter) url.searchParams.append('components', countryFilter);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Google Places API error:', data);
    return [];
  }
  return Array.isArray(data.predictions) ? data.predictions : [];
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');

  if (!input) {
    return NextResponse.json(
      { error: 'Missing input parameter' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 500 }
    );
  }

  try {
    const types = searchParams.get('types');

    // Fire UK-biased and worldwide queries in parallel. UK-only results
    // populate the top of the list; worldwide results fill in the rest,
    // re-sorted so European hits appear before the rest of the world.
    const [ukResults, worldResults] = await Promise.all([
      fetchAutocomplete(input, apiKey, types, 'country:gb'),
      fetchAutocomplete(input, apiKey, types, null),
    ]);

    const seen = new Set<string>();
    const ordered: Prediction[] = [];

    const pushUnique = (p: Prediction) => {
      const key = p.place_id || p.description;
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(p);
    };

    // UK first (stable order from Google).
    ukResults.forEach(pushUnique);

    // Then worldwide, with EU ahead of ROW. `sort` is stable in modern JS,
    // so predictions within a tier keep Google's relevance ordering.
    const worldSorted = [...worldResults].sort((a, b) => {
      return tierFor(extractCountry(a)) - tierFor(extractCountry(b));
    });
    worldSorted.forEach(pushUnique);

    return NextResponse.json({
      status: ordered.length > 0 ? 'OK' : 'ZERO_RESULTS',
      predictions: ordered,
    });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
