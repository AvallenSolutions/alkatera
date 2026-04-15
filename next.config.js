/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Enable Next.js image optimisation (auto WebP/AVIF, responsive sizing, lazy loading).
    // Netlify's @netlify/plugin-nextjs handles the optimisation API in production.
    // Previously disabled with `unoptimized: true` which served all images at full resolution.
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
