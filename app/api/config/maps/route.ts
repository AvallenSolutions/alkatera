import { NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

// Force runtime evaluation so the API key is never baked into static build output.
// Without this, Next.js pre-renders the route at build time and Netlify's secrets
// scanner detects the AIza* pattern in the .body file and aborts the deploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
}
