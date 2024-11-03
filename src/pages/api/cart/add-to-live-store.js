export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      // First, get the current cart state
      const cartStateResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || ''
        }
      });
      
      console.log('Current cart state:', await cartStateResponse.clone().json());
  
      // Add to cart using cart/add.js
      const addResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': req.headers.cookie || ''
        },
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      const addData = await addResponse.json();
      console.log('Add to cart response:', addData);
  
      // Get updated cart state
      const updatedCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || ''
        }
      });
      
      const cartData = await updatedCartResponse.json();
      console.log('Updated cart state:', cartData);
  
      // Forward all cookies from Shopify responses
      const addCookies = addResponse.headers.get('set-cookie');
      const cartCookies = updatedCartResponse.headers.get('set-cookie');
      
      const allCookies = [addCookies, cartCookies]
        .filter(Boolean)
        .join('; ');
      
      if (allCookies) {
        res.setHeader('Set-Cookie', allCookies);
      }
  
      // Set proper CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
      // Return cart data with proper URLs
      return res.status(200).json({
        success: true,
        items: addData,
        cart: cartData,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        cartUpdateUrl: `https://${shopifyUrl}/cart/update.js`,
        cartClearUrl: `https://${shopifyUrl}/cart/clear.js`,
        totalQuantity: cartData.item_count,
        debug: {
          cookies: req.headers.cookie,
          setCookies: allCookies
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