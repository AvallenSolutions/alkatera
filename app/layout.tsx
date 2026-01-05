import './globals.css';
import type { Metadata } from 'next';
import { Inter, Lora, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { OrganizationProvider } from '@/lib/organizationContext';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';

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
  title: 'AlkaTera',
  description: 'Multi-tenant SaaS application',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
