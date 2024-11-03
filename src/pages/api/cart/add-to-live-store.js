export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // Parse existing cookies
      const existingCartToken = req.headers.cookie?.match(/cart=([^;]+)/)?.[1];
      console.log('Existing cart token:', existingCartToken);
  
      // Headers to be used across all requests
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
  
      if (existingCartToken) {
        headers['Cookie'] = `cart=${existingCartToken}`;
      }
  
      // Add to cart using cart/add.js
      const formData = {
        items: [{
          id: parseInt(variantId, 10),
          quantity: parseInt(quantity, 10)
        }]
      };
  
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
  
      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      // Get cart token from response if present
      const cartCookie = addResponse.headers.get('set-cookie')?.match(/cart=([^;]+)/)?.[1];
      if (cartCookie) {
        headers['Cookie'] = `cart=${cartCookie}`;
      }
  
      const addData = await addResponse.json();
      console.log('Add response:', addData);
  
      // Get updated cart state
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers
      });
  
      const cartData = await cartResponse.json();
      console.log('Cart state:', cartData);
  
      // Set cart cookie in response if we have one
      if (cartCookie) {
        res.setHeader('Set-Cookie', [
          `cart=${cartCookie}; path=/; secure; sameSite=Lax`,
          `cart_ts=${Date.now()}; path=/; secure; sameSite=Lax`
        ]);
      }
  
      // Get cart sections
      const sectionsUrl = new URL(`https://${shopifyUrl}/cart`);
      sectionsUrl.searchParams.set('sections', 'cart-items,cart-icon-bubble,cart-live-region-text');
      sectionsUrl.searchParams.set('t', Date.now().toString());
  
      const sectionsResponse = await fetch(sectionsUrl.toString(), {
        headers
      });
  
      const sectionsData = await sectionsResponse.json();
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      return res.status(200).json({
        success: true,
        items: addData,
        cart: cartData,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        sections: sectionsData,
        totalQuantity: cartData.item_count || 0,
        debug: {
          cartToken: cartCookie || existingCartToken,
          requestHeaders: headers
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