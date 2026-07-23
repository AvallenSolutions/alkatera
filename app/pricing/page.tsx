import { Metadata } from 'next';
import { PricingClient } from '@/marketing/pricing/PricingClient';
import '@/marketing/shared/marketing.css';

export const metadata: Metadata = {
  title: 'Pricing · alkatera',
  description: 'Three plans, Seed, Blossom and Canopy, from £99 a month at founding partner rates. 30-day free trial, no card, no auto-charge. Purpose-built sustainability for the drinks industry.',
  alternates: {
    canonical: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing · alkatera',
    description: 'Three plans, Seed, Blossom and Canopy, from £99 a month at founding partner rates. 30-day free trial, no card, no auto-charge.',
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
