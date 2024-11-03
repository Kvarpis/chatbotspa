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
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { 
            key: 'Access-Control-Allow-Origin', 
            value: process.env.NODE_ENV === 'development' 
              ? '*' 
              : 'https://seacretspano.myshopify.com'
          },
          { 
            key: 'Access-Control-Allow-Methods', 
            value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS'
          },
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
          },
          // Add security headers
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com;
              style-src 'self' 'unsafe-inline' https://cdn.shopify.com;
              img-src 'self' data: https://cdn.shopify.com;
              connect-src 'self' https://*.myshopify.com;
              frame-ancestors 'self' https://*.myshopify.com;
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      },
      // Add headers for static files
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      }
    ];

    return headers;
  },

  // Server runtime configuration
  serverRuntimeConfig: {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

  // API route handling
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      }
    ];
  },

  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    webpack: (config) => {
      config.devtool = 'source-map';
      return config;
    },
  })
};

module.exports = nextConfig;