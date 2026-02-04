import { Metadata } from 'next';
import { ContactPageClient } from '@/marketing/components/ContactPageClient';

export const metadata: Metadata = {
  title: 'Contact | Alkatera',
  description: 'Connect with Alkatera to start your sustainability journey. Ready to scale your impact? Let\'s talk.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
