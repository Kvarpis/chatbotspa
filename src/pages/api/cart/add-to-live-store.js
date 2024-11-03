// pages/api/cart/add-to-live-store.js
import { parse, serialize } from 'cookie';

// Helper to manage cart cookies
const CartCookieManager = {
  get: (cookies) => {
    const parsed = parse(cookies || '');
    return {
      cartToken: parsed.cart,
      cartTs: parsed.cart_ts,
      cartSignature: parsed.cart_sig
    };
  },
  
  set: (res, { cartToken, cartTs, cartSignature }) => {
    const cookieOptions = {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    };

    if (cartToken) {
      res.setHeader('Set-Cookie', [
        serialize('cart', cartToken, cookieOptions),
        serialize('cart_ts', Date.now().toString(), cookieOptions),
        cartSignature && serialize('cart_sig', cartSignature, cookieOptions)
      ].filter(Boolean));
    }
  }
};

// Helper to format cart response for the frontend
const formatCartResponse = (cartData, sectionsData) => {
  return {
    ...cartData,
    sections: sectionsData,
    itemCount: cartData.item_count || 0,
    total: cartData.total_price / 100,
    items: cartData.items.map(item => ({
      id: item.variant_id,
      quantity: item.quantity,
      title: item.title,
      price: item.price / 100,
      image: item.image,
      url: item.url
    }))
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
  
  try {
    const { variantId, quantity = 1 } = req.body;
    
    // Get existing cart cookies
    const cartCookies = CartCookieManager.get(req.headers.cookie);
    
    // Base headers for all requests
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    // Add cart token if exists
    if (cartCookies.cartToken) {
      headers['Cookie'] = `cart=${cartCookies.cartToken}`;
    }

    // Step 1: Add item to cart
    const addToCartResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{
          id: variantId,
          quantity: quantity
        }]
      })
    });

    if (!addToCartResponse.ok) {
      const errorData = await addToCartResponse.json();
      throw new Error(errorData.description || 'Failed to add to cart');
    }

    // Extract new cart token if present
    const newCartToken = addToCartResponse.headers.get('set-cookie')?.match(/cart=([^;]+)/)?.[1];
    if (newCartToken) {
      headers['Cookie'] = `cart=${newCartToken}`;
    }

    // Step 2: Get updated cart state
    const cartResponse = await fetch(`https://${shopifyUrl}/cart.js`, {
      headers
    });
    const cartData = await cartResponse.json();

    // Step 3: Get updated sections
    const sectionsToFetch = [
      'cart-items',
      'cart-icon-bubble',
      'cart-live-region-text',
      'cart-drawer'
    ].join(',');

    const sectionsResponse = await fetch(
      `https://${shopifyUrl}/cart?sections=${sectionsToFetch}&t=${Date.now()}`,
      { headers }
    );
    const sectionsData = await sectionsResponse.json();

    // Update cookies
    CartCookieManager.set(res, {
      cartToken: newCartToken || cartCookies.cartToken,
      cartTs: Date.now().toString()
    });

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    // Return formatted response
    return res.status(200).json({
      success: true,
      cart: formatCartResponse(cartData, sectionsData),
      checkoutUrl: `https://${shopifyUrl}/cart`,
      debug: process.env.NODE_ENV === 'development' ? {
        cartToken: newCartToken || cartCookies.cartToken,
        requestHeaders: headers
      } : undefined
    });

  } catch (error) {
    console.error('Cart error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}