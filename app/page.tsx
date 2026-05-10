import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { HomePageClient } from '@/marketing/components/HomePageClient';

export const metadata: Metadata = {
  title: 'Alkatera | Sustainability, Distilled',
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
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect('/rosa/');
    }
  } catch {
    // If the auth check fails (no env, network blip), fall through to the
    // public marketing page rather than throwing.
  }

  return <HomePageClient />;
}
