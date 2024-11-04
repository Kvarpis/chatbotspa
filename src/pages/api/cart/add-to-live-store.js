// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    try {
      const { variantId, quantity = 1 } = req.body;
      const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
      
      // Extract the numeric ID from the variant ID
      const numericId = variantId.includes('/')
        ? variantId.split('/').pop()
        : variantId;
  
      // Forward the request to Shopify's cart/add.js endpoint
      const response = await fetch(`https://${shopifyDomain}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward any existing cookies from the request
          ...(req.headers.cookie && { Cookie: req.headers.cookie })
        },
        body: JSON.stringify({
          items: [{
            id: parseInt(numericId, 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      const data = await response.json();
  
      // Forward any Set-Cookie headers from Shopify's response
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        res.setHeader('Set-Cookie', cookies);
      }
  
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      return res.status(response.status).json(data);
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to add to cart'
      });
    }
  }