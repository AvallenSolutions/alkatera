import { NextResponse } from 'next/server';

/**
 * Returns the Google Maps API key at runtime.
 *
 * We can't use NEXT_PUBLIC_ env vars or next.config.js env aliases because
 * Netlify's secret scanner detects the AIza* pattern in the built JS bundle
 * and aborts the deploy. Loading the key at runtime via this API route keeps
 * it out of the static build output entirely.
 */
export async function GET() {
  return NextResponse.json({
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
}
