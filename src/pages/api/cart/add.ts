// pages/api/cart/add.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const SHOPIFY_DOMAIN = 'seacretspano.myshopify.com';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, quantity } = req.body;

    // Make the request to Shopify from the backend
    const response = await fetch(`https://${SHOPIFY_DOMAIN}/cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          id: variantId,
          quantity: quantity
        }]
      })
    });

    const data = await response.json();

    // Forward Shopify's response
    res.status(response.ok ? 200 : 400).json(data);
  } catch (error) {
    console.error('Cart add error:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
}