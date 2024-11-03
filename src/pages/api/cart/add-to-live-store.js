// pages/api/cart/add-to-live-store.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // Forward the user's cookies to maintain their session
      const response = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '', // Forward the user's cookies
        },
        credentials: 'include',
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      // Forward Shopify's set-cookie headers in the response
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        res.setHeader('Set-Cookie', cookies);
      }
  
      const data = await response.json();
      
      // After adding item, get the current cart state
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Cookie': req.headers.cookie || '',
        },
        credentials: 'include',
      });
      
      const cartData = await cartResponse.json();
  
      res.status(200).json({
        success: true,
        items: data,
        cart: cartData
      });
    } catch (error) {
      console.error('Error adding to live store cart:', error);
      res.status(500).json({ error: error.message });
    }
  }