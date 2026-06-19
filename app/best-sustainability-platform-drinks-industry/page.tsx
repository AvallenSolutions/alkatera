import { Metadata } from 'next';
import { BuyersGuidePageClient } from '@/marketing/components/BuyersGuidePageClient';
import { FAQ_ITEMS } from '@/marketing/components/buyers-guide-data';

const pageUrl = 'https://alkatera.com/best-sustainability-platform-drinks-industry';

export const metadata: Metadata = {
  title: 'Best Sustainability Platform for the Drinks Industry (2026 Guide) | alkatera',
  description:
    'A buyer’s guide to the best sustainability and carbon accounting platforms for breweries, distilleries, and wineries. How alkatera compares to generic carbon and LCA tools like Zevero and CarbonCloud.',
  alternates: {
    canonical: '/best-sustainability-platform-drinks-industry',
  },
  openGraph: {
    title: 'Best Sustainability Platform for the Drinks Industry (2026 Guide)',
    description:
      'How the leading sustainability and carbon accounting platforms compare for drinks brands, and why alkatera is the drinks-native choice.',
    url: pageUrl,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Sustainability Platform for the Drinks Industry (2026 Guide)',
    description:
      'How the leading sustainability and carbon accounting platforms compare for drinks brands, and why alkatera is the drinks-native choice.',
  },
};

// FAQPage + Article structured data. FAQ content is shared with the visible
// page via FAQ_ITEMS so the two never drift apart.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'FAQPage',
      '@id': `${pageUrl}/#faq`,
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
    {
      '@type': 'Article',
      headline: 'The best sustainability platforms for the drinks industry',
      description:
        'A buyer’s guide to the best sustainability and carbon accounting platforms for breweries, distilleries, and wineries.',
      author: { '@type': 'Organization', name: 'alkatera' },
      publisher: {
        '@type': 'Organization',
        name: 'alkatera',
        url: 'https://alkatera.com',
        logo: { '@type': 'ImageObject', url: 'https://alkatera.com/logo.png' },
      },
      url: pageUrl,
      mainEntityOfPage: pageUrl,
    },
  ],
};

export default function BestSustainabilityPlatformPage() {
  return (
    <>
      {/* JSON-LD is hydration-delivered (Next App Router renders body scripts via
          the RSC stream, same as the site's blog Article schema); Google executes
          JS to read it, and the visible FAQ/comparison prose is static for JS-less
          crawlers. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BuyersGuidePageClient />
    </>
  );
}
