// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Adding to cart:', { variantId, quantity });
  
      // First get existing cart data if any
      const cartResponse = await fetch(`https://${shopifyStore}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        }
      });
  
      const cartData = await cartResponse.json();
      console.log('Current cart:', cartData);
  
      // Add to cart
      const addToCartResponse = await fetch(`https://${shopifyStore}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        },
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId.split('/').pop(), 10),
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      if (!addToCartResponse.ok) {
        const errorData = await addToCartResponse.json();
        throw new Error(errorData.description || 'Failed to add to cart');
      }
  
      const addToCartData = await addToCartResponse.json();
      console.log('Add to cart response:', addToCartData);
  
      // Get updated cart
      const updatedCartResponse = await fetch(`https://${shopifyStore}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        }
      });
  
      const updatedCart = await updatedCartResponse.json();
  
      // Get sections for cart UI updates
      const sectionsResponse = await fetch(
        `https://${shopifyStore}/cart?sections=cart-items,cart-icon-bubble,cart-live-region-text&t=${Date.now()}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
          }
        }
      );
  
      const sections = await sectionsResponse.json();
  
      // Forward Shopify's cart cookies to maintain session
      const shopifyCookies = addToCartResponse.headers.get('set-cookie');
      if (shopifyCookies) {
        // Parse and forward all cart-related cookies
        const cookieStrings = shopifyCookies.split(',').map(cookie => {
          // Get the main cookie part before attributes
          const mainPart = cookie.split(';')[0].trim();
          if (mainPart.startsWith('cart=') || mainPart.startsWith('_shopify_cart=')) {
            return `${mainPart}; path=/; SameSite=Lax`;
          }
          return null;
        }).filter(Boolean);
  
        if (cookieStrings.length > 0) {
          res.setHeader('Set-Cookie', cookieStrings);
        }
      }
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      return res.status(200).json({
        success: true,
        cart: updatedCart,
        sections,
        checkoutUrl: `https://${shopifyStore}/cart`,
        totalQuantity: updatedCart.item_count
      });
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }