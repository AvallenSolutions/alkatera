import { Metadata } from 'next';
import { ManifestoPageClient } from '@/marketing/components/ManifestoPageClient';

export const metadata: Metadata = {
  title: 'Manifesto | Alkatera',
  description: 'The soil does not negotiate. Sustainability is the only insurance policy for your future existence. No nature. No drink.',
  alternates: {
    canonical: '/manifesto',
  },
};

export default function ManifestoPage() {
  return <ManifestoPageClient />;
}
