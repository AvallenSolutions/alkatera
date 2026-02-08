import { Metadata } from 'next';
import { HomePageClient } from '@/marketing/components/HomePageClient';

export const metadata: Metadata = {
  title: 'Alkatera | Sustainability, Distilled',
  description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, and turn ESG data into competitive advantage.',
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return <HomePageClient />;
}
