import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { spaceGrotesk } from '@/components/studio/fonts';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OrganizationProvider } from '@/lib/organizationContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { CookieConsent } from '@/components/CookieConsent';
import { PostHogProvider } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://alkatera.com'),
  title: 'alkatera | Sustainability, Distilled',
  description: 'The all-in-one operating system for drinks brands to automate impact data, ensure compliance, and fuel strategic growth.',
  keywords: ['sustainability', 'carbon footprint', 'drinks industry', 'brewery', 'distillery', 'winery', 'ESG', 'carbon accounting', 'GHG Protocol', 'ISO 14067', 'CSRD', 'B-Corp'],
  authors: [{ name: 'alkatera' }],
  creator: 'alkatera',
  publisher: 'alkatera',
  // NB: no `alternates.canonical` here on purpose. A canonical set on the root
  // layout is inherited by every page that doesn't override it, so it stamps a
  // homepage canonical onto sub-pages (e.g. client-component pages that can't
  // export their own metadata) and tells Google to index the homepage instead.
  // Each page declares its own self-referencing canonical; the homepage's lives
  // in app/page.tsx.
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://alkatera.com',
    siteName: 'alkatera',
    title: 'alkatera | Sustainability, Distilled',
    description: 'The all-in-one operating system for drinks brands to automate impact data, ensure compliance, and fuel strategic growth.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'alkatera - Sustainability, Distilled',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'alkatera | Sustainability, Distilled',
    description: 'The all-in-one operating system for drinks brands to automate impact data, ensure compliance, and fuel strategic growth.',
    images: ['/og-image.jpg'],
    creator: '@alkatera',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://alkatera.com/#organization",
      "name": "alkatera",
      "legalName": "Avallen Solutions Ltd trading as alkatera",
      "url": "https://alkatera.com",
      "logo": "https://alkatera.com/logo.png",
      "email": "hello@alkatera.com",
      "description": "Sustainability and carbon accounting platform built for the drinks industry. Provides carbon footprint analysis, Life Cycle Assessment (LCA), water stewardship, greenwashing protection, and compliance reporting for breweries, distilleries, and wineries.",
      "sameAs": [
        "https://www.linkedin.com/company/alkatera",
        "https://x.com/alkatera"
      ],
      "foundingDate": "2025",
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "hello@alkatera.com",
        "contactType": "sales",
        "areaServed": "Worldwide",
        "availableLanguage": "English"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://alkatera.com/#software",
      "name": "alkatera",
      "alternateName": ["alkatera"],
      "description": "The all-in-one sustainability operating system for drinks brands. Automates impact data collection, ensures regulatory compliance (CSRD, GRI, ISO 14067), and enables strategic sustainability planning.",
      "url": "https://alkatera.com",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "creator": { "@id": "https://alkatera.com/#organization" },
      "offers": {
        "@type": "AggregateOffer",
        "lowPrice": "99",
        "highPrice": "599",
        "priceCurrency": "GBP",
        "offerCount": "3"
      },
      "featureList": [
        "Life Cycle Assessment (LCA) calculations",
        "Carbon footprint per product",
        "Water stewardship (AWARE Protocol)",
        "Greenwash Guardian compliance scanning",
        "B-Corp certification tracking",
        "CSRD, GRI, ISO 14067 reporting",
        "Supply chain mapping",
        "Rosa AI sustainability assistant"
      ],
      "keywords": "sustainability, LCA, carbon footprint, drinks industry, brewery, distillery, winery, ESG, B-Corp, GHG Protocol, ISO 14067, CSRD, carbon accounting"
    },
    {
      "@type": "WebSite",
      "@id": "https://alkatera.com/#website",
      "url": "https://alkatera.com",
      "name": "alkatera",
      "description": "Sustainability, Distilled.",
      "publisher": { "@id": "https://alkatera.com/#organization" }
    }
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="text/plain" title="LLM-friendly content" href="/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <GoogleAnalytics />
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} font-body`}>
        <PostHogProvider>
          {/* The studio is a single paper theme: dark mode is retired on the
              redesign branch, so the theme is forced light and the toggle is
              inert. Confirm with Tim at the M1 review before deleting the
              toggle UI itself. */}
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange={false}
          >
            <QueryProvider>
              <AuthProvider>
                <OrganizationProvider>
                  {children}
                  <Toaster />
                  <SonnerToaster />
                </OrganizationProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </PostHogProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
