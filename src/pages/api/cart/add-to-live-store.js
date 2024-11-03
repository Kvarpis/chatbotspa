export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // Add to cart using cart.js
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      const addData = await addResponse.json();
  
      // Get current cart state
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });
      const cartData = await cartResponse.json();
  
      // Get checkout URL
      const checkoutUrl = `https://${shopifyUrl}/cart`;
  
      // Forward any set-cookie headers from Shopify
      const cookies = addResponse.headers.get('set-cookie');
      if (cookies) {
        res.setHeader('Set-Cookie', cookies);
      }
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      return res.status(200).json({
        success: true,
        items: addData,
        cart: cartData,
        checkoutUrl: checkoutUrl,
        totalQuantity: cartData.item_count
      });
  
    } catch (error) {
      console.error('Error adding to live store cart:', error);
      return res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }