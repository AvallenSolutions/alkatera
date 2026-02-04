import { Metadata } from 'next';
import { PlatformPageClient } from '@/marketing/components/PlatformPageClient';

export const metadata: Metadata = {
  title: 'Platform | Alkatera',
  description: 'The ecological intelligence engine for drinks brands. Analyse, calculate, and strategise your environmental impact with precision.',
  alternates: {
    canonical: '/platform',
  },
};

export default function PlatformPage() {
  return <PlatformPageClient />;
}
