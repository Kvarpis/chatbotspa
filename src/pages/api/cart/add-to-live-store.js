export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      if (!variantId) {
        throw new Error('Required parameter missing: variantId');
      }
  
      console.log('Processing add to cart:', {
        variantId,
        quantity,
        shopifyUrl
      });
  
      // Add to cart using cart/add.js
      const formData = {
        items: [{
          id: parseInt(variantId, 10),
          quantity: parseInt(quantity, 10)
        }]
      };
  
      // First request: Add to cart
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        body: JSON.stringify(formData)
      });
  
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      const addData = await addResponse.json();
      console.log('Add to cart response:', addData);
  
      // Second request: Get updated cart state
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        }
      });
  
      const cartData = await cartResponse.json();
      console.log('Updated cart state:', cartData);
  
      // Third request: Get sections HTML
      const sectionsResponse = await fetch(
        `https://${shopifyUrl}/cart?sections=cart-items,cart-icon-bubble,cart-live-region-text`,
        {
          headers: {
            'Accept': 'application/json',
            'Cookie': req.headers.cookie || ''
          }
        }
      );
  
      const sectionsData = await sectionsResponse.json();
  
      // Forward cookies from all responses
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
  
      return res.status(200).json({
        success: true,
        items: addData,
        cart: cartData,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        sections: sectionsData,
        totalQuantity: cartData.item_count || 0
      });
  
    } catch (error) {
      console.error('Error adding to live store cart:', error);
      return res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }