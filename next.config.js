/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  compiler: {
    removeConsole: false,
  },
  serverExternalPackages: ['pdfjs-dist'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
