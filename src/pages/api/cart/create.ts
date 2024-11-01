import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    if (!shopifyUrl || !accessToken) {
      console.error('Missing Shopify configuration');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    console.log('Creating cart with Shopify:', { shopifyUrl });

    const response = await fetch(`https://${shopifyUrl}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          mutation cartCreate {
            cartCreate {
              cart {
                id
                checkoutUrl
              }
              userErrors {
                field
                message
              }
            }
          }
        `
      })
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Shopify response:', data);
    
    if (data.data?.cartCreate?.userErrors?.length > 0) {
      const error = data.data.cartCreate.userErrors[0];
      console.error('Shopify user error:', error);
      throw new Error(error.message);
    }

    const cartId = data.data?.cartCreate?.cart?.id;
    if (!cartId) {
      throw new Error('Failed to create cart');
    }

    return res.status(200).json({ success: true, cartId });

  } catch (error) {
    console.error('Cart creation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 