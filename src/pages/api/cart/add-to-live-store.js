// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Received request for variant:', variantId, 'quantity:', quantity);
  
      // Base headers for all requests
      const baseHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
      };
  
      // Step 1: Add to cart
      console.log('Adding to cart...');
      const addToCartResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      const addToCartData = await addToCartResponse.json();
      console.log('Add to cart response:', addToCartData);
  
      if (!addToCartResponse.ok) {
        throw new Error(addToCartData.description || 'Failed to add to cart');
      }
  
      // Step 2: Get cart state
      console.log('Getting cart state...');
      const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: baseHeaders
      });
  
      const cartData = await cartResponse.json();
      console.log('Cart state:', cartData);
  
      // Get any new cookies from Shopify
      const cartCookies = addToCartResponse.headers.get('set-cookie');
      if (cartCookies) {
        // Parse and consolidate cookies
        const cookieStrings = cartCookies.split(',').map(cookie => {
          // Extract the main cookie part before any attributes
          const mainPart = cookie.split(';')[0].trim();
          return `${mainPart}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        });
        
        // Set cookies in response
        res.setHeader('Set-Cookie', cookieStrings);
      }
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      // Prepare response with actual cart quantities
      const totalQuantity = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
      
      return res.status(200).json({
        success: true,
        cart: {
          ...cartData,
          item_count: totalQuantity,
          items: cartData.items.map(item => ({
            ...item,
            price: parseInt(item.price),
            line_price: parseInt(item.line_price)
          }))
        },
        checkoutUrl: `https://${shopifyUrl}/cart`,
        totalQuantity,
        sections: {
          'cart-icon-bubble': `<span class="cart-count-bubble">${totalQuantity}</span>`
        }
      });
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to add to cart',
        debug: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }