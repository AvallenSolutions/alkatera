import { NextResponse } from 'next/server';

// Force runtime evaluation so the API key is never baked into static build output.
// Without this, Next.js pre-renders the route at build time and Netlify's secrets
// scanner detects the AIza* pattern in the .body file and aborts the deploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
}
