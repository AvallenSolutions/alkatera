/** @type {import('next').NextConfig} */
const nextConfig = {
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
