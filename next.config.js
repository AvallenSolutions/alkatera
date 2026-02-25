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
};

module.exports = nextConfig;
