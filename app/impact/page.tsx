import { Metadata } from 'next';
import { ImpactPageClient } from '@/marketing/components/ImpactPageClient';

export const metadata: Metadata = {
  title: 'Impact | alkatera',
  description: 'Measure beyond carbon. alkatera tracks six dimensions of environmental, social, and governance impact for the drinks industry, backed by recognised standards.',
  alternates: {
    canonical: '/impact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Impact | alkatera',
    description: 'Measure beyond carbon. alkatera tracks six dimensions of environmental, social, and governance impact for the drinks industry, backed by recognised standards.',
  },
};

export default function ImpactPage() {
  return <ImpactPageClient />;
}
