import { Metadata } from 'next';
import { PrivacyPageClient } from '@/marketing/components/PrivacyPageClient';

export const metadata: Metadata = {
  title: 'Privacy Policy | Alkatera',
  description: 'How Alkatera collects, uses, and protects your personal information.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPageClient />;
}
