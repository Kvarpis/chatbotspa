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
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    SHOPIFY_STOREFRONT_TOKEN: process.env.SHOPIFY_STOREFRONT_TOKEN,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src')
    };
    return config;
  },

  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS,PUT,DELETE' },
          { 
            key: 'Access-Control-Allow-Headers', 
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, Cart-Token, X-Shopify-Shop-Domain'
          }
        ]
      },
      {
        source: '/',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://farskapet.no' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { 
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://farskapet.no https://*.myshopify.com http://localhost:* https://*.vercel.app"
          },
          { key: 'X-Frame-Options', value: 'ALLOWALL' }
        ]
      },
      {
        source: '/embed.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Access-Control-Allow-Origin', value: 'https://seacretspa.no' },
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' }
        ]
      }
    ];
  },

  serverRuntimeConfig: {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    },
    shopify: {
      adminApiVersion: '2024-01',
      storefrontApiVersion: '2024-01',
    }
  },

  publicRuntimeConfig: {
    shopifyDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
    isDevelopment: process.env.NODE_ENV === 'development',
  },

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