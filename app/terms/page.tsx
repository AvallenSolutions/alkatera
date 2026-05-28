import { Metadata } from 'next';
import { TermsPageClient } from '@/marketing/components/TermsPageClient';

export const metadata: Metadata = {
  title: 'Terms and Conditions | alkatera',
  description: 'Terms and conditions governing your use of the alkatera sustainability platform.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return <TermsPageClient />;
}
