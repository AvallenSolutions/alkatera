import { Metadata } from 'next';
import { PlatformClient } from '@/marketing/platform/PlatformClient';
import { PLATFORM_FAQ } from '@/marketing/platform/faq-data';
import '@/marketing/shared/marketing.css';

const pageUrl = 'https://alkatera.com/platform';

export const metadata: Metadata = {
  title: 'Platform · alkatera',
  description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, achieve B Corp, and turn ESG data into competitive advantage.',
  alternates: {
    canonical: '/platform',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Platform · alkatera',
    description: 'The single sustainability platform purpose-built for the drinks industry. Measure beyond carbon, defend against greenwashing, achieve B Corp, and turn ESG data into competitive advantage.',
  },
};

// FAQPage structured data. Questions/answers are shared with the visible FAQ on
// the page via PLATFORM_FAQ so the two never drift apart.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${pageUrl}/#faq`,
  mainEntity: PLATFORM_FAQ.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function PlatformPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PlatformClient />
    </>
  );
}
