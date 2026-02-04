import { Metadata } from 'next';
import { CookiesPageClient } from '@/marketing/components/CookiesPageClient';

export const metadata: Metadata = {
  title: 'Cookie Policy | Alkatera',
  description: 'How Alkatera uses cookies and similar technologies on our website and platform.',
  alternates: {
    canonical: '/cookies',
  },
};

export default function CookiePolicyPage() {
  return <CookiesPageClient />;
}
