import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { HomeClient } from '@/marketing/home/HomeClient';
import '@/marketing/shared/marketing.css';

export const metadata: Metadata = {
  title: 'alkatera · Sustainability, Distilled',
  description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, and turn ESG data into competitive advantage.',
  alternates: {
    canonical: '/',
  },
};

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Authenticated users go straight to Rosa; unauthenticated visitors see
  // the marketing site. The check is server-side so first paint already
  // reflects the user's status.
  let user = null;
  try {
    const supabase = getSupabaseServerClient();
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    // If the auth check fails (no env, network blip), fall through to the
    // public marketing page rather than throwing.
  }

  // redirect() throws NEXT_REDIRECT, so it must live OUTSIDE the try/catch above
  // or the bare catch swallows it and authenticated users never reach Rosa.
  if (user) {
    redirect('/rosa/');
  }

  return <HomeClient />;
}
