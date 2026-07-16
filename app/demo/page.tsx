import { Metadata } from 'next';
import { DemoPageClient } from '@/marketing/components/DemoPageClient';

export const metadata: Metadata = {
  title: 'Book a Demo | alkatera',
  description:
    'Book a 30-minute demo with alkatera. See how the single sustainability platform built for the drinks industry measures beyond carbon, defends against greenwashing, and turns ESG data into advantage.',
  alternates: {
    canonical: '/demo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book a Demo | alkatera',
    description:
      'Book a 30-minute demo with alkatera, the sustainability platform built for the drinks industry.',
  },
};

export default function DemoPage() {
  return <DemoPageClient />;
}
