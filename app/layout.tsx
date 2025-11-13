import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { OrganizationProvider } from '@/lib/organizationContext';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AlkaTera',
  description: 'Multi-tenant SaaS application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OrganizationProvider>
          {children}
          <Toaster />
        </OrganizationProvider>
      </body>
    </html>
  );
}
