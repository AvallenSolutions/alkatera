import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Product Passport',
  description: 'Environmental impact transparency',
};

export default function PassportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
