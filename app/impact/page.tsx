import { Metadata } from 'next';
import { ImpactPageClient } from '@/marketing/components/ImpactPageClient';

export const metadata: Metadata = {
  title: 'Impact | Alkatera',
  description: 'Real-time sustainability metrics translated into living digital ecosystems. From compliance to regeneration.',
  alternates: {
    canonical: '/impact',
  },
};

export default function ImpactPage() {
  return <ImpactPageClient />;
}
