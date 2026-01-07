/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  compiler: {
    removeConsole: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
