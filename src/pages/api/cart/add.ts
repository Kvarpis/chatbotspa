import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { cartId, merchandiseId, quantity } = req.body;

    if (!cartId || !merchandiseId || !quantity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    if (!shopifyUrl || !accessToken) {
      throw new Error('Missing Shopify configuration');
    }

    const response = await fetch(`https://${shopifyUrl}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
            cartLinesAdd(cartId: $cartId, lines: $lines) {
              cart {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          cartId,
          lines: [{
            merchandiseId,
            quantity: parseInt(quantity)
          }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.data?.cartLinesAdd?.userErrors?.length > 0) {
      throw new Error(data.data.cartLinesAdd.userErrors[0].message);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 