import './globals.css';
import type { Metadata } from 'next';
import { Inter, Lora, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { OrganizationProvider } from '@/lib/organizationContext';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-heading',
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
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://alkatera.com'),
  title: 'Alkatera | Sustainability, Distilled',
  description: 'The all-in-one operating system for drinks brands to automate impact data, ensure compliance, and fuel strategic growth.',
  keywords: ['sustainability', 'carbon footprint', 'drinks industry', 'brewery', 'distillery', 'winery', 'ESG', 'carbon accounting', 'GHG Protocol', 'ISO 14067', 'CSRD', 'B-Corp'],
  authors: [{ name: 'Alkatera' }],
  creator: 'Alkatera',
  publisher: 'Alkatera',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://alkatera.com',
    siteName: 'Alkatera',
    title: 'Alkatera | Sustainability, Distilled',
    description: 'The all-in-one operating system for drinks brands to automate impact data, ensure compliance, and fuel strategic growth.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Alkatera - Sustainability, Distilled',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alkatera | Sustainability, Distilled',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="text/plain" title="LLM-friendly content" href="/llms.txt" />
      </head>
      <GoogleAnalytics />
      <body className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} font-body`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <OrganizationProvider>
              {children}
              <Toaster />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
