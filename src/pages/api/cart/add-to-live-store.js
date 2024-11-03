export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // Log incoming cookies
      console.log('Incoming cookies:', req.headers.cookie);
  
      // First, get the customer session if not already present
      const sessionResponse = await fetch(`https://${shopifyUrl}/cart`, {
        headers: {
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        }
      });
  
      // Get all cookies from the session response
      const sessionCookies = sessionResponse.headers.get('set-cookie');
      console.log('Session cookies:', sessionCookies);
  
      // Combine all relevant cookies
      const allCookies = [
        req.headers.cookie,
        sessionCookies
      ].filter(Boolean).join('; ');
  
      // Add to cart using cart/add.js with session cookies
      const formData = {
        items: [{
          id: parseInt(variantId, 10),
          quantity: parseInt(quantity, 10)
        }]
      };
  
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': allCookies
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
  
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      const addData = await addResponse.json();
      console.log('Add to cart response:', addData);
  
      // Get updated cart state with session
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Accept': 'application/json',
          'Cookie': allCookies
        }
      });
  
      const cartData = await cartResponse.json();
      console.log('Cart state:', cartData);
  
      // Get sections HTML with session
      const sectionsResponse = await fetch(
        `https://${shopifyUrl}/cart?sections=cart-items,cart-icon-bubble,cart-live-region-text`,
        {
          headers: {
            'Accept': 'application/json',
            'Cookie': allCookies
          }
        }
      );
  
      const sectionsData = await sectionsResponse.json();
  
      // Collect all cookies from responses
      const cookies = [
        sessionCookies,
        addResponse.headers.get('set-cookie'),
        cartResponse.headers.get('set-cookie'),
        sectionsResponse.headers.get('set-cookie')
      ].filter(Boolean);
  
      // Set all cookies in response
      if (cookies.length) {
        cookies.forEach(cookie => {
          res.setHeader('Set-Cookie', cookie);
        });
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
        totalQuantity: cartData.item_count || 0,
        debug: {
          cookies: allCookies,
          sessionCookies: sessionCookies
        }
      });
  
    } catch (error) {
      console.error('Error adding to live store cart:', error);
      return res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          cookies: req.headers.cookie
        } : undefined
      });
    }
  }