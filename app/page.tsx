import { Metadata } from 'next';
import { HomePageClient } from '@/marketing/components/HomePageClient';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return <HomePageClient />;
}
