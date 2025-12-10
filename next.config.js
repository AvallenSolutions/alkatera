/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  compiler: {
    removeConsole: false,
  },
  serverExternalPackages: ['pdfjs-dist'],
};

module.exports = nextConfig;
