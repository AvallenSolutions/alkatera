import { Metadata } from 'next';
import { ContactPageClient } from '@/marketing/components/ContactPageClient';

export const metadata: Metadata = {
  title: 'Contact | alkatera',
  description: 'Connect with alkatera to start your sustainability journey. Ready to scale your impact? Let\'s talk.',
  alternates: {
    canonical: '/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | alkatera',
    description: 'Connect with alkatera to start your sustainability journey. Ready to scale your impact? Let\'s talk.',
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
