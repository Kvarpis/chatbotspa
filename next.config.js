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
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Add CORS and cookie configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          // In development
          ...(process.env.NODE_ENV === 'development' ? [
            { key: 'Access-Control-Allow-Origin', value: '*' }
          ] : [
            // In production, specify your domains
            { 
              key: 'Access-Control-Allow-Origin', 
              value: 'https://seacretspano.myshopify.com' // Your Shopify store domain
            }
          ]),
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { 
            key: 'Access-Control-Allow-Headers', 
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, Authorization'
          }
        ],
      },
    ];
  },

  // Add cookie and session configuration
  serverRuntimeConfig: {
    // Will only be available on the server side
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }
  },

  // Add public runtime config
  publicRuntimeConfig: {
    // Will be available on both server and client
    shopifyDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
  },

  // Add middleware configuration to handle CORS preflight requests
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;