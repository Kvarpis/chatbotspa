/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  images: {
    domains: ['cdn.shopify.com'],
  },
  reactStrictMode: true,

  // Environment variables configuration
  env: {
    NEXT_PUBLIC_SHOPIFY_STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    NEXT_PUBLIC_BOOKING_URL: process.env.NEXT_PUBLIC_BOOKING_URL,
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    SHOPIFY_STOREFRONT_TOKEN: process.env.SHOPIFY_STOREFRONT_TOKEN,
  },

  // Source directory and webpack configuration
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src')
    };
    return config;
  },

  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // CORS and headers configuration
  async headers() {
    const headers = [
      {
        // Headers for API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { 
            key: 'Access-Control-Allow-Headers', 
            value: [
              'X-CSRF-Token',
              'X-Requested-With',
              'Accept',
              'Accept-Version',
              'Content-Length',
              'Content-MD5',
              'Content-Type',
              'Date',
              'X-Api-Version',
              'Cookie',
              'Authorization',
              'X-Shopify-Access-Token',
              'Shopify-Storefront-Private-Token'
            ].join(', ')
          }
        ]
      },
      {
        // Headers for the embed page
        source: '/',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.myshopify.com http://localhost:* https://*.vercel.app" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' }
        ]
      },
      {
        // Headers for embed.js
        source: '/embed.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript' }
        ]
      }
    ];

    return headers;
  },

  // Server runtime configuration
  serverRuntimeConfig: {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    shopify: {
      adminApiVersion: '2024-01',
      storefrontApiVersion: '2024-01',
    }
  },

  // Public runtime configuration
  publicRuntimeConfig: {
    shopifyDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
    isDevelopment: process.env.NODE_ENV === 'development',
  },

  // Rewrite rules
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/embed.js',
        destination: '/api/embed.js',
      }
    ];
  }
};

module.exports = nextConfig;