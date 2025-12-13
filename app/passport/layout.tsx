import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Product Passport',
  description: 'Environmental impact transparency',
};

export default function PassportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
