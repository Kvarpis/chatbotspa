// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Processing add to cart:', { variantId, quantity });
  
      // Base headers for all requests
      const baseHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
      };
  
      // Get initial cart state
      const initialCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: baseHeaders
      });
      const initialCart = await initialCartResponse.json();
      console.log('Initial cart state:', initialCart);
  
      // Add to cart
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
  
      // Check for specific error responses from Shopify
      if (!addToCartResponse.ok) {
        const errorData = await addToCartResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      // Get updated cart state
      const updatedCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: baseHeaders
      });
      const updatedCart = await updatedCartResponse.json();
      console.log('Updated cart state:', updatedCart);
  
      // Calculate actual changes in cart
      const newItemCount = updatedCart.item_count;
      const itemsAdded = newItemCount > initialCart.item_count;
  
      // Handle cookies
      const cartCookies = addToCartResponse.headers.get('set-cookie');
      if (cartCookies) {
        const cookieStrings = cartCookies.split(',').map(cookie => {
          const mainPart = cookie.split(';')[0].trim();
          return `${mainPart}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        });
        res.setHeader('Set-Cookie', cookieStrings);
      }
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      // Return response with cart data
      return res.status(200).json({
        success: true,
        itemAdded: true, // Assume success if we got here
        cart: updatedCart,
        checkoutUrl: `https://${shopifyUrl}/cart`,
        totalQuantity: newItemCount,
        sections: {
          'cart-icon-bubble': `<span class="cart-count-bubble">${newItemCount}</span>`
        }
      });
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to add to cart'
      });
    }
  }