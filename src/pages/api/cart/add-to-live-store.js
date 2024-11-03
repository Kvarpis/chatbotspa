export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // Ensure variantId exists and extract numeric ID if it's a gid
      if (!variantId) {
        throw new Error('Required parameter missing: variantId');
      }
  
      // Extract numeric ID if it's a gid format
      const numericId = variantId.toString().includes('/')
        ? variantId.toString().split('/').pop()
        : variantId;
  
      console.log('Processing variant ID:', {
        original: variantId,
        numeric: numericId
      });
  
      // Add to cart using cart/add.js
      const formData = {
        items: [{
          id: parseInt(numericId, 10),
          quantity: parseInt(quantity, 10)
        }]
      };
  
      console.log('Sending to Shopify:', formData);
  
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
  
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      const addData = await addResponse.json();
      console.log('Shopify add response:', addData);
  
      // Second request: Get cart state
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        credentials: 'include'
      });
  
      const cartData = await cartResponse.json();
  
      // Third request: Get cart sections HTML
      const sectionsResponse = await fetch(
        `https://${shopifyUrl}/cart?sections=cart-items,cart-icon-bubble,cart-live-region-text,cart-notification`,
        {
          headers: {
            'Accept': 'application/json',
            'Cookie': req.headers.cookie || ''
          },
          credentials: 'include'
        }
      );
  
      const sectionsData = await sectionsResponse.json();
  
      // Forward any set-cookie headers from Shopify
      const cookies = [
        addResponse.headers.get('set-cookie'),
        cartResponse.headers.get('set-cookie'),
        sectionsResponse.headers.get('set-cookie')
      ].filter(Boolean);
  
      if (cookies.length) {
        res.setHeader('Set-Cookie', cookies);
      }
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
      return res.status(200).json({
        success: true,
        items: addData,
        cart: cartData,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        sections: sectionsData,
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