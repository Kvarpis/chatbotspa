// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Received request to add:', { variantId, quantity });
  
      // First get current cart state
      const cartStateResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        }
      });
      
      const currentCart = await cartStateResponse.json();
      console.log('Current cart state:', currentCart);
  
      // Add to cart
      const addToCartResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        },
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),
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
  
      // Get updated cart state
      const updatedCartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
        headers: {
          'Content-Type': 'application/json',
          ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
        }
      });
  
      const updatedCart = await updatedCartResponse.json();
      console.log('Updated cart state:', updatedCart);
  
      // Get cart sections
      const sectionsResponse = await fetch(
        `https://${shopifyUrl}/cart?view=ajax&sections=cart-items,cart-icon-bubble,cart-live-region-text,cart-drawer`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...req.headers.cookie ? { 'Cookie': req.headers.cookie } : {}
          }
        }
      );
  
      const sectionsData = await sectionsResponse.json();
  
      // Forward cookies from Shopify to maintain session
      const cartCookies = addToCartResponse.headers.get('set-cookie');
      if (cartCookies) {
        res.setHeader('Set-Cookie', cartCookies.split(','));
      }
  
      // Calculate actual total quantity and price
      const totalQuantity = updatedCart.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = updatedCart.total_price;
  
      return res.status(200).json({
        success: true,
        items: addToCartData,
        cart: {
          ...updatedCart,
          total_quantity: totalQuantity,
          formatted_total_price: new Intl.NumberFormat('nb-NO', {
            style: 'currency',
            currency: 'NOK'
          }).format(totalPrice / 100)
        },
        checkoutUrl: `https://${shopifyUrl}/cart`,
        sections: sectionsData,
        totalQuantity,
        debug: {
          cartToken: req.headers.cookie?.match(/cart=([^;]+)/)?.[1],
          cartState: {
            before: currentCart,
            after: updatedCart
          }
        }
      });
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message,
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          cookies: req.headers.cookie
        } : undefined
      });
    }
  }