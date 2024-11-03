// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity = 1 } = req.body;
      
      // First, get the current cart session token from Shopify
      const getCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        },
        credentials: 'include'
      });
  
      const currentCart = await getCartResponse.json();
      console.log('Current cart state:', currentCart);
  
      // Get the cart token from the response headers
      const cartToken = getCartResponse.headers.get('set-cookie')?.match(/cart=([^;]+)/)?.[1];
      console.log('Cart token:', cartToken);
  
      // Prepare headers for subsequent requests
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
  
      if (cartToken) {
        headers['Cookie'] = `cart=${cartToken}`;
      }
  
      // Add to cart with the synchronized session
      const addToCartResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
            quantity: parseInt(quantity, 10)
          }]
        }),
        credentials: 'include'
      });
  
      if (!addToCartResponse.ok) {
        const errorData = await addToCartResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      const addToCartData = await addToCartResponse.json();
      console.log('Add to cart response:', addToCartData);
  
      // Get updated cart state
      const updatedCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers,
        credentials: 'include'
      });
  
      const updatedCart = await updatedCartResponse.json();
      console.log('Updated cart state:', updatedCart);
  
      // Get sections for cart drawer update
      const sectionsResponse = await fetch(`https://${shopifyUrl}/cart?sections=cart-items,cart-icon-bubble,cart-live-region-text,cart-drawer&t=${Date.now()}`, {
        headers,
        credentials: 'include'
      });
  
      const sectionsData = await sectionsResponse.json();
  
      // Forward any cart cookies from Shopify to the client
      const cartCookies = addToCartResponse.headers.get('set-cookie');
      if (cartCookies) {
        res.setHeader('Set-Cookie', cartCookies);
      }
  
      // Set proper CORS headers for cross-origin requests
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      // Return comprehensive response
      return res.status(200).json({
        success: true,
        items: addToCartData,
        cart: updatedCart,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        sections: sectionsData,
        totalQuantity: updatedCart.item_count || 0
      });
  
    } catch (error) {
      console.error('Error adding to cart:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message
      });
    }
  }