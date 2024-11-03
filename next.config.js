/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  images: {
    domains: ['cdn.shopify.com'],
  },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SHOPIFY_STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    NEXT_PUBLIC_BOOKING_URL: process.env.NEXT_PUBLIC_BOOKING_URL,
  },
  // Add source directory configuration
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src')
    };
    return config;
  },
  // Tell Next.js to look for pages in src/pages
  pageExtensions: ['tsx', 'ts', 'jsx', 'js']
}

module.exports = nextConfig