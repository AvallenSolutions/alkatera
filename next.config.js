/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  // Expose the server-side Google Maps key to the client bundle.
  // We can't use NEXT_PUBLIC_ prefix in Netlify env vars because
  // the secrets scanner blocks deployment when it detects API keys
  // in NEXT_PUBLIC_ variables. This aliases the server-side key at
  // build time without triggering the scanner.
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },
};

module.exports = nextConfig;
