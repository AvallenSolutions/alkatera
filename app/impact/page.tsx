import { Metadata } from 'next';
import { ImpactPageClient } from '@/marketing/components/ImpactPageClient';

export const metadata: Metadata = {
  title: 'Impact | Alkatera',
  description: 'Measure beyond carbon. Alkatera tracks six dimensions of environmental, social, and governance impact for the drinks industry — backed by recognised standards.',
  alternates: {
    canonical: '/impact',
  },
};

export default function ImpactPage() {
  return <ImpactPageClient />;
}
