import type { Metadata } from 'next';

// The getaccess page itself is a client component, so it can't export metadata.
// This route-segment layout supplies the SEO metadata (incl. a self-referencing
// canonical) so the pricing page is indexed on its own URL rather than inheriting
// a canonical that points elsewhere.
export const metadata: Metadata = {
  title: 'Pricing & Plans | alkatera',
  description:
    'Choose the alkatera plan that fits your drinks brand. Automate impact data, ensure compliance, and fuel strategic growth across our Seed, Blossom, and Canopy tiers.',
  alternates: {
    canonical: '/getaccess',
  },
  openGraph: {
    type: 'website',
    url: 'https://alkatera.com/getaccess',
    title: 'Pricing & Plans | alkatera',
    description:
      'Choose the alkatera plan that fits your drinks brand. Automate impact data, ensure compliance, and fuel strategic growth across our Seed, Blossom, and Canopy tiers.',
  },
};

export default function GetAccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
