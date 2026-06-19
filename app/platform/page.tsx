import { Metadata } from 'next';
import { PlatformPageClient } from '@/marketing/components/PlatformPageClient';

export const metadata: Metadata = {
  title: 'Platform | alkatera',
  description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, achieve B Corp, and turn ESG data into competitive advantage.',
  alternates: {
    canonical: '/platform',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Platform | alkatera',
    description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, achieve B Corp, and turn ESG data into competitive advantage.',
  },
};

export default function PlatformPage() {
  return <PlatformPageClient />;
}
