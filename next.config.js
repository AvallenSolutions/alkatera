/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow a second dev server (e.g. the distributor portal on 8889) to run from
  // the same checkout as the procurement portal (8890) without both processes
  // clobbering a shared .next directory. Override with NEXT_DIST_DIR per server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    // Enable Next.js image optimisation (auto WebP/AVIF, responsive sizing, lazy loading).
    // Netlify's @netlify/plugin-nextjs handles the optimisation API in production.
    // Previously disabled with `unoptimized: true` which served all images at full resolution.
    // AVIF first (≈20-30% smaller than WebP for the large hero JPEGs), WebP fallback.
    // Cache optimised variants for 30 days (default 60s is far too short for our
    // largely-static hero/marketing imagery).
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Prismic CDN — some seeded products (e.g. Avallen Calvados) have
        // image URLs pointing at the customer's Prismic media library.
        protocol: 'https',
        hostname: 'images.prismic.io',
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // The old /blog index was a thin client page that self-canonicalised to
        // the homepage and listed no posts. Consolidate all SEO signals on the
        // /knowledge hub with a permanent (308) routing-layer redirect. Done here
        // rather than via redirect() in a page because the root app/error.tsx
        // boundary swallows the NEXT_REDIRECT thrown by in-page redirects.
        source: '/blog',
        destination: '/knowledge',
        permanent: true,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@radix-ui/react-icons',
      'framer-motion',
    ],
  },
};

module.exports = nextConfig;
